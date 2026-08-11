# Performance Optimization Findings

Based on the performance improvement suggestions from the Play Console, here are the findings and potential solutions for both issues.

## 1. Bitmap Image Optimization

**Issue:** The app is manually downloading and decoding images from the network in `com.rnmlkitocr.RnMlkitOcrModule.downloadBitmap`, which can lead to excessive memory usage, slow performance, and app crashes.

**Research Findings:**
- The issue originates from the third-party library `rn-mlkit-ocr` (version 0.3.1).
- Checking the source code of this package (`android/src/main/java/com/rnmlkitocr/RnMlkitOcrModule.kt`), the `downloadBitmap` function uses `HttpURLConnection` to download the image and `BitmapFactory.decodeStream(inputStream)` to decode it directly into memory.
- It does not use any downsampling, caching, or memory management (which an image loading library like Glide, Coil, or Picasso would provide).

**Can it be fixed via Expo Config?**
No. Since this code is part of a compiled third-party native Android module, it cannot be configured or fixed via Expo's configuration (`app.json`).

**Solution:**
Because you do not want to use `patch-package` to patch the library locally, the alternative solutions are:
1. **Upstream Fix:** Open an issue or a Pull Request on the `rn-mlkit-ocr` GitHub repository to implement an image loading library (like Coil or Glide) for network requests.
2. **Workaround in JS:** Avoid passing `http://` or `https://` URLs to the OCR service. Instead, download the image using Expo's `FileSystem` or `expo-image` on the JavaScript side (which handles caching and memory better), and pass the local file URI (`file://`) to the OCR module.

## 2. R8 Optimization

**Issue:** The app's memory and performance are not optimized with R8. Enabling R8 increases performance, reduces memory usage, and provides a smoother experience.

**Research Findings:**
- R8 is Android's default code shrinker and obfuscator.
- In Expo managed workflows (when using Prebuild / EAS Build), R8 minification is controlled by the `expo-build-properties` plugin.
- Inspecting `app.json`, the `expo-build-properties` plugin is currently configured for Android SDK versions and architectures, but it lacks the properties required to enable minification in release builds.

**Can it be fixed via Expo Config?**
**Yes.** This can be fixed directly in your Expo configuration without any patches.

**Solution:**
You can enable R8 optimization by adding `enableMinifyInReleaseBuilds` (and optionally `enableShrinkResourcesInReleaseBuilds`) to the `android` section of `expo-build-properties` in your `app.json`.

Update your `app.json` like this:

```json
[
  "expo-build-properties",
  {
    "android": {
      "minSdkVersion": 26,
      "buildArchs": ["armeabi-v7a", "arm64-v8a", "x86", "x86_64"],
      "enableMinifyInReleaseBuilds": true,
      "enableShrinkResourcesInReleaseBuilds": true
    },
    "ios": { ... }
  }
]
```

This configuration will tell the Gradle build system to run R8 during production builds, solving the warning.
