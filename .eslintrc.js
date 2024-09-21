module.exports = {
    extends: [
        'expo',
        'plugin:react/recommended',
        'plugin:react-native/all',
        'plugin:import/recommended',
        'plugin:regexp/recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    overrides: [
        {
            files: ['*.js', '*.jsx'],
            plugins: [
                'react',
                'react-native',
                'unused-imports',
                'perfectionist',
                'regexp',
                'react-hooks',
            ],
            rules: {
                '@typescript-eslint/no-unused-vars': 'off',
                '@typescript-eslint/no-var-requires': 'off',
            },
        },
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        ecmaVersion: 2020,
        sourceType: 'module',
    },
    plugins: [
        'react',
        'react-native',
        'unused-imports',
        'perfectionist',
        'regexp',
        'react-hooks',
        '@typescript-eslint',
    ],
    rules: {
        '@typescript-eslint/ban-ts-comment': 'off', // TODO maybe turn it on one day
        '@typescript-eslint/no-explicit-any': 'off', // TODO maybe turn it on one day
        '@typescript-eslint/no-non-null-asserted-optional-chain': 'off', // TODO maybe turn it on one day
        '@typescript-eslint/no-unused-vars': ['warn', { args: 'after-used', argsIgnorePattern: '^_', vars: 'all', varsIgnorePattern: '^_' }],
        'arrow-parens': ['warn', 'always'],
        indent: ['warn', 4, { SwitchCase: 1 }],
        'object-curly-spacing': ['warn', 'always'],
        'quote-props': ['warn', 'as-needed'],
        quotes: ['warn', 'single', { avoidEscape: true }],
        'react/react-in-jsx-scope': 'off',
        'react-hooks/exhaustive-deps': 'warn',
        // 'react-hooks/exhaustive-deps': ['warn', { enableDangerousAutofixThisMayCauseInfiniteLoops: true }],
        'react-native/no-color-literals': 'off',
        'react-native/no-inline-styles': 'warn',
        'react-native/no-raw-text': 'error',
        'react-native/no-unused-styles': 'off',
        'unused-imports/no-unused-imports': 'error',
        'unused-imports/no-unused-vars': ['warn', { args: 'after-used', argsIgnorePattern: '^_', vars: 'all', varsIgnorePattern: '^_' }],
        'perfectionist/sort-classes': ['warn', { type: 'alphabetical', order: 'asc', ignoreCase: true }],
        'perfectionist/sort-imports': ['warn', { type: 'alphabetical', order: 'asc', ignoreCase: true }],
    },
    settings: {
        'import/ignore': ['react-navigation', 'react-native'],
        react: {
            version: 'detect'
        }
    },
};
