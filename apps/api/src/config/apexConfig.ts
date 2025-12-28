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

export interface ApeXConnectionConfig {
  environment: ApeXEnvironment;
  restUrl?: string;
  wsUrl?: string;
}

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

export const resolveApeXConnection = (
  env: NodeJS.ProcessEnv = process.env,
): ApeXConnectionConfig => {
  const environment = normalizeEnvironment(env.APEX_OMNI_ENVIRONMENT);

  const restUrl =
    environment === 'qa'
      ? pickFirstDefined(env, ['APEX_OMNI_TESTNET_REST_URL', 'APEX_OMNI_REST_URL'])
      : env.APEX_OMNI_REST_URL;
  const wsUrl =
    environment === 'qa'
      ? pickFirstDefined(env, ['APEX_OMNI_TESTNET_WS_URL', 'APEX_OMNI_WS_URL'])
      : env.APEX_OMNI_WS_URL;

  if (
    environment === 'prod' &&
    (env.APEX_OMNI_TESTNET_REST_URL || env.APEX_OMNI_TESTNET_WS_URL)
  ) {
    console.warn(
      'APEX_OMNI_TESTNET_* variables are set but ignored because APEX_OMNI_ENVIRONMENT=prod.',
    );
  }

  return {
    environment,
    restUrl,
    wsUrl,
  };
};

export const resolveApeXCredentials = (
  env: NodeJS.ProcessEnv = process.env,
  connection?: ApeXConnectionConfig,
): ApeXCredentials | null => {
  const apiKey = env.APEX_OMNI_API_KEY;
  const apiSecret = env.APEX_OMNI_API_SECRET;
  if (!apiKey || !apiSecret) {
    return null;
  }

  const resolvedConnection = connection ?? resolveApeXConnection(env);

  return {
    apiKey,
    apiSecret,
    passphrase: env.APEX_OMNI_API_PASSPHRASE,
    environment: resolvedConnection.environment,
    restUrl: resolvedConnection.restUrl,
    wsUrl: resolvedConnection.wsUrl,
    l2Seed: env.APEX_OMNI_L2_SEED,
  };
};
