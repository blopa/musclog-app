import * as ImagePicker from 'expo-image-picker';
import type { RefObject } from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { CameraViewRef } from '@/components/CameraView';
import { openCropperAsync } from '@/utils/file';
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
  /** JPEG quality for the gallery crop re-encode step and the gallery picker. */
  quality: number;
  /** Receives the raw photo path on shutter capture, or the cropped path on gallery pick. */
  process: (fileUri: string) => Promise<void>;
};

/**
 * The shared capture pipeline behind the smart-camera modals.
 *
 * A shutter capture goes straight to `process` with NO crop step. Opening the native crop tool
 * has a ~20s+ one-time-per-process stall on some devices (fresh Pixel 10 / Android 17 — see the
 * Camera notes in AGENTS.md), and a photo the user just framed live through the camera rarely
 * needs re-cropping anyway. A gallery pick still goes through the crop UI (`cropAndProcess`),
 * since an existing photo usually does need framing and the user chose that path deliberately.
 *
 * A cancelled crop (gallery only) ends the flow silently; real failures log and show the
 * camera-error snackbar. Camera-session concerns (the silent warm-up capture, one capture in
 * flight at a time) are owned by the CameraView wrapper itself.
 */
export function useCameraCaptureFlow({ cameraRef, quality, process }: UseCameraCaptureFlowOptions) {
  const { t } = useTranslation();

  /** Returns whether `process` was actually invoked (false if the crop was cancelled). */
  const cropAndProcess = useCallback(
    async (imageUri: string): Promise<boolean> => {
      const startedAt = Date.now();
      const cropped = await openCropperAsync({
        imageUri,
        format: 'jpeg',
        compressImageQuality: quality,
      });
      logPhase('crop step', startedAt);

      if (!cropped) {
        return false;
      }

      await process(cropped.path);
      return true;
    },
    [quality, process]
  );

  /**
   * Captures a photo and sends it straight to `process` — no crop tool on the camera path (see
   * the hook docstring for why). Returns whether `process` was invoked; false only on a camera
   * error. There is no crop to cancel here, so a successful capture always processes.
   */
  const takePicture = useCallback(async (): Promise<boolean> => {
    if (!cameraRef.current) {
      return false;
    }

    try {
      const startedAt = Date.now();
      const photo = await cameraRef.current.takePictureAsync();
      logPhase('shutter capture', startedAt);
      await process(photo.uri);
      return true;
    } catch (error) {
      console.error('Error taking picture:', error);
      showSnackbar('error', t('food.aiCamera.cameraError'));
      return false;
    }
  }, [cameraRef, process, t]);

  const pickFromGallery = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showSnackbar('error', t('food.aiCamera.galleryPermissionRequired'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality,
        base64: false,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      try {
        await cropAndProcess(result.assets[0].uri);
      } catch (error) {
        console.error('Error cropping gallery image:', error);
        showSnackbar('error', t('food.aiCamera.cameraError'));
      }
    } catch (error) {
      console.error('Error picking image from gallery:', error);
      showSnackbar('error', t('food.aiCamera.galleryError'));
    }
  }, [quality, cropAndProcess, t]);

  return { takePicture, pickFromGallery };
}
