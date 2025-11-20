import crypto from 'node:crypto';

export const defaultTestEnv = {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-jwt-secret-1234567890',
  JWT_ISSUER: 'omni-tests',
  JWT_AUDIENCE: 'omni-tests-clients',
  APEX_ALLOW_IN_MEMORY_DB: 'true',
  APEX_ALLOW_IN_MEMORY_MARKET_DATA: 'true',
  SUPABASE_DB_URL: undefined,
  DATABASE_URL: undefined,
  APEX_OMNI_API_KEY: undefined,
  APEX_OMNI_API_SECRET: undefined,
  APEX_OMNI_API_PASSPHRASE: undefined,
  APEX_OMNI_ENVIRONMENT: 'test',
  APEX_OMNI_REST_URL: undefined,
  APEX_OMNI_WS_URL: undefined,
  OMNI_CACHE_TTL_SECONDS: '300',
  GCP_PROJECT_ID: 'test-project',
};

type JwtClaims = {
  sub?: string;
  iss?: string;
  aud?: string;
  scope?: string | string[];
  [key: string]: unknown;
};

const base64UrlEncode = (value: string) => {
  return Buffer.from(value, 'utf8').toString('base64url');
};

export const createOperatorJwt = (overrides: JwtClaims = {}) => {
  const secret = process.env.JWT_SECRET ?? defaultTestEnv.JWT_SECRET;
  const issuer = process.env.JWT_ISSUER ?? defaultTestEnv.JWT_ISSUER;
  const audience = process.env.JWT_AUDIENCE ?? defaultTestEnv.JWT_AUDIENCE;
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: JwtClaims = {
    sub: 'ops-user',
    iss: issuer,
    aud: audience,
    scope: ['ops.omni.secrets'],
    iat: nowSeconds,
    exp: nowSeconds + 60 * 5,
    ...overrides,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
};
