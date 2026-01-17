module.exports = function (api) {
  // Detect platform from caller BEFORE calling api.cache()
  const isWeb = api.caller((caller) => {
    return (
      caller?.platform === 'web' ||
      caller?.name === 'metro-web' ||
      process.env.EXPO_PLATFORM === 'web' ||
      process.env.BABEL_ENV === 'web'
    );
  });

  api.cache(true);

  const plugins = [['@babel/plugin-proposal-decorators', { legacy: true }]];

  // Only use loose: true for web platform (required for decorators with definite assignment)
  // For mobile (iOS/Android), loose: false is required to avoid expo-router errors
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
