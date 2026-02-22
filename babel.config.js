module.exports = function (api) {
  api.cache(true);

  const plugins = [['@babel/plugin-proposal-decorators', { legacy: true }]];

  plugins.push(
    ['@babel/plugin-transform-class-properties', { loose: true }],
    ['@babel/plugin-transform-private-methods', { loose: true }],
    ['@babel/plugin-transform-private-property-in-object', { loose: true }]
  );

  // ONLY use the reanimated plugin.
  // In the new versions, it automatically handles the worklets logic.
  plugins.push('react-native-reanimated/plugin');

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins,
  };
};
