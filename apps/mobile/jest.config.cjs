const { createBaseJestConfig } = require('../../configs/jest/jest.config.base.cjs');

/** @typedef {import('@jest/types').Config.InitialOptions} JestConfig */

const expoPreset = require('jest-expo/jest-preset');

const config = createBaseJestConfig({
  ...expoPreset,
  displayName: {
    name: 'mobile',
    color: 'cyan',
  },
  testEnvironment: 'jsdom',
  testMatch: [
    '<rootDir>/apps/mobile/**/__tests__/**/*.(spec|test).[tj]s?(x)',
    '<rootDir>/apps/mobile/**/*.(spec|test).[tj]s?(x)',
  ],
  setupFiles: ['<rootDir>/apps/mobile/jest.globals.js', ...(expoPreset.setupFiles ?? [])],
  setupFilesAfterEnv: [
    ...(expoPreset.setupFilesAfterEnv ?? []),
    '@testing-library/jest-native/extend-expect',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((?:\\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|react-native-.*|@expo(nent)?|expo(nent)?|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)))',
    'node_modules/(?:\\.pnpm/[^/]+/node_modules/)?react-native-reanimated/plugin/',
  ],
  moduleNameMapper: {
    ...expoPreset.moduleNameMapper,
    '^@/(.*)$': '<rootDir>/apps/mobile/$1',
    '^react-native/Libraries/BatchedBridge/NativeModules$':
      '<rootDir>/apps/mobile/jest.native-modules.mock.js',
    '^expo/build/(.*)$': 'expo/src/$1',
  },
  moduleDirectories: ['node_modules', '<rootDir>/apps/mobile/node_modules'],
});

module.exports = config;
