const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Sharp is a Node-only native module; stub it so Metro never tries to load it.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'sharp' || moduleName.startsWith('sharp/')) {
    return {
      filePath: path.resolve(__dirname, 'sharp-stub.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
