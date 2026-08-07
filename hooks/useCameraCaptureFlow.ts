import type { RefObject } from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { CameraViewRef } from '@/components/CameraView';
import { openCropperAsync } from '@/utils/file';
import { pickImageFromGallery } from '@/utils/galleryImagePicker';
import { showSnackbar } from '@/utils/snackbarService';

/** Barcode photos tolerate more compression than AI photos, which need legible label text. */
export const BARCODE_PHOTO_QUALITY = 0.8;
export const AI_PHOTO_QUALITY = 0.85;

// Deliberately not __DEV__-gated: the shutter-latency regression this instruments only ever
// reproduced in release builds, where these lines are readable via `adb logcat` (ReactNativeJS)
// on a locally installed release APK (`npm run build-android-apk-local`).
const logPhase = (label: string, startedAt: number) => {
  console.log(`[CameraCaptureFlow] ${label}: ${Date.now() - startedAt}ms`);
};

type UseCameraCaptureFlowOptions = {
  cameraRef: RefObject<CameraViewRef | null>;
  /**
   * JPEG quality for the crop re-encode — the only lossy step on either path
   * (`pickImageFromGallery` deliberately picks uncompressed, and the shutter photo itself isn't
   * recompressed before the crop).
   */
  quality: number;
  /** Receives the cropped image path. */
  process: (fileUri: string) => Promise<void>;
};

/**
 * The shared capture pipeline behind the smart-camera modals. Both entry points — a shutter
 * capture and a gallery pick — end in the same crop UI, so the user can trim the shot before it
 * is analysed and `process` only ever sees a cropped image.
 *
 * A cancelled crop ends the flow silently; real failures log and show the camera-error snackbar.
 * Camera-session concerns (the silent warm-up capture, one capture in flight at a time) are owned
 * by the CameraView wrapper itself.
 */
export function useCameraCaptureFlow({ cameraRef, quality, process }: UseCameraCaptureFlowOptions) {
  const { t } = useTranslation();

  const cropAndProcess = useCallback(
    async (imageUri: string): Promise<void> => {
      const startedAt = Date.now();
      const cropped = await openCropperAsync({
        imageUri,
        format: 'jpeg',
        compressImageQuality: quality,
      });
      logPhase('crop step', startedAt);

      if (!cropped) {
        return;
      }

      await process(cropped.path);
    },
    [quality, process]
  );

  /** Captures a photo and routes it through the same crop UI as a gallery pick. */
  const takePicture = useCallback(async (): Promise<void> => {
    if (!cameraRef.current) {
      return;
    }

    try {
      // No phase log here: CameraView's own reportShutterOutcome already times the shutter and
      // reports the path + fallback breakdown (to logcat and Sentry), so a second timer here
      // would just duplicate the weaker half of that signal.
      const photo = await cameraRef.current.takePictureAsync();
      await cropAndProcess(photo.uri);
    } catch (error) {
      console.error('Error taking picture:', error);
      showSnackbar('error', t('food.aiCamera.cameraError'));
    }
  }, [cameraRef, cropAndProcess, t]);

  const pickFromGallery = useCallback(async () => {
    try {
      // No media-library permission request: pickImageFromGallery uses the modern system photo
      // picker (Android ACTION_PICK_IMAGES / iOS PHPicker), which returns only the user-picked
      // item through a temporary content grant. Skipping the request also removes an Expo async
      // call from the single shared `modulesQueue` thread whose boot-time saturation is the real
      // stall (see the SecureStore/queue notes in AGENTS.md).
      //
      // Time the picker call itself. This span includes the user browsing/selecting, so a large
      // value is only a red flag when the picker was slow to *appear* (the reported symptom:
      // the picker UI not showing for ~25s on the first pick after a cold boot).
      const pickerStartedAt = Date.now();
      const uri = await pickImageFromGallery();
      logPhase('gallery picker', pickerStartedAt);

      if (!uri) {
        return;
      }

      try {
        await cropAndProcess(uri);
      } catch (error) {
        console.error('Error cropping gallery image:', error);
        showSnackbar('error', t('food.aiCamera.cameraError'));
      }
    } catch (error) {
      console.error('Error picking image from gallery:', error);
      showSnackbar('error', t('food.aiCamera.galleryError'));
    }
  }, [cropAndProcess, t]);

  return { takePicture, pickFromGallery };
}
