const { createBaseJestConfig } = require('../../configs/jest/jest.config.base.cjs');

/** @typedef {import('@jest/types').Config.InitialOptions} JestConfig */

/** @type {JestConfig} */
const config = createBaseJestConfig({
  displayName: {
    name: 'api',
    color: 'magenta',
  },
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/apps/api/**/__tests__/**/*.(spec|test).[tj]s?(x)',
    '<rootDir>/apps/api/**/*.(spec|test).[tj]s?(x)',
  ],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/apps/api/tsconfig.json',
        diagnostics: {
          warnOnly: process.env.CI !== 'true',
        },
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/apps/api/jest.setup.ts'],
});

module.exports = config;
