const { createBaseJestConfig } = require('../../configs/jest/jest.config.base.cjs');

/** @typedef {import('@jest/types').Config.InitialOptions} JestConfig */

/** @type {JestConfig} */
const config = createBaseJestConfig({
  displayName: {
    name: 'mobile',
    color: 'cyan',
  },
  preset: 'jest-expo',
  testEnvironment: 'jsdom',
  testMatch: [
    '<rootDir>/apps/mobile/**/__tests__/**/*.(spec|test).[tj]s?(x)',
    '<rootDir>/apps/mobile/**/*.(spec|test).[tj]s?(x)',
  ],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|react-native|@expo|expo-.*|@expo/.*|@unimodules/.*|unimodules|sentry-expo|native-base|@react-navigation/.*|@apex-tradebill/.*)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/mobile/$1',
  },
});

module.exports = config;
