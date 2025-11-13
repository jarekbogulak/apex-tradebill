const path = require('node:path');

/** @typedef {import('@jest/types').Config.InitialOptions} JestConfig */

const workspaceRoot = path.resolve(__dirname, '..', '..');

/** @type {JestConfig} */
const baseConfig = {
  rootDir: workspaceRoot,
  clearMocks: true,
  watchman: false,
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/.expo/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@mobile/(.*)$': '<rootDir>/apps/mobile/$1',
    '^@api/(.*)\\.js$': '<rootDir>/apps/api/src/$1',
    '^@api/(.*)$': '<rootDir>/apps/api/src/$1',
    '^@packages/(.*)$': '<rootDir>/packages/$1',
    '^@apex-tradebill/ui$': '<rootDir>/packages/ui/src/index.ts',
    '^@apex-tradebill/types$': '<rootDir>/packages/types/src/index.ts',
    '^@apex-tradebill/utils$': '<rootDir>/packages/utils/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};

/**
 * Creates a Jest config derived from the shared base configuration.
 * @param {JestConfig} [overrides]
 * @returns {JestConfig}
 */
const createBaseJestConfig = (overrides = {}) => ({
  ...baseConfig,
  ...overrides,
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    ...overrides.moduleNameMapper,
  },
  setupFilesAfterEnv: [
    ...(baseConfig.setupFilesAfterEnv ?? []),
    ...(overrides.setupFilesAfterEnv ?? []),
  ],
});

module.exports = {
  createBaseJestConfig,
  default: createBaseJestConfig,
};
