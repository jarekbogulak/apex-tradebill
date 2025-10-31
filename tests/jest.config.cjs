const { createBaseJestConfig } = require('../configs/jest/jest.config.base.cjs');

/** @typedef {import('@jest/types').Config.InitialOptions} JestConfig */

/** @type {JestConfig} */
const config = createBaseJestConfig({
  displayName: {
    name: 'workspace-tests',
    color: 'blue',
  },
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/contract/**/*.contract.test.ts',
    '<rootDir>/tests/integration/**/*.spec.ts',
    '<rootDir>/tests/performance/**/*.test.ts',
    '<rootDir>/tests/reliability/**/*.spec.ts',
  ],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tests/tsconfig.json',
        diagnostics: {
          warnOnly: process.env.CI !== 'true',
          ignoreCodes: [151002],
        },
      },
    ],
  },
});

module.exports = config;
