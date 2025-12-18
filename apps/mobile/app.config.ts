import type { ConfigContext, ExpoConfig } from 'expo/config';
type AppEnvironment = 'development' | 'preview' | 'production';
type ApexEnvironment = 'prod' | 'qa';

const iosBundleIdentifier =
  process.env.EXPO_IOS_BUNDLE_IDENTIFIER ?? 'com.apextradebill.mobile';
const androidPackage = process.env.EXPO_ANDROID_PACKAGE ?? 'com.apextradebill.mobile';

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

const resolveAppEnvironment = (preferred?: string): AppEnvironment => {
  return normalizeAppEnvironment(
    preferred ??
      process.env.EXPO_PUBLIC_APP_ENV ??
      process.env.EXPO_PUBLIC_ENVIRONMENT ??
      process.env.NODE_ENV,
  );
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

const resolveApiTarget = (): 'local' | 'prod' => {
  const target =
    process.env.EXPO_PUBLIC_API_TARGET ?? process.env.EXPO_PUBLIC_APP_ENV ?? process.env.NODE_ENV;
  const normalized = (target ?? '').toLowerCase();
  if (normalized === 'prod' || normalized === 'production') {
    return 'prod';
  }
  return 'local';
};

const resolveApiConfig = () => {
  const apiTarget = resolveApiTarget();

  const prodBaseUrl = sanitizeUrl(
    requireString(
      'EXPO_PUBLIC_API_PROD_URL',
      'https://apex-tradebill-api-prod-224196875744.us-central1.run.app',
    ),
  );
  const fallbackLocalBaseUrl = sanitizeUrl(
    requireString('EXPO_PUBLIC_API_URL', 'http://127.0.0.1:4000'),
  );
  const baseUrl = sanitizeUrl(
    process.env.EXPO_PUBLIC_API_URL ??
      (apiTarget === 'prod' ? prodBaseUrl : fallbackLocalBaseUrl),
  );

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
  const explicitEnvironment = normalizeApexEnvironment(process.env.EXPO_PUBLIC_APEX_ENVIRONMENT);

  const prodRestUrl = sanitizeUrl(
    requireString('EXPO_PUBLIC_APEX_REST_URL', 'https://api.pro.apex.exchange'),
  );
  const prodWsUrl = sanitizeUrl(
    requireString('EXPO_PUBLIC_APEX_WS_URL', 'wss://stream.pro.apex.exchange'),
  );

  const testnetRestUrlRaw =
    process.env.EXPO_PUBLIC_APEX_TESTNET_REST_URL ?? 'https://testnet.omni.apex.exchange/api/';
  const testnetWsUrlRaw =
    process.env.EXPO_PUBLIC_APEX_TESTNET_WS_URL ?? 'wss://testnet.omni.apex.exchange/ws/v1';

  const testnetRestUrl = sanitizeUrl(testnetRestUrlRaw);
  const testnetWsUrl = sanitizeUrl(testnetWsUrlRaw);

  const inferredEnvironment =
    explicitEnvironment === 'prod' &&
    (process.env.EXPO_PUBLIC_APEX_TESTNET_REST_URL ||
      process.env.EXPO_PUBLIC_APEX_TESTNET_WS_URL)
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
  const appEnv = resolveAppEnvironment(process.env.EXPO_PUBLIC_APP_ENV);

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
      bundleIdentifier: iosBundleIdentifier,
    },
    android: {
      package: androidPackage,
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
    runtimeVersion: {
      policy: 'appVersion',
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
