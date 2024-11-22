const { FlatCompat } = require('@eslint/eslintrc');
const tsParser = require('@typescript-eslint/parser');
const path = require('path');
const compat = new FlatCompat();

module.exports = [
    // Handle legacy "extends" using FlatCompat
    ...compat.extends('plugin:react/recommended'),
    ...compat.extends('plugin:import/recommended'),
    ...compat.extends('plugin:regexp/recommended'),
    ...compat.extends('plugin:@typescript-eslint/recommended'),

    // TypeScript-specific configuration
    {
        files: ['*.ts', '*.tsx'],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2020,
            sourceType: 'module',
        },
        rules: {
            '@typescript-eslint/ban-ts-comment': 'off', // TODO maybe turn it on one day
            '@typescript-eslint/no-explicit-any': 'off', // TODO maybe turn it on one day
            '@typescript-eslint/no-non-null-asserted-optional-chain': 'off', // TODO maybe turn it on one day
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                    vars: 'all',
                    varsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-var-requires': 'off',
        },
    },

    // JavaScript and JSX-specific configuration
    {
        files: ['*.js', '*.jsx'],
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
        },
        plugins: {
            react: require('eslint-plugin-react'),
            'react-hooks': require('eslint-plugin-react-hooks'),
            'unused-imports': require('eslint-plugin-unused-imports'),
            perfectionist: require('eslint-plugin-perfectionist'),
            regexp: require('eslint-plugin-regexp'),
            import: require('eslint-plugin-import'),
        },
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-var-requires': 'off',
        },
    },

    // General configuration
    {
        plugins: {
            react: require('eslint-plugin-react'),
            'react-hooks': require('eslint-plugin-react-hooks'),
            'unused-imports': require('eslint-plugin-unused-imports'),
            perfectionist: require('eslint-plugin-perfectionist'),
            regexp: require('eslint-plugin-regexp'),
        },
        rules: {
            'operator-linebreak': [
                'error',
                'before',
                {
                    overrides: {
                        '=': 'none',
                        '&&': 'before',
                        '||': 'before',
                    },
                },
            ],
            semi: ['error', 'always'],
            'no-multi-spaces': 'error',
            curly: ['error', 'all'],
            'consistent-return': 'off',
            'prefer-destructuring': ['warn', { object: true, array: false }],
            'no-confusing-arrow': ['warn', { allowParens: true }],
            'max-len': 'off',
            camelcase: 'off',
            'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
            eqeqeq: ['error', 'always'],
            'no-shadow': 'off',
            'array-bracket-spacing': ['warn', 'never'],
            'key-spacing': ['warn', { beforeColon: false, afterColon: true }],
            'no-useless-escape': 'warn',
            'no-nested-ternary': 'warn',
            'default-case': 'warn',
            'max-params': ['warn', 4],
            'react/jsx-first-prop-new-line': ['warn', 'multiline'],
            'react/jsx-max-props-per-line': ['warn', { when: 'multiline' }],
            'react/jsx-curly-spacing': ['warn', { when: 'never', children: true }],
            'arrow-parens': ['warn', 'always'],
            indent: ['warn', 4, { SwitchCase: 1 }],
            'object-curly-spacing': ['warn', 'always'],
            'quote-props': ['warn', 'as-needed'],
            quotes: ['warn', 'single', { avoidEscape: true }],
            'react/react-in-jsx-scope': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            'react-hooks/exhaustive-deps': 'warn',
            // 'react-hooks/exhaustive-deps': ['warn', { enableDangerousAutofixThisMayCauseInfiniteLoops: true }],
            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars': [
                'warn',
                {
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                    vars: 'all',
                    varsIgnorePattern: '^_',
                },
            ],
            'perfectionist/sort-classes': [
                'warn',
                { type: 'alphabetical', order: 'asc', ignoreCase: true },
            ],
            'perfectionist/sort-imports': [
                'warn',
                { type: 'alphabetical', order: 'asc', ignoreCase: true },
            ],
            'comma-dangle': [
                'error',
                {
                    arrays: 'always-multiline',
                    objects: 'always-multiline',
                    imports: 'always-multiline',
                    exports: 'always-multiline',
                    functions: 'never',
                },
            ],
        },
        settings: {
            'import/ignore': ['react-navigation'],
            'import/resolver': {
                typescript: {
                    project: path.resolve(__dirname, 'tsconfig.json'), // Points to your tsconfig.json
                },
            },
            react: {
                version: 'detect',
            },
        },
    },
];
