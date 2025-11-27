export type ApeXEnvironment = 'prod' | 'qa';

const normalizeEnvironment = (value: string | undefined): ApeXEnvironment => {
  if (!value) {
    return 'prod';
  }
  const token = value.trim().toLowerCase();
  if (token === 'qa' || token === 'test' || token === 'testnet' || token === 'sandbox') {
    return 'qa';
  }
  return 'prod';
};

const pickFirstDefined = (env: NodeJS.ProcessEnv, keys: readonly string[]): string | undefined => {
  for (const key of keys) {
    const candidate = env[key];
    if (candidate && candidate.trim()) {
      return candidate;
    }
  }
  return undefined;
};

export interface ApeXCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  environment: ApeXEnvironment;
  restUrl?: string;
  wsUrl?: string;
  /**
   * ZK signing seed (hex). For prod this should come from Secret Manager (secret type: zk_signing_seed).
   */
  l2Seed?: string;
}

export const resolveApeXCredentials = (
  env: NodeJS.ProcessEnv = process.env,
): ApeXCredentials | null => {
  const apiKey = env.APEX_OMNI_API_KEY;
  const apiSecret = env.APEX_OMNI_API_SECRET;
  if (!apiKey || !apiSecret) {
    return null;
  }

  const explicitEnvironment = normalizeEnvironment(env.APEX_OMNI_ENVIRONMENT);
  const detectedEnvironment =
    explicitEnvironment === 'prod' &&
    (Boolean(env.APEX_OMNI_TESTNET_REST_URL) || Boolean(env.APEX_OMNI_TESTNET_WS_URL))
      ? 'qa'
      : explicitEnvironment;

  const restUrl =
    detectedEnvironment === 'qa'
      ? pickFirstDefined(env, ['APEX_OMNI_TESTNET_REST_URL', 'APEX_OMNI_REST_URL'])
      : env.APEX_OMNI_REST_URL;
  const wsUrl =
    detectedEnvironment === 'qa'
      ? pickFirstDefined(env, ['APEX_OMNI_TESTNET_WS_URL', 'APEX_OMNI_WS_URL'])
      : env.APEX_OMNI_WS_URL;

  return {
    apiKey,
    apiSecret,
    passphrase: env.APEX_OMNI_API_PASSPHRASE,
    environment: detectedEnvironment,
    restUrl,
    wsUrl,
    l2Seed: env.APEX_OMNI_L2_SEED,
  };
};
