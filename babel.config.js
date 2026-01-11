module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: [
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ['@babel/plugin-transform-class-properties', { loose: true }],
      // ONLY use the reanimated plugin.
      // In the new versions, it automatically handles the worklets logic.
      'react-native-reanimated/plugin',
    ],
  };
};
