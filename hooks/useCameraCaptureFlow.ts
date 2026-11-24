import type { RefObject } from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { CameraViewRef } from '@/components/CameraView';
import { openCropperAsync } from '@/utils/file';
import { pickImagesFromGallery } from '@/utils/galleryImagePicker';
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
  /** Receives the cropped image path. Called once per image, in pick order. */
  process: (fileUri: string) => Promise<void>;
  /**
   * How many images one gallery pick may return (default 1). Each picked image goes through the
   * crop tool in turn; a cancelled crop drops only that image.
   */
  gallerySelectionLimit?: number;
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
export function useCameraCaptureFlow({
  cameraRef,
  quality,
  process,
  gallerySelectionLimit = 1,
}: UseCameraCaptureFlowOptions) {
  const { t } = useTranslation();

  const crop = useCallback(
    async (imageUri: string): Promise<string | null> => {
      const startedAt = Date.now();
      const cropped = await openCropperAsync({
        imageUri,
        format: 'jpeg',
        compressImageQuality: quality,
      });
      logPhase('crop step', startedAt);

      return cropped?.path ?? null;
    },
    [quality]
  );

  const cropAndProcess = useCallback(
    async (imageUri: string): Promise<void> => {
      const cropped = await crop(imageUri);

      if (!cropped) {
        return;
      }

      await process(cropped);
    },
    [crop, process]
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
      // No media-library permission request: pickImagesFromGallery uses the modern system photo
      // picker (Android ACTION_PICK_IMAGES / iOS PHPicker), which returns only the user-picked
      // item through a temporary content grant. Skipping the request also removes an Expo async
      // call from the single shared `modulesQueue` thread whose boot-time saturation is the real
      // stall (see the SecureStore/queue notes in AGENTS.md).
      //
      // Time the picker call itself. This span includes the user browsing/selecting, so a large
      // value is only a red flag when the picker was slow to *appear* (the reported symptom:
      // the picker UI not showing for ~25s on the first pick after a cold boot).
      const pickerStartedAt = Date.now();
      const uris = await pickImagesFromGallery(gallerySelectionLimit);
      logPhase('gallery picker', pickerStartedAt);

      if (uris.length === 0) {
        return;
      }

      // Crop every image first, then hand them over: `process` may open a sheet, and the next
      // crop tool must not be presented over it.
      const cropped: string[] = [];
      let failed = false;
      for (const uri of uris) {
        try {
          const path = await crop(uri);
          if (path) {
            cropped.push(path);
          }
        } catch (error) {
          console.error('Error cropping gallery image:', error);
          failed = true;
          break;
        }
      }

      try {
        for (const path of cropped) {
          await process(path);
        }
      } catch (error) {
        console.error('Error processing gallery image:', error);
        failed = true;
      }

      if (failed) {
        showSnackbar('error', t('food.aiCamera.cameraError'));
      }
    } catch (error) {
      console.error('Error picking image from gallery:', error);
      showSnackbar('error', t('food.aiCamera.galleryError'));
    }
  }, [crop, gallerySelectionLimit, process, t]);

  return { takePicture, pickFromGallery };
}
