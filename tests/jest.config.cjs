const { createBaseJestConfig } = require('../configs/jest/jest.config.base.cjs');

/** @typedef {import('@jest/types').Config.InitialOptions} JestConfig */

/** @type {JestConfig} */
const config = createBaseJestConfig({
  displayName: {
    name: 'contracts',
    color: 'blue',
  },
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/contract/**/*.contract.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tests/tsconfig.json',
        diagnostics: {
          warnOnly: process.env.CI !== 'true',
        },
      },
    ],
  },
});

module.exports = config;
