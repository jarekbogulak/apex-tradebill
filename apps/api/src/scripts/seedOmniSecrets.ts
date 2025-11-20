import { buildDatabasePoolOptions } from '../config/database.js';
import { env } from '../config/env.js';
import {
  closeSharedDatabasePool,
  getSharedDatabasePool,
  runPendingMigrations,
} from '../adapters/persistence/providers/postgres/pool.js';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

interface SeedSecretDescriptor {
  secretType: string;
  owner: string;
  gcpSecretId: string;
}

const resolveProjectId = (): string => {
  return env.omniSecrets.gcpProjectId ?? 'local-dev';
};

const seedCatalog = (): SeedSecretDescriptor[] => {
  const projectId = resolveProjectId();
  return [
    {
      secretType: 'trading_api_key',
      owner: 'Security Engineering',
      gcpSecretId: `projects/${projectId}/secrets/apex-omni-trading-api-key`,
    },
    {
      secretType: 'trading_client_secret',
      owner: 'Security Engineering',
      gcpSecretId: `projects/${projectId}/secrets/apex-omni-trading-client-secret`,
    },
    {
      secretType: 'webhook_shared_secret',
      owner: 'Platform Reliability',
      gcpSecretId: `projects/${projectId}/secrets/apex-omni-webhook-shared-secret`,
    },
  ];
};

const UPSERT_SQL = `
INSERT INTO omni_secret_metadata (
  secret_type,
  environment,
  gcp_secret_id,
  gcp_version_alias,
  status,
  rotation_due_at,
  owner,
  updated_at
) VALUES ($1, 'production', $2, 'latest', 'active', $3, $4, NOW())
ON CONFLICT (secret_type)
DO UPDATE SET
  gcp_secret_id = EXCLUDED.gcp_secret_id,
  gcp_version_alias = EXCLUDED.gcp_version_alias,
  status = EXCLUDED.status,
  rotation_due_at = EXCLUDED.rotation_due_at,
  owner = EXCLUDED.owner,
  updated_at = NOW();
`.trim();

export const seedOmniSecrets = async () => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  if (process.env.APEX_FORCE_IN_MEMORY_DB === 'true') {
    return;
  }
  const pool = await getSharedDatabasePool(buildDatabasePoolOptions());
  await runPendingMigrations(pool);

  const rotationDueAt = new Date(Date.now() + ONE_YEAR_MS).toISOString();
  for (const descriptor of seedCatalog()) {
    await pool.query(UPSERT_SQL, [
      descriptor.secretType,
      descriptor.gcpSecretId,
      rotationDueAt,
      descriptor.owner,
    ]);
  }

  process.stdout.write('Seeded omni_secret_metadata catalog.\n');
  await closeSharedDatabasePool();
};

void seedOmniSecrets().catch((error) => {
  console.error('Failed to seed Omni secrets catalog:', error);
  process.exitCode = 1;
});
