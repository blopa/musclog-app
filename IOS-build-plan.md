# iOS Build Preparation Plan

This document outlines the steps required to prepare the Musclog app for a successful iOS build and App Store submission. Currently, the app is heavily optimized for Android, especially regarding health data integration and system-level widgets.

## 1. Configuration Changes (`app.json`)

The `ios` section in `app.json` needs to be expanded to include necessary permissions and entitlements.

### 1.1. HealthKit Integration

To support Apple Health, we must add the HealthKit entitlement and usage descriptions.

```json
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "com.werules.logger",
  "buildNumber": "177",
  "entitlements": {
    "com.apple.developer.healthkit": true,
    "com.apple.developer.healthkit.access": []
  },
  "infoPlist": {
    "NSHealthShareUsageDescription": "Allow $(PRODUCT_NAME) to read your health data (weight, height, activity) to sync with your fitness logs.",
    "NSHealthUpdateUsageDescription": "Allow $(PRODUCT_NAME) to write your workouts and nutrition data to Apple Health.",
    "NSCameraUsageDescription": "Allow $(PRODUCT_NAME) to access your camera to scan barcodes and take food photos.",
    "NSMicrophoneUsageDescription": "Allow $(PRODUCT_NAME) to access your microphone (required by camera module).",
    "NSPhotoLibraryUsageDescription": "Allow $(PRODUCT_NAME) to access your photos to upload food images."
  }
}
```

### 1.2. Plugin Management

Some plugins like `react-native-android-widget` are Android-only. While Expo usually handles this, we should ensure they don't interfere with the iOS build process.

## 2. Dependency Management (`package.json`)

The current health integration relies on `react-native-health-connect`, which is Android-only. The files for Health Connect must probably contain *.android.ts(x) extensions and then have the `@kingstinct/react-native-healthkit` (https://kingstinct.com/react-native-healthkit/) extension installed and create the same files with *.ios.ts(x) extensions using the ios package.

### 2.1. Add iOS Health Library

We need to add a library for iOS HealthKit.

```bash
npx expo install @kingstinct/react-native-healthkit
```

## 3. Code Architecture & Platform Abstraction

To support both platforms cleanly, we should abstract platform-specific logic.

### 3.1. Health Service Abstraction

Currently, `services/healthConnect.ts` is Android-specific. We should:

1. Rename `services/healthConnect.ts` to `services/healthConnect.android.ts`.
2. Create `services/healthConnect.ios.ts` to implement the same interface for Apple Health.
3. Create a unified `services/healthService.ts` that exports the correct implementation based on the platform.

### 3.2. UI Adjustments

- **System Bars**: We are already using `react-native-edge-to-edge`. Ensure it behaves correctly on notched iOS devices.
- **Widgets**: The `widgets/` directory contains Android Widget logic. We should ensure these files are ignored or stubbed for iOS builds.
- **Keyboard Handling**: iOS requires `KeyboardAvoidingView` or `react-native-keyboard-controller` (which is already present) to handle the layout when the keyboard is visible.

## 4. Implementation Details

### 4.1. Health Data Mapping

Create a mapper for HealthKit data to Musclog's internal format, similar to `healthDataTransform.ts`.

### 4.2. Settings UI

Update `components/modals/BasicSettingsModal.tsx` to show "Apple Health" instead of "Health Connect" when running on iOS.

```tsx
// Example change in BasicSettingsModal.tsx
const healthDataLabel = Platform.select({
  ios: t('settings.basicSettings.appleHealth'),
  android: t('settings.basicSettings.healthConnect'),
  default: t('settings.basicSettings.healthData'),
});
```

## 5. Build & Submission Checklist

1. **App Icons**: Ensure all required iOS icon sizes are present in `assets/`.
2. **Splash Screen**: Verify `splash.png` looks good on all iPhone/iPad aspect ratios.
3. **Sentry**: Verify iOS dSYM uploading is configured in `eas.json`.
4. **Provisioning**: Ensure Apple Developer Portal is configured with the correct Bundle ID and HealthKit capabilities.

## 6. Files Requiring Changes

- `app.json`: Add iOS configurations.
- `package.json`: Add `react-native-health`.
- `services/healthConnect.ts` -> `services/healthConnect.android.ts`.
- `services/healthKit.ios.ts`: (New file) Apple Health implementation.
- `services/healthDataSync.ts`: Update to use the unified health service.
- `components/modals/BasicSettingsModal.tsx`: Update labels for iOS.
- `app/_layout.tsx`: Update boot-time sync logic for iOS.

---

**Plan Status**: Draft
