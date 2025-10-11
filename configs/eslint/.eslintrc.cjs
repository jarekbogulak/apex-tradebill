const path = require('path');
const js = require('@eslint/js');
const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({
  baseDirectory: path.resolve(__dirname, '..', '..'),
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = [
  {
    ignores: ['dist/**', 'build/**', 'coverage/**', 'node_modules/**', '**/*.d.ts'],
  },
  ...compat.config({
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      ecmaFeatures: {
        jsx: true,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    plugins: ['@typescript-eslint', 'react', 'react-hooks', 'react-native'],
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:react/recommended',
      'plugin:react-hooks/recommended',
      'prettier',
    ],
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
    overrides: [
      {
        files: ['apps/mobile/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
        env: {
          browser: true,
        },
        extends: ['plugin:react-native/all'],
        rules: {
          'react-native/no-inline-styles': 'warn',
          'react-native/no-color-literals': 'warn',
          'react-native/no-unused-styles': 'warn',
          'react-native/sort-styles': 'off',
          'react-native/no-raw-text': 'off',
        },
      },
      {
        files: ['apps/api/**/*.ts', 'packages/utils/**/*.ts', 'packages/types/**/*.ts'],
        env: {
          node: true,
        },
        rules: {
          'no-console': [
            'warn',
            {
              allow: ['warn', 'error'],
            },
          ],
        },
      },
      {
        files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
        env: {
          jest: true,
        },
      },
      {
        files: [
          '*.config.{js,ts,cjs,mjs}',
          '*rc.{js,cjs}',
          '.prettierrc.cjs',
          '**/scripts/**/*.{js,ts}',
          'apps/**/eslint.config.js',
          'configs/**/*.{js,ts,cjs}',
        ],
        env: {
          node: true,
        },
      },
    ],
  }),
];
