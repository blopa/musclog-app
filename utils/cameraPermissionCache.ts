import AsyncStorage from '@react-native-async-storage/async-storage';

// Originally written around expo-camera's useCameraPermissions hook, whose
// Camera.getCameraPermissionsAsync() could take ~10s on the first call in production
// builds (TurboModule lazy init on Android). react-native-vision-camera's equivalent
// (Camera.getCameraPermissionStatus()) is synchronous, so that specific cold-start cost
// no longer applies — but this cache is left in place as a harmless optimistic-UI layer
// (avoids a one-frame flash of the "grant permission" screen before the first
// permission check settles) and to keep the pattern available if a native permission
// check ever gets slow again. SmartCameraContext keeps useCameraPermissions mounted for
// the lifetime of the app regardless.
//
// This module handles Layer 1: persist the granted flag to AsyncStorage so that
// getCachedCameraPermissionGranted() is readable synchronously at the time the
// context initialises its optimistic permission state. No native calls happen here.

const CACHE_KEY = 'camera_permission_granted_v1';

let cachedGranted: boolean | null = null;

// Start the disk read immediately so cachedGranted is populated before any component
// reads it synchronously via getCachedCameraPermissionGranted().
const storageReadPromise: Promise<boolean | null> = AsyncStorage.getItem(CACHE_KEY)
  .then((value) => {
    if (value === 'true') {
      cachedGranted = true;
    } else if (value === 'false') {
      cachedGranted = false;
    }

    return cachedGranted;
  })
  .catch(() => null);

export function getCachedCameraPermissionGranted(): boolean | null {
  return cachedGranted;
}

// Awaitable variant for when the synchronous read returns null (component mounted
// before the AsyncStorage promise resolved).
export function waitForCachedCameraPermissionGranted(): Promise<boolean | null> {
  return storageReadPromise;
}

export function setCachedCameraPermissionGranted(granted: boolean): void {
  if (cachedGranted === granted) {
    return;
  }

  cachedGranted = granted;
  AsyncStorage.setItem(CACHE_KEY, granted ? 'true' : 'false').catch(() => {});
}
