import { z } from 'zod';

export const OMNI_SECRET_TYPES = [
  'trading_api_key',
  'trading_client_secret',
  'webhook_shared_secret',
  'zk_signing_seed',
] as const;

export const OmniEnvironmentSchema = z.enum(['production']);
export type OmniEnvironment = z.infer<typeof OmniEnvironmentSchema>;

export const SecretTypeSchema = z.enum(OMNI_SECRET_TYPES);
export type SecretType = z.infer<typeof SecretTypeSchema>;

export const OmniSecretStatusSchema = z.enum(['active', 'rotating', 'deprecated']);
export type OmniSecretStatus = z.infer<typeof OmniSecretStatusSchema>;

export const CacheSourceSchema = z.enum(['gsm', 'break_glass', 'empty']);
export type CacheSource = z.infer<typeof CacheSourceSchema>;

export const OmniSecretMetadataSchema = z.object({
  secretType: SecretTypeSchema,
  environment: OmniEnvironmentSchema.default('production'),
  gcpSecretId: z.string(),
  gcpVersionAlias: z.string().default('latest'),
  status: OmniSecretStatusSchema.default('active'),
  rotationDueAt: z.string().datetime(),
  lastRotatedAt: z.string().datetime().optional().nullable(),
  lastValidatedAt: z.string().datetime().optional().nullable(),
  owner: z.string().optional().nullable(),
  breakGlassEnabledUntil: z.string().datetime().optional().nullable(),
  cacheSource: CacheSourceSchema.default('gsm'),
  cacheVersion: z.string().optional().nullable(),
  updatedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime().optional(),
});
export type OmniSecretMetadata = z.infer<typeof OmniSecretMetadataSchema>;

export const OmniSecretAccessEventSchema = z.object({
  id: z.number().optional(),
  secretType: SecretTypeSchema,
  action: z.string(),
  actorType: z.enum(['service', 'operator_cli', 'automation']),
  actorId: z.string(),
  result: z.enum(['success', 'failure']),
  errorCode: z.string().optional().nullable(),
  gcpSecretVersion: z.string().optional().nullable(),
  durationMs: z.number().int().nonnegative().optional().nullable(),
  recordedAt: z.string().datetime().optional(),
});
export type OmniSecretAccessEvent = z.infer<typeof OmniSecretAccessEventSchema>;

export const OmniSecretCacheStateSchema = z.object({
  secretType: SecretTypeSchema,
  secretVersion: z.string().optional().nullable(),
  fetchedAt: z.number().optional(),
  expiresAt: z.number().optional(),
  source: CacheSourceSchema,
});
export type OmniSecretCacheState = z.infer<typeof OmniSecretCacheStateSchema>;
