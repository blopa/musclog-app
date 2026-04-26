# Barcode Scanner iOS Research

Date: 2026-04-25

## Goal

Implement the iOS TODO in `utils/barcodeScanner.ios.ts` for scanning barcodes from an image file, because the existing package setup used for web and Android was not working as the iOS solution.

## Result

The TODO was implemented using `@react-native-ml-kit/barcode-scanning`.

This package was chosen because it supports scanning a barcode from a static image URI on both iOS and Android, which matches the app's current `detectBarcodes(imageUri)` abstraction.

## What Was Implemented

- Added `@react-native-ml-kit/barcode-scanning` to `package.json`
- Implemented `utils/barcodeScanner.ios.ts`
- Kept the return shape aligned with current app behavior:
  - scan a local image URI
  - filter to common product barcode formats
  - return the first detected barcode string or `null`

## Implemented iOS Logic

The iOS implementation now:

- imports `BarcodeScanning` from `@react-native-ml-kit/barcode-scanning`
- calls `BarcodeScanning.scan(imageUri)`
- filters to:
  - `EAN_13`
  - `EAN_8`
  - `UPC_A`
  - `UPC_E`
- returns the first non-empty barcode value

## Why This Package Was Selected

The library exposes a direct image-scanning API:

```ts
const barcodes = await BarcodeScanning.scan(imageURL);
```

That is a much closer fit for this project than introducing a separate full camera stack just to read a barcode from an already-captured image.

## Verification Performed

- Confirmed the package exports a `scan(imageURL)` API and barcode type definitions
- Confirmed the package includes:
  - an iOS podspec
  - Android native sources
  - React Native native module wiring
- Confirmed TypeScript passed after integration:

```bash
npx tsc --noEmit --skipLibCheck
```

## Expo / Prebuild Findings

### Main conclusion

No custom Expo config plugin is required for `@react-native-ml-kit/barcode-scanning`.

### Why

This package is a standard React Native native module:

- iOS integration is via CocoaPods
- Android integration is via native Gradle + React Native package autolinking

Expo prebuild already contains generic autolinking hooks for React Native native modules, so packages like this normally do not create visible changes in:

- `app.json`
- `ios/Podfile`
- `android/app/build.gradle`

Instead, the existing autolinking infrastructure discovers the module from `package.json` and links it into the generated native project.

### Important nuance

Not seeing obvious changes in app-owned native files does **not** mean the package was ignored.

In this repo:

- `android/settings.gradle` already contains Expo/React Native autolinking setup
- `android/app/build.gradle` already calls `autolinkLibrariesWithApp()`
- `ios/Podfile` already calls `use_native_modules!(...)`

### Concrete checks performed

Expo autolinking CLI detected `@react-native-ml-kit/barcode-scanning` on both platforms:

- iOS: found `RNMLKitBarcodeScanning.podspec`
- Android: found the Android native module and package entry

### iOS caveat

There was no `ios/Podfile.lock` in the local workspace during this review.

That means the most visible CocoaPods proof of installation was not present yet in this Linux environment. In practice, the pod resolution still needs to happen on a Mac build machine or through the usual iOS build flow.

## Why Searching for `com.google.mlkit` in App Native Files Can Be Misleading

Searching only inside the app-owned `ios/` and `android/` folders may show nothing new even when autolinking is working correctly.

For this package, the interesting dependency declarations live in the installed package itself:

- `node_modules/@react-native-ml-kit/barcode-scanning/android/build.gradle`
- `node_modules/@react-native-ml-kit/barcode-scanning/RNMLKitBarcodeScanning.podspec`

Specifically:

- Android depends on `com.google.mlkit:barcode-scanning:17.3.0`
- iOS depends on `GoogleMLKit/BarcodeScanning`

## Important Distinction: ML Kit Image Scanning vs Google Code Scanner Activity

This turned out to be the key source of confusion.

There are two different Android barcode approaches involved in this repo:

### 1. The new package used for this iOS TODO

`@react-native-ml-kit/barcode-scanning` uses the on-device ML Kit barcode API directly on an image.

Its Android code uses:

- `InputImage`
- `BarcodeScanning.getClient()`
- `scanner.process(image)`

This is the correct fit for scanning from an existing image URI.

### 2. A separate scanner path already used by `expo-camera`

`expo-camera` also includes support for Google's Code Scanner / Play Services based scanner flow on Android.

That path uses:

- `GmsBarcodeScanning`
- `GmsBarcodeScannerOptions`
- `play-services-code-scanner`

This is a different integration path from the one used by `@react-native-ml-kit/barcode-scanning`.

