module.exports = function (api) {
  api.cache(true);
  let plugins = [];

  // WatermelonDB decorator support
  plugins.push(['@babel/plugin-proposal-decorators', { legacy: true }]);
  plugins.push(['@babel/plugin-proposal-class-properties', { loose: true }]);

  plugins.push('react-native-reanimated/plugin');

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],

    plugins,
  };
};
