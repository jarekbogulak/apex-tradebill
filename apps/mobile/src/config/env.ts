import Constants from 'expo-constants';
import { Platform } from 'react-native';

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
  const manifestExtra = (Constants.manifest as { extra?: unknown } | null | undefined)?.extra as
    | AppExtra
    | undefined;

  const extra = configExtra ?? manifestExtra;
  if (!extra) {
    throw new Error('Expo configuration (extra) is missing. Did you run through app.config.ts?');
  }
  return extra;
};

const extra = resolveExtra();

const sanitizeUrl = (value: string): string => {
  return value.replace(/\/+$/, '');
};

const isLoopbackHost = (host: string): boolean => {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    host === '::1'
  );
};

const resolveExpoDevHost = (): string | null => {
  const candidates = [
    Constants.expoConfig?.hostUri,
    (Constants.manifest as { debuggerHost?: string } | null | undefined)?.debuggerHost,
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const host = candidate.split(':')[0];
    if (host && host !== 'null' && host !== 'undefined') {
      return host;
    }
  }

  return null;
};

const normalizeDevUrl = (value: string): string => {
  const sanitized = sanitizeUrl(value);

  if (!__DEV__) {
    return sanitized;
  }

  try {
    const parsed = new URL(sanitized);
    if (!isLoopbackHost(parsed.hostname)) {
      return sanitizeUrl(parsed.toString());
    }

    const expoHost = resolveExpoDevHost();
    if (expoHost) {
      parsed.hostname = expoHost;
      return sanitizeUrl(parsed.toString());
    }

    if (Platform.OS === 'android') {
      parsed.hostname = '10.0.2.2';
      return sanitizeUrl(parsed.toString());
    }

    return sanitizeUrl(parsed.toString());
  } catch {
    return sanitized;
  }
};

const apiBaseUrl = normalizeDevUrl(extra.api.baseUrl);
const apiWsBaseUrl = normalizeDevUrl(extra.api.wsBaseUrl);

export const env = {
  environment: extra.environment,
  eas: {
    buildProfile: extra.eas?.buildProfile ?? null,
    releaseChannel: extra.eas?.releaseChannel ?? null,
  },
  api: {
    baseUrl: apiBaseUrl,
    wsBaseUrl: apiWsBaseUrl,
  },
  apexOmni: {
    environment: extra.apexOmni.environment,
    restUrl: extra.apexOmni.restUrl,
    wsUrl: extra.apexOmni.wsUrl,
    endpoints: extra.apexOmni.endpoints,
  },
} as const;

export type { AppEnvironment, ApexEnvironment };
