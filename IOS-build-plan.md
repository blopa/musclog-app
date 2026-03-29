# iOS Build & Release Plan (Musclog)

This document is a **technical runbook** for shipping the Musclog app on iOS. It is grounded in the current codebase (Expo SDK **54**, React Native **0.81**, bundle ID **`com.werules.logger`**, EAS project id in `app.json` → `extra.eas.projectId`) and in Expo / Apple's current tooling.

**Goal:** produce installable iOS binaries (simulator, device, TestFlight, App Store) and reach **feature parity** with Android where the product requires it—especially **health sync**, which today is implemented only for **Android Health Connect**.

**Last Updated:** March 29, 2026

---

## Table of Contents

1. [Current Project Status](#1-current-project-status)
2. [Prerequisites & Accounts](#2-prerequisites--accounts)
3. [Technical Architecture Changes](#3-technical-architecture-changes)
4. [Step-by-Step Implementation](#4-step-by-step-implementation)
5. [App Configuration](#5-app-configuration)
6. [HealthKit Integration](#6-healthkit-integration)
7. [Build & Release Process](#7-build--release-process)
8. [Testing & QA](#8-testing--qa)
9. [App Store Submission](#9-app-store-submission)
10. [Post-Launch](#10-post-launch)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Current Project Status

### 1.1 Already in Place

| Area | Status | Notes |
|------|--------|-------|
| Expo / RN stack | ✅ Ready | `expo` 54, `expo-router`, Hermes, NativeWind, WatermelonDB — all platform-agnostic |
| `app.json` → `ios` | ✅ Configured | `bundleIdentifier: "com.werules.logger"`, `buildNumber: "178"`, `supportsTablet: true` |
| `npm run ios` | ✅ Wired | `expo run:ios` is configured in `package.json` |
| EAS | ✅ Ready | `eas.json` exists with `development` / `preview` / `production` profiles |
| Sentry | ✅ Ready | `@sentry/react-native` + `metro.config.js` uses `getSentryExpoConfig` |
| Native modules with iOS code | ✅ Ready | `rn-mlkit-ocr` ships an `ios/` tree with Expo config plugin |
| Android-only config plugins | ⚠️ Verified | `expo-health-connect` and `react-native-android-widget` are Android-scoped and won't block iOS builds |

### 1.2 Gaps to Address for iOS Release

| Priority | Item | Complexity | Effort |
|----------|------|------------|--------|
| 🔴 Critical | **HealthKit Implementation** | High | 3-5 days |
| 🔴 Critical | **Notification boot path fix** | Low | 2-4 hours |
| 🟡 High | **iOS-specific UI copy & translations** | Medium | 1-2 days |
| 🟡 High | **Info.plist privacy descriptions** | Low | 2-3 hours |
| 🟢 Medium | **iOS build scripts in package.json** | Low | 30 min |
| 🟢 Medium | **Advanced settings iOS implementation** | Low | 2-3 hours |
| 🔵 Low | **iOS Widgets (WidgetKit)** | High | 1-2 weeks |

---

## 2. Prerequisites & Accounts

### 2.1 Development Environment Requirements

| Tool | Minimum Version | Recommended | Notes |
|------|-----------------|-------------|-------|
| Node.js | 20.19.4 | 22.x | Expo SDK 54 requirement |
| Xcode | 16.1 | 16.2+ | For local builds only |
| EAS CLI | 18.1.0+ | Latest | `npm install -g eas-cli` |
| iOS Deployment Target | 15.1 | 16.0 | Your choice: iOS 16+ |

### 2.2 Apple Developer Program

**Status:** ✅ You confirmed enrollment is ready

**Required Capabilities to Enable:**
- [ ] HealthKit (for health data sync)
- [ ] Push Notifications (for workout/nutrition reminders)
- [ ] App Groups (if adding widgets later)

**Steps:**
1. Log into [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Find/Create App ID: `com.werules.logger`
4. Enable **HealthKit** capability
5. Enable **Push Notifications** capability (if using remote notifications)

### 2.3 EAS Configuration

```bash
# Verify EAS CLI version
eas --version  # Should be >= 18.1.0

# Login to Expo account
eas login

# Verify project linking
eas project:info  # Should show projectId: 7a194e96-295d-44a1-8324-78e776fe0807
```

---

## 3. Technical Architecture Changes

### 3.1 Health Platform Abstraction

The current architecture has Android-only health implementation. We need to create a platform-agnostic abstraction:

```
services/
├── health/                          # NEW: Platform-agnostic health folder
│   ├── types.ts                     # NEW: Shared types and interfaces
│   ├── errors.ts                    # NEW: Unified error handling
│   └── index.ts                     # NEW: Platform selector export
├── healthConnect.android.ts         # RENAME: from healthConnect.ts
├── healthConnectFitness.android.ts  # RENAME: from healthConnectFitness.ts
├── healthConnectNutrition.android.ts# RENAME: from healthConnectNutrition.ts
├── healthConnectWorkout.android.ts  # RENAME: from healthConnectWorkout.ts
├── healthConnectErrors.ts           # KEEP: Rename to healthErrors.ts
├── healthDataSync.ts                # MODIFY: Use platform abstraction
├── healthDataTransform.ts           # KEEP: Shared transformation logic
├── healthKit.ios.ts                 # NEW: iOS HealthKit implementation
├── healthKitFitness.ios.ts          # NEW: iOS fitness metrics
├── healthKitNutrition.ios.ts        # NEW: iOS nutrition sync
└── healthKitWorkout.ios.ts          # NEW: iOS workout write
```

### 3.2 Metro Platform Resolution

Metro automatically resolves `.ios.ts` and `.android.ts` files:

```typescript
// services/health/index.ts
export * from './healthConnect';  // Resolves to .android.ts or .ios.ts
```

### 3.3 Files Requiring Platform Guards

Current files with `Platform.OS === 'android'` checks:

| File | Line(s) | Action Required |
|------|---------|-----------------|
| `app/_layout.tsx` | 117-146 | Extend to include iOS for notifications and health sync |
| `services/healthConnect.ts` | 102-104 | Rename to `.android.ts`, create iOS version |
| `services/healthConnectWorkout.ts` | 124 | Rename to `.android.ts`, create iOS version |
| `hooks/useHealthConnectPermissions.ts` | 64-67, 207-209 | Update to handle both platforms |
| `components/modals/AdvancedSettingsModal.tsx` | 124-134 | Implement iOS settings path |

---

## 4. Step-by-Step Implementation

### Phase 1: Project Setup (Day 1)

#### 4.1.1 Add iOS Build Scripts

```json
// package.json → scripts
{
  "build-ios": "eas build -p ios --profile production --clear-cache",
  "build-ios-preview": "eas build -p ios --profile preview --clear-cache",
  "build-ios-dev": "eas build -p ios --profile development --clear-cache",
  "submit-ios": "eas submit --platform ios",
  "prebuild-ios": "expo prebuild -p ios --clean",
  "run-ios": "expo run:ios",
  "run-ios-device": "expo run:ios --device"
}
```

#### 4.1.2 Install HealthKit Dependencies

```bash
# Primary HealthKit library with Expo config plugin
npx expo install @kingstinct/react-native-healthkit

# Required peer dependency
npx expo install react-native-nitro-modules

# For react-native-health alternative (if needed)
# npx expo install react-native-health
```

#### 4.1.3 Update eas.json for iOS

```json
{
  "cli": {
    "version": ">= 18.1.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true,
      "ios": {
        "image": "macos-sequoia-15.3-xcode-16.2"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Phase 2: App Configuration (Day 1-2)

#### 4.2.1 Update app.json

```json
{
  "expo": {
    "name": "Musclog - Lift, Log, Repeat",
    "slug": "logger",
    "version": "2.5.4",
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.werules.logger",
      "buildNumber": "178",
      "deploymentTarget": "16.0",
      "infoPlist": {
        "NSHealthShareUsageDescription": "Musclog reads your health data to sync workouts, nutrition, weight, and body measurements for comprehensive fitness tracking.",
        "NSHealthUpdateUsageDescription": "Musclog writes your workout sessions, nutrition logs, and body metrics to Apple Health to keep all your health data in sync.",
        "NSCameraUsageDescription": "Allow Musclog to access your camera to scan barcodes and take photos of food for nutrition tracking.",
        "NSPhotoLibraryUsageDescription": "Allow Musclog to access your photos to select food images and exercise demonstrations.",
        "NSMicrophoneUsageDescription": "Allow Musclog to access your microphone for voice features (if applicable).",
        "NSUserNotificationUsageDescription": "Allow Musclog to send you workout reminders, nutrition check-ins, and rest timer alerts.",
        "UIBackgroundModes": [
          "fetch",
          "remote-notification"
        ]
      }
    },
    "plugins": [
      "react-native-edge-to-edge",
      "./plugins/withAndroidBarcodeScannerFix",
      "expo-localization",
      "expo-router",
      "expo-health-connect",
      [
        "expo-notifications",
        {
          "icon": "./assets/images/notification-icon.png",
          "color": "#ffffff",
          "defaultChannel": "default",
          "enableBackgroundRemoteNotifications": false
        }
      ],
      [
        "expo-camera",
        {
          "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera",
          "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone",
          "recordAudioAndroid": false
        }
      ],
      [
        "@sentry/react-native/expo",
        {
          "organization": "werules",
          "project": "workout"
        }
      ],
      "expo-font",
      "expo-sqlite",
      "react-native-health-connect",
      [
        "@kingstinct/react-native-healthkit",
        {
          "NSHealthShareUsageDescription": "Musclog reads your health data to sync workouts, nutrition, weight, and body measurements for comprehensive fitness tracking.",
          "NSHealthUpdateUsageDescription": "Musclog writes your workout sessions, nutrition logs, and body metrics to Apple Health to keep all your health data in sync."
        }
      ],
      [
        "expo-build-properties",
        {
          "android": {
            "minSdkVersion": 26
          },
          "ios": {
            "deploymentTarget": "16.0"
          },
          "gradleProperties": {
            "org.gradle.jvmargs": "-Xmx4g -XX:MaxMetaspaceSize=1g -Dkotlin.daemon.jvm.options=-Xmx2g"
          }
        }
      ],
      "expo-background-task",
      "expo-web-browser",
      "@react-native-community/datetimepicker",
      [
        "rn-mlkit-ocr",
        {
          "ocrModels": ["latin"],
          "ocrUseBundled": true
        }
      ],
      [
        "expo-asset",
        {
          "assets": ["./assets/exercises"]
        }
      ],
      [
        "react-native-android-widget",
        {
          "fonts": ["./assets/fonts/material.ttf"],
          "widgets": [
            {
              "name": "SmartCamera",
              "label": "Smart Camera",
              "minWidth": "60dp",
              "minHeight": "60dp",
              "targetCellWidth": 1,
              "targetCellHeight": 1,
              "description": "Open Smart Camera"
            },
            {
              "name": "Nutrition",
              "label": "Nutrition Progress",
              "minWidth": "180dp",
              "minHeight": "60dp",
              "targetCellWidth": 4,
              "targetCellHeight": 1,
              "description": "Shows daily nutrition progress"
            }
          ]
        }
      ]
    ]
  }
}
```

### Phase 3: HealthKit Implementation (Day 2-5)

#### 4.3.1 Create Health Types

```typescript
// services/health/types.ts

export enum HealthPlatformStatus {
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  INITIALIZING = 'INITIALIZING',
  AVAILABLE = 'AVAILABLE',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  NOT_INSTALLED = 'NOT_INSTALLED',
  ERROR = 'ERROR',
}

export interface HealthPermission {
  resourceType: string;
  accessType: 'read' | 'write';
}

export interface TimeRangeFilter {
  startTime: number; // Unix timestamp
  endTime: number;   // Unix timestamp
}

export interface SyncResult {
  recordsRead: number;
  recordsWritten: number;
  recordsSkipped: number;
  errors: HealthError[];
}

export class HealthError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable: boolean = false,
    public originalError?: Error
  ) {
    super(message);
  }

  getUserMessage(): string {
    // Return localized error message
    return this.message;
  }
}

// Health data types supported by both platforms
export enum HealthMetricType {
  WEIGHT = 'weight',
  HEIGHT = 'height',
  BODY_FAT = 'body_fat',
  LEAN_BODY_MASS = 'lean_body_mass',
  NUTRITION = 'nutrition',
  WORKOUT = 'workout',
  CALORIES_ACTIVE = 'calories_active',
  CALORIES_BASAL = 'calories_basal',
  CALORIES_TOTAL = 'calories_total',
}
```

#### 4.3.2 Implement HealthKit Service (iOS)

```typescript
// services/healthKit.ios.ts

import {
  requestAuthorization,
  getAuthorizationStatus,
  readQuantitySamples,
  writeQuantitySample,
  readCategorySamples,
  type HKQuantityTypeIdentifier,
  type HKCategoryTypeIdentifier,
  type HKAuthorizationStatus,
} from '@kingstinct/react-native-healthkit';
import { Platform } from 'react-native';
import { HealthPlatformStatus, HealthPermission, type TimeRangeFilter } from './health/types';

class HealthKitService {
  private status: HealthPlatformStatus = HealthPlatformStatus.NOT_INITIALIZED;

  async initialize(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      this.status = HealthPlatformStatus.NOT_SUPPORTED;
      return false;
    }

    try {
      this.status = HealthPlatformStatus.INITIALIZING;
      
      // Check if HealthKit is available
      const authStatus = await getAuthorizationStatus('HKQuantityTypeIdentifierBodyMass');
      
      this.status = HealthPlatformStatus.AVAILABLE;
      return true;
    } catch (error) {
      console.error('HealthKit initialization failed:', error);
      this.status = HealthPlatformStatus.ERROR;
      return false;
    }
  }

  async requestPermissions(permissions: HealthPermission[]): Promise<{ granted: HealthPermission[]; denied: HealthPermission[] }> {
    // Map generic permissions to HealthKit identifiers
    const toRead: HKQuantityTypeIdentifier[] = [];
    const toWrite: HKQuantityTypeIdentifier[] = [];

    for (const perm of permissions) {
      const hkType = this.mapToHealthKitType(perm.resourceType);
      if (hkType) {
        if (perm.accessType === 'read') {
          toRead.push(hkType);
        } else {
          toWrite.push(hkType);
        }
      }
    }

    try {
      await requestAuthorization(toRead, toWrite);
      
      // Check actual granted permissions
      const granted: HealthPermission[] = [];
      const denied: HealthPermission[] = [];

      for (const perm of permissions) {
        const hkType = this.mapToHealthKitType(perm.resourceType);
        if (hkType) {
          const status = await getAuthorizationStatus(hkType);
          if (status === 'sharingAuthorized') {
            granted.push(perm);
          } else {
            denied.push(perm);
          }
        }
      }

      return { granted, denied };
    } catch (error) {
      console.error('HealthKit permission request failed:', error);
      return { granted: [], denied: permissions };
    }
  }

  async readWeight(timeRange: TimeRangeFilter): Promise<Array<{ value: number; date: number; unit: string }>> {
    try {
      const samples = await readQuantitySamples('HKQuantityTypeIdentifierBodyMass', {
        from: new Date(timeRange.startTime),
        to: new Date(timeRange.endTime),
      });

      return samples.map(sample => ({
        value: sample.quantity, // in kg
        date: sample.startDate.getTime(),
        unit: 'kg',
      }));
    } catch (error) {
      console.error('Failed to read weight from HealthKit:', error);
      return [];
    }
  }

  async writeWeight(value: number, date: number): Promise<boolean> {
    try {
      await writeQuantitySample('HKQuantityTypeIdentifierBodyMass', 'kg', value, new Date(date));
      return true;
    } catch (error) {
      console.error('Failed to write weight to HealthKit:', error);
      return false;
    }
  }

  // Similar methods for height, bodyFat, leanBodyMass, nutrition, workouts...

  private mapToHealthKitType(resourceType: string): HKQuantityTypeIdentifier | null {
    const mapping: Record<string, HKQuantityTypeIdentifier> = {
      'weight': 'HKQuantityTypeIdentifierBodyMass',
      'height': 'HKQuantityTypeIdentifierHeight',
      'body_fat': 'HKQuantityTypeIdentifierBodyFatPercentage',
      'lean_body_mass': 'HKQuantityTypeIdentifierLeanBodyMass',
      'calories_active': 'HKQuantityTypeIdentifierActiveEnergyBurned',
      'calories_basal': 'HKQuantityTypeIdentifierBasalEnergyBurned',
    };
    return mapping[resourceType] || null;
  }

  getStatus(): HealthPlatformStatus {
    return this.status;
  }
}

export const healthKitService = new HealthKitService();
```

#### 4.3.3 Create Platform Abstraction

```typescript
// services/health/index.ts

import { Platform } from 'react-native';
import { healthConnectService } from '../healthConnect';
import { healthKitService } from '../healthKit';
import type { HealthPermission, TimeRangeFilter, HealthPlatformStatus } from './types';

// Re-export types
export * from './types';

// Platform-specific service
export const healthPlatformService = Platform.select({
  ios: healthKitService,
  android: healthConnectService,
  default: null,
});

// Unified interface
export async function initializeHealth(): Promise<boolean> {
  return healthPlatformService?.initialize() ?? Promise.resolve(false);
}

export async function requestHealthPermissions(permissions: HealthPermission[]) {
  return healthPlatformService?.requestPermissions(permissions) ?? Promise.resolve({ granted: [], denied: permissions });
}

export async function readWeight(timeRange: TimeRangeFilter) {
  return healthPlatformService?.readWeight(timeRange) ?? Promise.resolve([]);
}

export async function writeWeight(value: number, date: number) {
  return healthPlatformService?.writeWeight(value, date) ?? Promise.resolve(false);
}

// ... other unified functions
```

#### 4.3.4 Update app/_layout.tsx

```typescript
// app/_layout.tsx - Update the boot-time effect

// Boot-time tasks (Android + iOS, all run in parallel)
useEffect(() => {
  if (Platform.OS === 'web') {
    return;
  }

  const notificationInit = NotificationService.configure()
    .then(async () => {
      // Schedule notifications on both platforms
      NotificationService.scheduleWorkoutReminders();
      NotificationService.scheduleNutritionOverview();
      NotificationService.scheduleMenstrualCycleNotifications();
      NotificationService.scheduleCheckinNotifications();

      // Dismiss any orphaned workout notification from a previous killed session
      const activeWorkoutLogId = await getActiveWorkoutLogId();
      if (!activeWorkoutLogId) {
        NotificationService.dismissActiveWorkoutNotification();
      }
    })
    .catch((err) => console.warn('[NotificationService] Init error:', err));

  // Platform-specific health sync
  const healthSync = Platform.select({
    android: () =>
      healthDataSyncService
        .syncFromHealthConnect({ lookbackDays: 7 })
        .catch((err) => console.warn('[boot sync] Health Connect sync error:', err)),
    ios: () =>
      healthDataSyncService
        .syncFromHealthKit({ lookbackDays: 7 })
        .catch((err) => console.warn('[boot sync] HealthKit sync error:', err)),
    default: () => Promise.resolve(),
  })();

  Promise.all([
    healthSync,
    configureDailyTasks().catch((err) =>
      console.warn('[configureDailyTasks] Startup error:', err)
    ),
    notificationInit,
  ]);
}, []);
```

### Phase 4: UI & Translation Updates (Day 5-6)

#### 4.4.1 Add iOS-Specific Translations

```json
// lang/locales/en-us/healthKit.json
{
  "healthKit": {
    "title": "Apple Health",
    "connectYour": "Connect your",
    "health": "Health",
    "description": "Sync your fitness data with Apple Health to get a complete picture of your wellness journey.",
    "allowHealthAccess": "Allow Access to Health",
    "initializing": "Initializing Apple Health...",
    "syncing": "Syncing health data...",
    "processing": "Processing...",
    "continue": "Continue",
    "maybeLater": "Maybe Later",
    "privacyStatement": "Your health data is encrypted and stored securely. We never share your data with third parties.",
    "connectedCount": "Connected ({{granted}}/{{total}})",
    "categories": {
      "nutrition": "Nutrition",
      "weight": "Weight",
      "sleep": "Sleep",
      "vitals": "Vitals"
    },
    "errors": {
      "notAvailable": "Apple Health is not available on this device",
      "permissionDenied": "Permission denied. Please enable access in Settings > Health > Data Access & Devices.",
      "syncFailed": "Failed to sync health data. Please try again."
    }
  }
}
```

#### 4.4.2 Create Platform-Aware Health Screen

```typescript
// hooks/useHealthPermissions.ts (renamed from useHealthConnectPermissions)

import { Platform } from 'react-native';
import { useHealthConnectPermissions } from './useHealthConnectPermissions';
import { useHealthKitPermissions } from './useHealthKitPermissions';

export function useHealthPermissions() {
  return Platform.select({
    ios: useHealthKitPermissions,
    android: useHealthConnectPermissions,
    default: () => ({
      status: 'NOT_SUPPORTED',
      isAvailable: false,
      // ... default values
    }),
  })();
}
```

### Phase 5: Settings & Advanced Features (Day 6-7)

#### 4.5.1 Update AdvancedSettingsModal

```typescript
// components/modals/AdvancedSettingsModal.tsx

const handleOpenAppSettings = useCallback(async () => {
  try {
    await Linking.openSettings();
  } catch (err) {
    console.error('Failed to open settings:', err);
    showSnackbar('error', t('settings.advancedSettings.openSettingsFailedMessage'));
  }
}, [t, showSnackbar]);

// Remove the Platform.OS === 'android' check - iOS supports Linking.openSettings()
```

---

## 5. App Configuration

### 5.1 Info.plist Privacy Descriptions

| Key | Description | Current Status |
|-----|-------------|----------------|
| `NSHealthShareUsageDescription` | Why we read health data | ⚠️ Needs to be added |
| `NSHealthUpdateUsageDescription` | Why we write health data | ⚠️ Needs to be added |
| `NSCameraUsageDescription` | Camera access for barcode/food photos | ✅ Already in expo-camera plugin |
| `NSPhotoLibraryUsageDescription` | Photo library access | ⚠️ Verify in generated Info.plist |
| `NSUserNotificationUsageDescription` | Push notification permission | ⚠️ Add for iOS clarity |

### 5.2 Required iOS Capabilities

| Capability | Purpose | Configuration |
|------------|---------|---------------|
| HealthKit | Read/write health data | Via `@kingstinct/react-native-healthkit` plugin |
| Push Notifications | Workout/nutrition reminders | Via `expo-notifications` plugin |
| Background Modes | Background fetch for sync | Add to Info.plist |

### 5.3 App Icon & Assets

Ensure these assets exist for iOS:

```
assets/
├── icon.png                    # 1024x1024, used for App Store
├── splash.png                  # Already configured
├── adaptive-icon.png           # Android only
├── favicon.png                 # Web only
└── images/
    └── notification-icon.png   # Required for iOS notifications
```

**iOS-specific icon requirements:**
- App Store: 1024x1024px PNG
- iPhone: 180x180px (60pt @3x), 120x120px (60pt @2x)
- iPad: 167x167px (83.5pt @2x), 152x152px (76pt @2x)

Expo handles generation via `expo prebuild`.

---

## 6. HealthKit Integration

### 6.1 Data Type Mapping

| Musclog Metric | Health Connect (Android) | HealthKit (iOS) |
|----------------|--------------------------|-----------------|
| Weight | `Weight` | `HKQuantityTypeIdentifierBodyMass` |
| Height | `Height` | `HKQuantityTypeIdentifierHeight` |
| Body Fat % | `BodyFat` | `HKQuantityTypeIdentifierBodyFatPercentage` |
| Lean Body Mass | `LeanBodyMass` | `HKQuantityTypeIdentifierLeanBodyMass` |
| Active Calories | `ActiveCaloriesBurned` | `HKQuantityTypeIdentifierActiveEnergyBurned` |
| Basal Calories | `BasalMetabolicRate` | `HKQuantityTypeIdentifierBasalEnergyBurned` |
| Nutrition | `Nutrition` | `HKQuantityTypeIdentifierDietaryEnergyConsumed` + macros |
| Workout | `ExerciseSession` | `HKWorkoutType` |

### 6.2 Permission Requirements

```typescript
// Required HealthKit permissions for full parity
const REQUIRED_HEALTHKIT_PERMISSIONS = {
  read: [
    'HKQuantityTypeIdentifierBodyMass',           // Weight
    'HKQuantityTypeIdentifierHeight',             // Height
    'HKQuantityTypeIdentifierBodyFatPercentage',  // Body Fat
    'HKQuantityTypeIdentifierLeanBodyMass',       // Lean Body Mass
    'HKQuantityTypeIdentifierActiveEnergyBurned', // Active Calories
    'HKQuantityTypeIdentifierBasalEnergyBurned',  // Basal Calories
    'HKQuantityTypeIdentifierDietaryEnergyConsumed', // Nutrition - Calories
    'HKQuantityTypeIdentifierDietaryProtein',     // Nutrition - Protein
    'HKQuantityTypeIdentifierDietaryCarbohydrates', // Nutrition - Carbs
    'HKQuantityTypeIdentifierDietaryFatTotal',    // Nutrition - Fat
    'HKQuantityTypeIdentifierDietaryFiber',       // Nutrition - Fiber
    'HKWorkoutType',                              // Workouts
  ],
  write: [
    'HKQuantityTypeIdentifierBodyMass',
    'HKQuantityTypeIdentifierHeight',
    'HKQuantityTypeIdentifierBodyFatPercentage',
    'HKQuantityTypeIdentifierLeanBodyMass',
    'HKQuantityTypeIdentifierDietaryEnergyConsumed',
    'HKQuantityTypeIdentifierDietaryProtein',
    'HKQuantityTypeIdentifierDietaryCarbohydrates',
    'HKQuantityTypeIdentifierDietaryFatTotal',
    'HKQuantityTypeIdentifierDietaryFiber',
    'HKWorkoutType',
  ],
};
```

### 6.3 Sync Strategy

| Direction | Android Health Connect | iOS HealthKit |
|-----------|------------------------|---------------|
| Read (Import) | Full sync on boot + background | Full sync on boot + background fetch |
| Write (Export) | Real-time on save | Real-time on save |
| Conflict Resolution | External ID-based | UUID-based with timestamp |
| Deletion | Soft delete in DB, remove from Health | Soft delete in DB, remove from Health |

---

## 7. Build & Release Process

### 7.1 Development Build

```bash
# Create a development build for testing
npm run build-ios-dev

# Or with specific flags
eas build -p ios --profile development --clear-cache
```

### 7.2 Preview Build (Internal Testing)

```bash
# Create a preview build for TestFlight internal testing
npm run build-ios-preview

# Monitor build status
eas build:list
```

### 7.3 Production Build

```bash
# Create production build
npm run build-ios

# The build will:
# 1. Run expo prebuild -p ios
# 2. Install pods
# 3. Build with Xcode 16.2
# 4. Sign with Apple Developer certificates
# 5. Produce .ipa file
```

### 7.4 Automatic Credentials Management

EAS handles credentials automatically:

```bash
# View/manage credentials
eas credentials

# For iOS, this manages:
# - Distribution certificate
# - Provisioning profile (App Store or Ad Hoc)
# - Push notification key (if needed)
```

### 7.5 Build Troubleshooting

| Issue | Solution |
|-------|----------|
| `ITMS-90725: SDK version issue` | Ensure `eas.json` uses Xcode 16+ image |
| `Provisioning profile expired` | Run `eas credentials` and regenerate |
| `HealthKit capability not enabled` | Enable in Apple Developer Portal, rebuild |
| `Pod install fails` | Delete `ios/` directory, run `expo prebuild -p ios --clean` |
| `Metro bundler errors` | Run `npm run start-clear` to clear cache |

---

## 8. Testing & QA

### 8.1 Simulator Testing

```bash
# Run on iOS simulator
npm run ios

# Or specific simulator
expo run:ios --simulator="iPhone 16 Pro"
```

**Limitations:**
- HealthKit does NOT work on simulator
- Camera/barcode scanning requires physical device
- Push notifications have limited functionality

### 8.2 Physical Device Testing

**Required for:**
- HealthKit integration
- Camera/OCR features
- Barcode scanning
- Push notifications
- Performance testing

**Steps:**
1. Register device UDID in Apple Developer Portal
2. Create development provisioning profile
3. Build with development profile
4. Install via TestFlight or direct install

### 8.3 QA Checklist

#### Pre-Build Checks
- [ ] `npx expo-doctor` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run lint:all` passes
- [ ] `npm run check-translations` passes

#### Core Functionality
- [ ] App launches without crashes
- [ ] Onboarding flow completes
- [ ] Theme switching works
- [ ] Language switching works
- [ ] Unit conversion (metric/imperial) works

#### Health Integration
- [ ] HealthKit permission request shows
- [ ] Weight sync (read/write) works
- [ ] Height sync works
- [ ] Body fat sync works
- [ ] Nutrition sync works
- [ ] Workout export works
- [ ] Sync status indicators show correctly

#### Notifications
- [ ] Permission request shows
- [ ] Workout reminders schedule
- [ ] Nutrition overview schedules
- [ ] Rest timer notifications work
- [ ] Active workout notification works

#### Data Management
- [ ] Database export works
- [ ] Database import works
- [ ] Settings persist across launches

#### Edge Cases
- [ ] Deny HealthKit permissions - app works gracefully
- [ ] Deny notification permissions - app works gracefully
- [ ] Offline mode - app works
- [ ] Background/foreground transitions
- [ ] Dark mode appearance

---

## 9. App Store Submission

### 9.1 App Store Connect Setup

1. Log into [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps**
3. Click **+** → **New App**
4. Fill in:
   - **Platforms:** iOS
   - **Name:** Musclog - Lift, Log, Repeat
   - **Primary Language:** English (US)
   - **Bundle ID:** com.werules.logger
   - **SKU:** musclog-001
   - **User Access:** Full access

### 9.2 App Information

| Field | Value |
|-------|-------|
| **Name** | Musclog - Lift, Log, Repeat |
| **Subtitle** | Track workouts & nutrition |
| **Category** | Health & Fitness |
| **Secondary Category** | Lifestyle |
| **Content Rights** | Does not contain third-party content |
| **Age Rating** | 12+ (Infrequent/Mild Medical/Treatment Information) |

### 9.3 Pricing and Availability

| Setting | Value |
|---------|-------|
| **Price** | Free |
| **Availability** | All countries/regions |
| **Pre-orders** | No |

### 9.4 Privacy Nutrition Labels

**Data Types to Declare:**

| Data Type | Usage | Linked to Identity |
|-----------|-------|-------------------|
| Health & Fitness | App functionality | No |
| Photos | App functionality | No |
| Crash Data | Analytics | No |
| Performance Data | Analytics | No |
| User ID | App functionality | Yes |

### 9.5 App Review Information

| Field | Value |
|-------|-------|
| **Sign-in required?** | No |
| **Demo account** | N/A |
| **Notes for reviewer** | HealthKit integration requires physical device testing. The app syncs workout and nutrition data with Apple Health. |

### 9.6 Submission via EAS Submit

```bash
# Submit to App Store Connect
npm run submit-ios

# Or with specific build
 eas submit -p ios --id "<build-id>"
```

### 9.7 App Review Guidelines Compliance

**HealthKit-specific requirements:**
- [ ] App provides health/fitness functionality (✅ Yes - workout tracking)
- [ ] Privacy policy explains health data usage (✅ Already in app)
- [ ] HealthKit data is not used for advertising (✅ No ads in app)
- [ ] HealthKit data is not shared with third parties (✅ Local only)
- [ ] App does not write false data to HealthKit (✅ Only user-entered data)

---

## 10. Post-Launch

### 10.1 Monitoring

| Tool | Purpose |
|------|---------|
| Sentry | Crash reporting and error tracking |
| App Store Connect | Download metrics, ratings, reviews |
| EAS Dashboard | Build status, updates |

### 10.2 OTA Updates

```bash
# Publish OTA update for JS-only changes
 eas update --branch production --message "Bug fixes"
```

**Note:** Native code changes (HealthKit, new libraries) require full rebuild.

### 10.3 Version Management

| Scenario | Action |
|----------|--------|
| JS-only bug fix | `eas update` |
| New native feature | Increment `version` in app.json, rebuild |
| iOS-specific fix | Increment `buildNumber` in app.json, rebuild |

---

## 11. Troubleshooting

### 11.1 Common Build Errors

**Error: `No signing certificate "iOS Distribution" found`**
```bash
# Solution: Let EAS manage credentials
eas build -p ios --clear-credentials
```

**Error: `HealthKit is not enabled`**
```bash
# Solution: Enable in Apple Developer Portal, then:
eas build -p ios --clear-cache
```

**Error: `ITMS-90683: Missing Purpose String in Info.plist`**
```bash
# Solution: Add NSHealthShareUsageDescription to app.json plugins
# See Section 4.2.1 for configuration
```

### 11.2 HealthKit Issues

**Issue: HealthKit permissions not showing**
- Ensure testing on physical device (simulator doesn't support HealthKit)
- Verify `NSHealthShareUsageDescription` is in Info.plist
- Check Apple Developer Portal has HealthKit capability enabled

**Issue: HealthKit data not syncing**
- Check authorization status with `getAuthorizationStatus()`
- Verify time range filters are correct (HealthKit uses Date objects)
- Check for errors in Sentry

### 11.3 Notification Issues

**Issue: Notifications not showing on iOS**
- Request permissions with `Notifications.requestPermissionsAsync()`
- Check notification settings in iOS Settings app
- Verify `enableBackgroundRemoteNotifications` is set correctly

### 11.4 Performance Issues

**Issue: Slow app startup**
- Profile with React Native DevTools (press 'j' in terminal)
- Check for unnecessary re-renders
- Verify WatermelonDB queries are optimized

---

## Quick Command Reference

| Command | Purpose |
|---------|---------|
| `npm run ios` | Local dev build (needs Mac) |
| `npm run build-ios` | Production EAS build |
| `npm run build-ios-preview` | TestFlight preview build |
| `npm run submit-ios` | Submit to App Store |
| `npx expo prebuild -p ios` | Generate native iOS project |
| `eas credentials` | Manage signing certificates |
| `eas build:list` | View build history |
| `npx expo-doctor` | Check project health |
| `npm run lint:all` | Full linting suite |

---

## Resources

- [Expo iOS Build Documentation](https://docs.expo.dev/build-reference/ios-builds/)
- [Apple HealthKit Documentation](https://developer.apple.com/documentation/healthkit)
- [@kingstinct/react-native-healthkit](https://kingstinct.com/react-native-healthkit/)
- [EAS Build iOS Capabilities](https://docs.expo.dev/build-reference/ios-capabilities/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

---

**Plan Status:** Ready for implementation

**Next Steps:**
1. ✅ Prerequisites confirmed (Apple Developer account ready)
2. ⏳ Install HealthKit dependencies
3. ⏳ Implement platform abstraction
4. ⏳ Create iOS build
5. ⏳ Test on physical device
6. ⏳ Submit to App Store
