module.exports = {
  dependencies: {
    // Excluded from Android: incompatible with RN 0.76+ (ReactAndroid::reactnativejni removed).
    // iOS keeps native linking — it uses ONNX Runtime which works on arm64 simulators.
    // Android uses rn-mlkit-ocr instead (see OcrService.android.ts).
    '@gutenye/ocr-react-native': {
      platforms: {
        android: null,
      },
    },
  },
};
