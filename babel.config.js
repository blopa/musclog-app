module.exports = function (api) {
  api.cache(true);
  let plugins = [];

  plugins.push('expo-router/babel');
  plugins.push('react-native-reanimated/plugin');

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],

    plugins,
  };
};