## The Custom Plugin Idea That Was Discussed

The following custom Expo config plugin was proposed as a possibility:

```js
const { withAndroidManifest } = require('@expo/config-plugins');

const withAndroidBarcodeScannerFix = (config) => {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];

    // Find if the activity already exists to avoid duplicates
    const activities = mainApplication.activity || [];
    const activityName =
      'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';

    const exists = activities.some((activity) => activity.$['android:name'] === activityName);

    if (!exists) {
      if (!mainApplication.activity) {
        mainApplication.activity = [];
      }

      mainApplication.activity.push({
        $: {
          'android:name': activityName,
          'android:screenOrientation': 'unspecified',
          'tools:replace': 'android:screenOrientation',
          'tools:node': 'merge',
        },
      });

      // Ensure tools namespace is present in manifest
      if (!config.modResults.manifest.$['xmlns:tools']) {
        config.modResults.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
      }
    }

    return config;
  });
};

module.exports = withAndroidBarcodeScannerFix;
```

## Conclusion About That Plugin

That custom plugin is **not needed** for `@react-native-ml-kit/barcode-scanning`.

### Why not

The activity name in that plugin:

`com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity`

belongs to the Google Code Scanner / delegated scanning activity flow, not to the static-image ML Kit barcode package we added.

The new image-scanning package:

- does not declare or require that activity
- does not use the Google Code Scanner delegate activity API
- uses ML Kit image processing directly instead

### Precise answer

- No, this plugin is not needed for the newly added iOS image barcode implementation using `@react-native-ml-kit/barcode-scanning`
- Yes, a plugin like this could still be relevant in a different context if the project needs to patch `expo-camera`'s Android Google Code Scanner integration specifically

So this plugin should not be treated as part of the fix for the iOS TODO that was implemented here.

## Notes About `expo-camera`

Local inspection showed that `expo-camera` already includes Android barcode-related dependencies and manifest metadata for its own scanner flows.

That is separate from the new package added for image-based iOS scanning.

This distinction matters:

- `expo-camera` Android scanner behavior does not imply the new iOS image scanner needs an Expo config plugin
- the new iOS implementation is independent of that delegated scanner activity path

## Source Links

### Package and repo

- https://www.npmjs.com/package/@react-native-ml-kit/barcode-scanning
- https://github.com/a7medev/react-native-ml-kit/tree/main/barcode-scanning

### Expo docs

- https://docs.expo.dev/modules/autolinking/
- https://docs.expo.dev/config-plugins/introduction/
- https://docs.expo.dev/workflow/prebuild

### Google docs

- https://developers.google.com/android/reference/com/google/mlkit/vision/barcode/BarcodeScanning
- https://developers.google.com/android/reference/com/google/mlkit/vision/codescanner/GmsBarcodeScanning
- https://developers.google.com/ml-kit/vision/barcode-scanning/code-scanner

## Local File References Reviewed

- `utils/barcodeScanner.ios.ts`
- `utils/barcodeScanner.ts`
- `utils/file.ts`
- `utils/file.web.ts`
- `components/modals/SmartCameraModal.tsx`
- `package.json`
- `app.json`
- `ios/Podfile`
- `android/settings.gradle`
- `android/app/build.gradle`
- `node_modules/@react-native-ml-kit/barcode-scanning/index.ts`
- `node_modules/@react-native-ml-kit/barcode-scanning/README.md`
- `node_modules/@react-native-ml-kit/barcode-scanning/RNMLKitBarcodeScanning.podspec`
- `node_modules/@react-native-ml-kit/barcode-scanning/android/build.gradle`
- `node_modules/@react-native-ml-kit/barcode-scanning/android/src/main/AndroidManifest.xml`
- `node_modules/@react-native-ml-kit/barcode-scanning/android/src/main/java/com/rnmlkit/barcodescanning/BarcodeScanningModule.java`
- `node_modules/@react-native-ml-kit/barcode-scanning/android/src/main/java/com/rnmlkit/barcodescanning/BarcodeScanningPackage.java`
- `node_modules/expo-camera/android/build.gradle`
- `node_modules/expo-camera/android/src/main/AndroidManifest.xml`
- `node_modules/expo-camera/android/src/main/java/expo/modules/camera/CameraViewModule.kt`

## Practical Follow-up

For iOS builds, CocoaPods still needs to run on the Mac build environment so the pod is actually resolved into the iOS project.

Expected practical flow:

```bash
npm install
npx expo prebuild
cd ios && pod install
```

Or use the equivalent native/EAS build flow that runs CocoaPods as part of the build.
