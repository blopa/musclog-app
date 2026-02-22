module.exports = function (api) {
  // Check caller before configuring cache
  const isWebFromCaller = api.caller(
    (caller) =>
      caller?.platform === 'web' || caller?.name === 'metro-web' || caller?.name === 'webpack'
  );

  api.cache(true);

  const isWeb =
    process.env.EXPO_PLATFORM === 'web' ||
    process.env.BABEL_ENV === 'web' ||
    process.env.WEBPACK_DEV_SERVER === 'true' ||
    isWebFromCaller;

  const plugins = [['@babel/plugin-proposal-decorators', { legacy: true }]];

  // Always use loose: true for web to handle definite assignment with decorators
  if (isWeb) {
    plugins.push(
      ['@babel/plugin-transform-class-properties', { loose: true }],
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-private-property-in-object', { loose: true }]
    );
  }

  // ONLY use the reanimated plugin.
  // In the new versions, it automatically handles the worklets logic.
  plugins.push('react-native-reanimated/plugin');

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins,
  };
};
