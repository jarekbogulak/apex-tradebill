const { createBaseJestConfig } = require('../../configs/jest/jest.config.base.cjs');

/** @typedef {import('@jest/types').Config.InitialOptions} JestConfig */

/** @type {JestConfig} */
const config = createBaseJestConfig({
  displayName: {
    name: 'api',
    color: 'magenta',
  },
  setupFiles: ['<rootDir>/apps/api/jest.env.cjs'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/apps/api/**/__tests__/**/*.(spec|test).[tj]s?(x)',
    '<rootDir>/apps/api/**/*.(spec|test).[tj]s?(x)',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/apps/api/tsconfig.jest.json',
        diagnostics: {
          warnOnly: process.env.CI !== 'true',
        },
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/apps/api/jest.setup.cjs'],
});

module.exports = config;
