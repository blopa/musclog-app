import AsyncStorage from '@react-native-async-storage/async-storage';

// expo-camera's useCameraPermissions hook calls Camera.getCameraPermissionsAsync()
// on mount, which can take ~10s on the first call in production builds (TurboModule
// lazy init on Android). SmartCameraContext keeps useCameraPermissions alive for the
// lifetime of the app so the warm-up cost is paid at boot, not when the camera opens.
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
