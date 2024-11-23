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
    ...compat.extends('plugin:perfectionist/recommended-natural-legacy'),

    // TypeScript-specific configuration
    {
        files: ['*.ts', '*.tsx'],
        languageOptions: {
            ecmaVersion: 2020,
            parser: tsParser,
            sourceType: 'module',
        },
        rules: {
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
        files: ['*.tsx', '*.jsx'],
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
        },
        plugins: {
            import: require('eslint-plugin-import'),
            perfectionist: require('eslint-plugin-perfectionist'),
            react: require('eslint-plugin-react'),
            'react-hooks': require('eslint-plugin-react-hooks'),
            regexp: require('eslint-plugin-regexp'),
            'unused-imports': require('eslint-plugin-unused-imports'),
        },
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-var-requires': 'off',
        },
    },

    // General configuration
    {
        plugins: {
            perfectionist: require('eslint-plugin-perfectionist'),
            react: require('eslint-plugin-react'),
            'react-hooks': require('eslint-plugin-react-hooks'),
            regexp: require('eslint-plugin-regexp'),
            'unused-imports': require('eslint-plugin-unused-imports'),
        },
        rules: {
            '@typescript-eslint/ban-ts-comment': 'off', // TODO maybe turn it on one day
            '@typescript-eslint/no-empty-object-type': 'warn',
            '@typescript-eslint/no-explicit-any': 'off', // TODO maybe turn it on one day
            '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn', // TODO maybe turn it on one day
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-unused-vars': 'warn',
            'array-bracket-spacing': ['warn', 'never'],
            'arrow-parens': ['warn', 'always'],
            camelcase: 'off',
            'comma-dangle': [
                'error',
                {
                    arrays: 'always-multiline',
                    exports: 'always-multiline',
                    functions: 'never',
                    imports: 'always-multiline',
                    objects: 'always-multiline',
                },
            ],
            'consistent-return': 'off',
            curly: ['error', 'all'],
            'default-case': 'warn',
            eqeqeq: ['error', 'always'],
            indent: ['warn', 4, { SwitchCase: 1 }],
            'key-spacing': ['warn', { afterColon: true, beforeColon: false }],
            'max-len': 'off',
            'max-params': ['warn', 4],
            'no-confusing-arrow': ['warn', { allowParens: true }],
            'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
            'no-multi-spaces': 'error',
            'no-nested-ternary': 'warn',
            'no-shadow': 'off',
            'no-useless-escape': 'warn',
            'object-curly-spacing': ['warn', 'always'],
            'operator-linebreak': [
                'error',
                'before',
                {
                    overrides: {
                        '&&': 'before',
                        '=': 'none',
                        '||': 'before',
                    },
                },
            ],
            'perfectionist/sort-classes': [
                'warn',
                { ignoreCase: true, order: 'asc', type: 'natural' },
            ],
            'perfectionist/sort-imports': [
                'warn',
                { ignoreCase: true, order: 'asc', type: 'natural' },
            ],
            'prefer-destructuring': ['warn', { array: false, object: true }],
            'quote-props': ['warn', 'as-needed'],
            quotes: ['warn', 'single', { avoidEscape: true }],
            'react-hooks/exhaustive-deps': 'warn',
            'react/jsx-curly-spacing': ['warn', { children: true, when: 'never' }],
            'react/jsx-first-prop-new-line': ['warn', 'multiline'],
            'react/jsx-max-props-per-line': ['warn', { when: 'multiline' }],
            'react/react-in-jsx-scope': 'off',
            semi: ['error', 'always'],
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
        },
        settings: {
            'import/ignore': ['react-navigation'],
            'import/resolver': {
                typescript: {
                    project: path.resolve(__dirname, 'tsconfig.json'),
                },
            },
            react: {
                version: 'detect',
            },
        },
    },
];
