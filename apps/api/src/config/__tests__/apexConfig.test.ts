import { resolveApeXConnection, resolveApeXCredentials } from '../apexConfig.js';

const baseEnv: NodeJS.ProcessEnv = {
  APEX_OMNI_API_KEY: 'key',
  APEX_OMNI_API_SECRET: 'secret',
};

const buildEnv = (overrides: Record<string, string | undefined>): NodeJS.ProcessEnv => {
  return {
    ...baseEnv,
    ...overrides,
  };
};

describe('resolveApeXCredentials', () => {
  it('returns null when credentials are missing', () => {
    const env = buildEnv({ APEX_OMNI_API_KEY: undefined });
    expect(resolveApeXCredentials(env)).toBeNull();
  });

  it('defaults to production endpoints', () => {
    const env = buildEnv({
      APEX_OMNI_REST_URL: 'https://omni.apex.exchange',
      APEX_OMNI_WS_URL: 'wss://quote.omni.apex.exchange',
    });

    const resolved = resolveApeXCredentials(env);
    expect(resolved).not.toBeNull();
    expect(resolved?.environment).toBe('prod');
    expect(resolved?.restUrl).toBe('https://omni.apex.exchange');
    expect(resolved?.wsUrl).toBe('wss://quote.omni.apex.exchange');
  });

  it('activates the testnet configuration via environment flag', () => {
    const env = buildEnv({
      APEX_OMNI_ENVIRONMENT: 'testnet',
      APEX_OMNI_TESTNET_REST_URL: 'https://testnet.omni.apex.exchange',
      APEX_OMNI_TESTNET_WS_URL: 'wss://qa-quote.omni.apex.exchange',
    });

    const resolved = resolveApeXCredentials(env);
    expect(resolved?.environment).toBe('qa');
    expect(resolved?.restUrl).toBe('https://testnet.omni.apex.exchange');
    expect(resolved?.wsUrl).toBe('wss://qa-quote.omni.apex.exchange');
  });

  it('ignores testnet overrides when environment is production', () => {
    const env = buildEnv({
      APEX_OMNI_ENVIRONMENT: 'prod',
      APEX_OMNI_REST_URL: 'https://omni.apex.exchange',
      APEX_OMNI_WS_URL: 'wss://quote.omni.apex.exchange',
      APEX_OMNI_TESTNET_REST_URL: 'https://qa.omni.apex.exchange',
      APEX_OMNI_TESTNET_WS_URL: 'wss://qa-quote.omni.apex.exchange',
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const resolved = resolveApeXCredentials(env);
    expect(warnSpy).toHaveBeenCalledWith(
      'APEX_OMNI_TESTNET_* variables are set but ignored because APEX_OMNI_ENVIRONMENT=prod.',
    );
    warnSpy.mockRestore();
    expect(resolved?.environment).toBe('prod');
    expect(resolved?.restUrl).toBe('https://omni.apex.exchange');
    expect(resolved?.wsUrl).toBe('wss://quote.omni.apex.exchange');
  });

  it('falls back to production endpoints when testnet URLs are missing', () => {
    const env = buildEnv({
      APEX_OMNI_ENVIRONMENT: 'qa',
      APEX_OMNI_REST_URL: 'https://omni.apex.exchange',
      APEX_OMNI_WS_URL: 'wss://quote.omni.apex.exchange',
    });

    const resolved = resolveApeXCredentials(env);
    expect(resolved?.environment).toBe('qa');
    expect(resolved?.restUrl).toBe('https://omni.apex.exchange');
    expect(resolved?.wsUrl).toBe('wss://quote.omni.apex.exchange');
  });
});

describe('resolveApeXConnection', () => {
  it('resolves endpoints even when credentials are missing', () => {
    const env = buildEnv({
      APEX_OMNI_API_KEY: undefined,
      APEX_OMNI_API_SECRET: undefined,
      APEX_OMNI_ENVIRONMENT: 'qa',
      APEX_OMNI_TESTNET_REST_URL: 'https://testnet.omni.apex.exchange',
      APEX_OMNI_TESTNET_WS_URL: 'wss://qa-quote.omni.apex.exchange',
    });

    const resolved = resolveApeXConnection(env);
    expect(resolved.environment).toBe('qa');
    expect(resolved.restUrl).toBe('https://testnet.omni.apex.exchange');
    expect(resolved.wsUrl).toBe('wss://qa-quote.omni.apex.exchange');
  });
});
