const { createBaseJestConfig } = require('../../configs/jest/jest.config.base.cjs');

/** @typedef {import('@jest/types').Config.InitialOptions} JestConfig */

/** @type {JestConfig} */
const config = createBaseJestConfig({
  displayName: {
    name: 'utils',
    color: 'blue',
  },
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/packages/utils/**/__tests__/**/*.(spec|test).[tj]s?(x)',
    '<rootDir>/packages/utils/**/*.(spec|test).[tj]s?(x)',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/packages/utils/tsconfig.jest.json',
        diagnostics: {
          warnOnly: process.env.CI !== 'true',
        },
      },
    ],
  },
});

module.exports = config;
