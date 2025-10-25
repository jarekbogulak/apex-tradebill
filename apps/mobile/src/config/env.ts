import Constants from 'expo-constants';

type AppEnvironment = 'development' | 'preview' | 'production';
type ApexEnvironment = 'prod' | 'qa';

interface AppExtra {
  environment: AppEnvironment;
  eas?: {
    buildProfile?: string | null;
    releaseChannel?: string | null;
  };
  api: {
    baseUrl: string;
    wsBaseUrl: string;
  };
  apexOmni: {
    environment: ApexEnvironment;
    restUrl: string;
    wsUrl: string;
    endpoints: {
      prod: {
        restUrl: string;
        wsUrl: string;
      };
      testnet?: {
        restUrl: string;
        wsUrl: string;
      };
    };
  };
}

const resolveExtra = (): AppExtra => {
  const configExtra = Constants.expoConfig?.extra as AppExtra | undefined;
  const manifestExtra =
    (Constants.manifest as { extra?: unknown } | null | undefined)?.extra as AppExtra | undefined;

  const extra = configExtra ?? manifestExtra;
  if (!extra) {
    throw new Error('Expo configuration (extra) is missing. Did you run through app.config.ts?');
  }
  return extra;
};

const extra = resolveExtra();

export const env = {
  environment: extra.environment,
  eas: {
    buildProfile: extra.eas?.buildProfile ?? null,
    releaseChannel: extra.eas?.releaseChannel ?? null,
  },
  api: {
    baseUrl: extra.api.baseUrl,
    wsBaseUrl: extra.api.wsBaseUrl,
  },
  apexOmni: {
    environment: extra.apexOmni.environment,
    restUrl: extra.apexOmni.restUrl,
    wsUrl: extra.apexOmni.wsUrl,
    endpoints: extra.apexOmni.endpoints,
  },
} as const;

export type { AppEnvironment, ApexEnvironment };
