const path = require('path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');

const config = getSentryExpoConfig(__dirname);

config.resolver.assetExts = [...(config.resolver.assetExts ?? []), 'wasm'];

// Sharp is a Node-only native module; stub it so Metro never tries to load it.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'sharp' || moduleName.startsWith('sharp/')) {
    return {
      filePath: path.resolve(__dirname, 'sharp-stub.js'),
      type: 'sourceFile',
    };
  }

  // The blog loaders are web-only (they read Markdown with `node:fs/promises`), but they still
  // reach the native graph: expo-router's native require.context matches the `blog/*.web.tsx`
  // route files, and Metro resolves their `await import()` statically. See blog-posts-server-stub.js.
  if (platform !== 'web' && /(^|\/)blogPosts\.server$/.test(moduleName)) {
    return {
      filePath: path.resolve(__dirname, 'blog-posts-server-stub.js'),
      type: 'sourceFile',
    };
  }

  // Mermaid is imported dynamically by the blog post route (web only), but Metro resolves that
  // `import()` statically on native too. Stub it so the diagram library stays out of the app bundle.
  if (platform !== 'web' && (moduleName === 'mermaid' || moduleName.startsWith('mermaid/'))) {
    return {
      filePath: path.resolve(__dirname, 'mermaid-stub.js'),
      type: 'sourceFile',
    };
  }

  // VisionCamera throws on import under web. See vision-camera-web-stub.js.
  if (platform === 'web' && moduleName === 'react-native-vision-camera') {
    return {
      filePath: path.resolve(__dirname, 'vision-camera-web-stub.js'),
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
