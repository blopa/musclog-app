module.exports = function (api) {
  api.cache(true);

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: [
      ['@babel/plugin-transform-runtime', { helpers: false }],
      'react-native-reanimated/plugin',
    ],
    overrides: [
      {
        // WatermelonDB legacy decorators require TypeScript → decorators → class-properties.
        // isTSX:true is safe here; the codebase uses `as` casts, not legacy `<T>foo` assertions.
        test: (filename) => filename != null && /\.tsx?$/.test(filename),
        plugins: [
          [
            '@babel/plugin-transform-typescript',
            { allowDeclareFields: true, allowNamespaces: true, isTSX: true },
          ],
          ['@babel/plugin-proposal-decorators', { legacy: true }],
          ['@babel/plugin-transform-class-properties', { loose: true }],
          ['@babel/plugin-transform-private-methods', { loose: true }],
        ],
      },
      {
        // React Native JS source uses #privateMethod syntax.
        test: (filename) => filename != null && /\.(js|jsx)$/.test(filename),
        plugins: [['@babel/plugin-transform-private-methods', { loose: true }]],
      },
    ],
  };
};
