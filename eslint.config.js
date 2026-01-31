/* eslint-env node */
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// Local plugin with custom rules
const localRulesPlugin = require('./eslint-rules');
const simpleImportSort = require('eslint-plugin-simple-import-sort');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'coverage/**'],
  },
  {
    plugins: {
      local: localRulesPlugin,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'react/display-name': 'off',
      'react/jsx-closing-bracket-location': ['warn', 'line-aligned'],
      // Disallow using `&&` inside JSX expression containers (fixable)
      'local/no-jsx-logical-expression': 'error',
      // Require lazy imports for conditionally rendered components (fixable)
      'local/prefer-react-lazy': 'warn',
      // Sort and group imports
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',
      // turn off other conflicting sort rules
      'sort-imports': 'off',
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
