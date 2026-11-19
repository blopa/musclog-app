import { useSyncExternalStore } from 'react';

import { readHasCamera } from '@/utils/cameraAvailability';

type VisionCamera = typeof import('react-native-vision-camera');

/**
 * `react-native-vision-camera` reads its native module while it is being imported, so it is
 * required on first use (inside a try/catch via `readHasCamera`) instead of at the top of a file
 * that half the app imports.
 */
function visionCamera(): VisionCamera['Camera'] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('react-native-vision-camera') as VisionCamera).Camera;
}

function getSnapshot(): boolean {
  return readHasCamera(() => visionCamera().getAvailableCameraDevices());
}

function subscribe(onChange: () => void): () => void {
  try {
    const subscription = visionCamera().addCameraDevicesChangedListener(onChange);

    return () => subscription.remove();
  } catch {
    return () => {};
  }
}

/**
 * Whether the device has a camera. Every camera call to action (the navigation button, scan
 * buttons, AI photo, receiving from another phone) is shown only while this is true.
 *
 * This is hardware, not permission: a camera the person has not allowed yet still counts, because
 * the camera screen asks for it. Reactive, since a USB camera can be attached to a tablet.
 * Web always reports true (`useHasCamera.web.ts`).
 */
export function useHasCamera(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
