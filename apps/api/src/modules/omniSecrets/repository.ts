import type {
  DatabasePool,
  QueryResultRow,
} from '../../adapters/persistence/providers/postgres/pool.js';
import {
  OmniSecretMetadataSchema,
  type OmniSecretMetadata,
  type OmniSecretAccessEvent,
} from './types.js';

interface OmniSecretMetadataRow extends QueryResultRow {
  secret_type: string;
  environment: string;
  gcp_secret_id: string;
  gcp_version_alias: string;
  status: string;
  rotation_due_at: string | Date;
  last_rotated_at: string | Date | null;
  last_validated_at: string | Date | null;
  owner: string | null;
  break_glass_enabled_until: string | Date | null;
  cache_source: string;
  cache_version: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

const toIso = (value: string | Date | null | undefined): string | undefined => {
  if (value == null) {
    return undefined;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
};

const mapRowToMetadata = (row: OmniSecretMetadataRow): OmniSecretMetadata => {
  return OmniSecretMetadataSchema.parse({
    secretType: row.secret_type,
    environment: row.environment,
    gcpSecretId: row.gcp_secret_id,
    gcpVersionAlias: row.gcp_version_alias,
    status: row.status,
    rotationDueAt: toIso(row.rotation_due_at),
    lastRotatedAt: toIso(row.last_rotated_at),
    lastValidatedAt: toIso(row.last_validated_at),
    owner: row.owner ?? undefined,
    breakGlassEnabledUntil: toIso(row.break_glass_enabled_until),
    cacheSource: row.cache_source,
    cacheVersion: row.cache_version ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  });
};

export interface OmniSecretMetadataUpdates {
  gcpVersionAlias?: string;
  status?: string;
  rotationDueAt?: string;
  lastRotatedAt?: string | null;
  lastValidatedAt?: string | null;
  owner?: string | null;
  breakGlassEnabledUntil?: string | null;
  cacheSource?: string;
  cacheVersion?: string | null;
}

export interface OmniSecretRepository {
  listMetadata(): Promise<OmniSecretMetadata[]>;
  getMetadata(secretType: string): Promise<OmniSecretMetadata | null>;
  updateMetadata(secretType: string, updates: OmniSecretMetadataUpdates): Promise<void>;
  recordAccessEvent(event: OmniSecretAccessEvent): Promise<void>;
}

const UPDATE_COLUMNS: Record<keyof OmniSecretMetadataUpdates, string> = {
  gcpVersionAlias: 'gcp_version_alias',
  status: 'status',
  rotationDueAt: 'rotation_due_at',
  lastRotatedAt: 'last_rotated_at',
  lastValidatedAt: 'last_validated_at',
  owner: 'owner',
  breakGlassEnabledUntil: 'break_glass_enabled_until',
  cacheSource: 'cache_source',
  cacheVersion: 'cache_version',
};

export const createOmniSecretRepository = (pool: DatabasePool): OmniSecretRepository => {
  return {
    async listMetadata() {
      const result = await pool.query<OmniSecretMetadataRow>(
        `
          SELECT secret_type, environment, gcp_secret_id, gcp_version_alias, status,
                 rotation_due_at, last_rotated_at, last_validated_at, owner,
                 break_glass_enabled_until, cache_source, cache_version,
                 created_at, updated_at
          FROM omni_secret_metadata
          ORDER BY secret_type ASC;
        `,
      );
      return result.rows.map(mapRowToMetadata);
    },

    async getMetadata(secretType) {
      const result = await pool.query<OmniSecretMetadataRow>(
        `
          SELECT secret_type, environment, gcp_secret_id, gcp_version_alias, status,
                 rotation_due_at, last_rotated_at, last_validated_at, owner,
                 break_glass_enabled_until, cache_source, cache_version,
                 created_at, updated_at
          FROM omni_secret_metadata
          WHERE secret_type = $1;
        `,
        [secretType],
      );
      const row = result.rows[0];
      return row ? mapRowToMetadata(row) : null;
    },

    async updateMetadata(secretType, updates) {
      const assignments: string[] = [];
      const values: Array<string | null> = [];
      let index = 1;

      for (const [key, column] of Object.entries(UPDATE_COLUMNS)) {
        const typedKey = key as keyof OmniSecretMetadataUpdates;
        if (typeof updates[typedKey] === 'undefined') {
          continue;
        }
        assignments.push(`${column} = $${++index}`);
        values.push(updates[typedKey] as string | null);
      }

      if (assignments.length === 0) {
        return;
      }

      values.unshift(secretType);
      assignments.push('updated_at = NOW()');

      const sql = `
        UPDATE omni_secret_metadata
        SET ${assignments.join(', ')}
        WHERE secret_type = $1;
      `;

      await pool.query(sql, values);
    },

    async recordAccessEvent(event) {
      await pool.query(
        `
          INSERT INTO omni_secret_access_events (
            secret_type,
            action,
            actor_type,
            actor_id,
            result,
            error_code,
            gcp_secret_version,
            duration_ms
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
        `,
        [
          event.secretType,
          event.action,
          event.actorType,
          event.actorId,
          event.result,
          event.errorCode ?? null,
          event.gcpSecretVersion ?? null,
          event.durationMs ?? null,
        ],
      );
    },
  };
};
