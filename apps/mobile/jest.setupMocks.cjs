/* eslint-disable react/prop-types */

const nativeModulesMock = require('./jest.native-modules.mock.js');

jest.mock('react-native/Libraries/BatchedBridge/NativeModules', () => nativeModulesMock);
jest.mock('@apex-tradebill/ui', () => {
  const React = require('react');

  const baseTheme = {
    scheme: 'light',
    colors: {
      surface: '#FFFFFF',
      surfaceMuted: '#F1F5F9',
      divider: '#CBD5F5',
      overlay: 'rgba(15, 23, 42, 0.45)',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      textMuted: '#64748B',
      accent: '#2563EB',
    },
    spacing: {
      xxs: 2,
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      xxl: 32,
    },
    radii: {
      none: 0,
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      pill: 999,
    },
    shadows: {
      level0: {
        shadowColor: 'transparent',
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      },
      level1: {
        shadowColor: 'rgba(15, 23, 42, 0.12)',
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      },
      level2: {
        shadowColor: 'rgba(15, 23, 42, 0.24)',
        shadowOpacity: 0.24,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
      },
    },
    typography: {
      fontFamilies: {
        sans: 'System',
        serif: 'Georgia',
        mono: 'Menlo',
      },
      fontSizes: {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 20,
        xl: 24,
        xxl: 32,
      },
      lineHeights: {
        tight: 16,
        snug: 18,
        normal: 22,
        relaxed: 28,
      },
      fontWeights: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
    },
  };

  const ThemeContextInstance = React.createContext(baseTheme);

  const ThemeProvider = ({ children }) =>
    React.createElement(ThemeContextInstance.Provider, { value: baseTheme }, children);

  const withThemeProvider = (Component) => {
    const WrappedComponent = (props) =>
      React.createElement(ThemeProvider, null, React.createElement(Component, props));
    WrappedComponent.displayName = `WithThemeProvider(${Component.displayName ?? Component.name ?? 'Component'})`;
    return WrappedComponent;
  };

  return {
    ThemeContextInstance,
    ThemeProvider,
    PlaceholderComponent: () => null,
    useTheme: () => baseTheme,
    useThemeColor: (token) => baseTheme.colors[token] ?? '#000000',
    createTheme: () => baseTheme,
    darkTheme: baseTheme,
    lightTheme: baseTheme,
    themes: { light: baseTheme, dark: baseTheme },
    withThemeProvider,
  };
});

const turboModuleMock = {
  get(name) {
    if (name === 'SourceCode') {
      return { scriptURL: 'http://localhost' };
    }
    return {};
  },
  getEnforcing(name) {
    const module = turboModuleMock.get(name);
    if (!module) {
      throw new Error(`TurboModuleRegistry mock missing module: ${name}`);
    }
    return module;
  },
};

jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => turboModuleMock);

jest.mock('react-native/src/private/specs_DEPRECATED/modules/NativeSourceCode', () => ({
  getConstants() {
    return { scriptURL: 'http://localhost' };
  },
}));

jest.mock('react-native/Libraries/Utilities/NativePlatformConstantsIOS', () => ({
  getConstants() {
    return {
      forceTouchAvailable: false,
      interfaceIdiom: 'phone',
      osVersion: 'test',
      systemName: 'test',
      isTesting: true,
    };
  },
}));

jest.mock('react-native/Libraries/Utilities/NativeDeviceInfo', () => ({
  getConstants() {
    return {
      Dimensions: {
        window: { width: 375, height: 812, scale: 2, fontScale: 2 },
        screen: { width: 375, height: 812, scale: 2, fontScale: 2 },
      },
    };
  },
}));

jest.mock('react-native/Libraries/ReactNative/UIManager', () => ({
  getViewManagerConfig() {
    return {};
  },
  createView() {},
  updateView() {},
  setChildren() {},
}));

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockModal = ({ children, visible = true, testID, ...rest }) => {
    if (!visible) {
      return null;
    }
    return React.createElement(
      View,
      {
        accessibilityRole: 'none',
        ...rest,
        testID,
      },
      children,
    );
  };

  MockModal.displayName = 'MockModal';

  return MockModal;
});

jest.mock('expo', () => ({}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        environment: 'development',
        eas: {
          buildProfile: null,
          releaseChannel: null,
        },
        api: {
          baseUrl: 'http://localhost:4000',
          wsBaseUrl: 'ws://localhost:4000',
        },
        apexOmni: {
          environment: 'prod',
          restUrl: 'https://omni.apex.exchange',
          wsUrl: 'wwss://quote.omni.apex.exchange',
          endpoints: {
            prod: {
              restUrl: 'https://omni.apex.exchange',
              wsUrl: 'wwss://quote.omni.apex.exchange',
            },
            testnet: {
              restUrl: 'https://testnet.omni.apex.exchange/api',
              wsUrl: 'wss://qa-quote.omni.apex.exchange',
            },
          },
        },
      },
    },
    manifest: null,
  },
}));

const { configureInternal } = require('@testing-library/react-native/build/config');

configureInternal({
  hostComponentNames: {
    text: 'RCTText',
    textInput: 'AndroidTextInput',
    image: 'RCTImageView',
    switch: 'RCTSwitch',
    scrollView: 'RCTScrollView',
    modal: 'RCTModalHostView',
  },
});
