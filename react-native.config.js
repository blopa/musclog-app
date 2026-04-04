module.exports = {
  dependencies: {
    // Excluded: incompatible with RN 0.76+ (ReactAndroid::reactnativejni removed).
    // OcrServiceShared.ts uses a dynamic require() with a try-catch fallback.
    '@gutenye/ocr-react-native': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
