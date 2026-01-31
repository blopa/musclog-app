/* eslint-env node */
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// Local plugin with custom rules
const localRulesPlugin = require('./eslint-rules');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'coverage/**'],
  },
  {
    plugins: {
      local: localRulesPlugin,
    },
    rules: {
      'react/display-name': 'off',
      'react/jsx-closing-bracket-location': ['warn', 'line-aligned'],
      // Disallow using `&&` inside JSX expression containers (fixable)
      'local/no-jsx-logical-expression': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**', 'jest.setup.js'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
]);
