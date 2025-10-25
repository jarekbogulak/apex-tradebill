import type { ConfigContext, ExpoConfig } from 'expo/config';
import fs from 'node:fs';
import path from 'node:path';

type AppEnvironment = 'development' | 'preview' | 'production';
type ApexEnvironment = 'prod' | 'qa';

const isAppEnvironment = (value: string | undefined): value is AppEnvironment => {
  if (!value) {
    return false;
  }
  return ['development', 'preview', 'production'].includes(value);
};

const normalizeAppEnvironment = (value: string | undefined): AppEnvironment => {
  if (isAppEnvironment(value)) {
    return value;
  }
  return 'development';
};

const normalizeApexEnvironment = (value: string | undefined): ApexEnvironment => {
  if (!value) {
    return 'prod';
  }
  const token = value.trim().toLowerCase();
  if (token === 'qa' || token === 'testnet' || token === 'test' || token === 'sandbox') {
    return 'qa';
  }
  return 'prod';
};

const stripQuotes = (value: string): string => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseEnvFile = (filePath: string): Record<string, string> => {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.split(/\r?\n/).reduce<Record<string, string>>((acc, rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      return acc;
    }
    const sanitized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const delimiterIndex = sanitized.indexOf('=');
    if (delimiterIndex <= 0) {
      return acc;
    }
    const key = sanitized.slice(0, delimiterIndex).trim();
    const value = stripQuotes(sanitized.slice(delimiterIndex + 1));
    if (!key) {
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {});
};

const loadEnvFile = (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const values = parseEnvFile(filePath);
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

const loadEnvironment = (preferred?: string): AppEnvironment => {
  const projectRoot = __dirname;

  loadEnvFile(path.join(projectRoot, '.env'));
  loadEnvFile(path.join(projectRoot, '.env.local'));

  const resolved = normalizeAppEnvironment(
    preferred ??
      process.env.APP_ENV ??
      process.env.EXPO_PUBLIC_APP_ENV ??
      process.env.EXPO_PUBLIC_ENVIRONMENT ??
      process.env.NODE_ENV,
  );

  loadEnvFile(path.join(projectRoot, `.env.${resolved}`));
  loadEnvFile(path.join(projectRoot, `.env.${resolved}.local`));

  return resolved;
};

const sanitizeUrl = (value: string): string => {
  return value.replace(/\/+$/, '');
};

const requireString = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable "${key}"`);
  }
  return value;
};

const resolveApiConfig = () => {
  const baseUrl = sanitizeUrl(requireString('EXPO_PUBLIC_API_URL', 'http://localhost:4000'));

  const wsOverride = process.env.EXPO_PUBLIC_API_WS_URL;
  let wsBaseUrl: string;
  if (wsOverride && wsOverride.trim()) {
    wsBaseUrl = sanitizeUrl(wsOverride.trim());
  } else {
    try {
      const parsed = new URL(baseUrl);
      parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      wsBaseUrl = sanitizeUrl(parsed.toString());
    } catch {
      wsBaseUrl = sanitizeUrl(baseUrl.replace(/^http/, 'ws'));
    }
  }

  return {
    baseUrl,
    wsBaseUrl,
  };
};

const resolveApexEndpoints = () => {
  const explicitEnvironment = normalizeApexEnvironment(
    process.env.EXPO_PUBLIC_APEX_ENVIRONMENT ?? process.env.APEX_OMNI_ENVIRONMENT,
  );

  const prodRestUrl = sanitizeUrl(
    requireString(
      'EXPO_PUBLIC_APEX_REST_URL',
      process.env.APEX_OMNI_REST_URL ?? 'https://api.pro.apex.exchange',
    ),
  );
  const prodWsUrl = sanitizeUrl(
    requireString(
      'EXPO_PUBLIC_APEX_WS_URL',
      process.env.APEX_OMNI_WS_URL ?? 'wss://stream.pro.apex.exchange',
    ),
  );

  const testnetRestUrlRaw =
    process.env.EXPO_PUBLIC_APEX_TESTNET_REST_URL ??
    process.env.APEX_OMNI_TESTNET_REST_URL ??
    'https://testnet.omni.apex.exchange/api/';
  const testnetWsUrlRaw =
    process.env.EXPO_PUBLIC_APEX_TESTNET_WS_URL ??
    process.env.APEX_OMNI_TESTNET_WS_URL ??
    'wss://testnet.omni.apex.exchange/ws/v1';

  const testnetRestUrl = sanitizeUrl(testnetRestUrlRaw);
  const testnetWsUrl = sanitizeUrl(testnetWsUrlRaw);

  const inferredEnvironment =
    explicitEnvironment === 'prod' &&
    (process.env.EXPO_PUBLIC_APEX_TESTNET_REST_URL ||
      process.env.EXPO_PUBLIC_APEX_TESTNET_WS_URL ||
      process.env.APEX_OMNI_TESTNET_REST_URL ||
      process.env.APEX_OMNI_TESTNET_WS_URL)
      ? 'qa'
      : explicitEnvironment;

  const restUrl = inferredEnvironment === 'qa' ? testnetRestUrl : prodRestUrl;
  const wsUrl = inferredEnvironment === 'qa' ? testnetWsUrl : prodWsUrl;

  return {
    environment: inferredEnvironment,
    restUrl,
    wsUrl,
    endpoints: {
      prod: {
        restUrl: prodRestUrl,
        wsUrl: prodWsUrl,
      },
      testnet: {
        restUrl: testnetRestUrl,
        wsUrl: testnetWsUrl,
      },
    },
  };
};

export default ({ config }: ConfigContext = {} as ConfigContext): ExpoConfig => {
  const appEnv = loadEnvironment(
    process.env.APP_ENV ??
      process.env.EXPO_PUBLIC_APP_ENV ??
      process.env.EXPO_PUBLIC_ENVIRONMENT ??
      process.env.NODE_ENV,
  );

  const api = resolveApiConfig();
  const apexOmni = resolveApexEndpoints();

  const expoConfig: ExpoConfig = {
    name: 'mobile',
    slug: 'mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'mobile',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      environment: appEnv,
      eas: {
        buildProfile: process.env.EAS_BUILD_PROFILE ?? null,
        releaseChannel: process.env.EXPO_RELEASE_CHANNEL ?? null,
      },
      api,
      apexOmni,
    },
  };

  return {
    ...config,
    ...expoConfig,
  };
};
