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
  /** JPEG quality for the crop re-encode step (shutter capture and gallery pick alike). */
  quality: number;
  /** Receives the cropped image path (shutter and gallery alike). */
  process: (fileUri: string) => Promise<void>;
};

/**
 * The shared capture pipeline behind the smart-camera modals: photo (shutter or gallery pick)
 * → crop UI → `process`. A cancelled crop ends the flow silently; real failures log and show
 * the camera-error snackbar. Camera-session concerns (the silent warm-up capture, one capture
 * in flight at a time) are owned by the CameraView wrapper itself.
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

  /** Returns whether `process` was actually invoked (false on camera error or cancelled crop). */
  const takePicture = useCallback(async (): Promise<boolean> => {
    if (!cameraRef.current) {
      return false;
    }

    try {
      const startedAt = Date.now();
      const photo = await cameraRef.current.takePictureAsync();
      logPhase('shutter capture', startedAt);
      return await cropAndProcess(photo.uri);
    } catch (error) {
      console.error('Error taking picture:', error);
      showSnackbar('error', t('food.aiCamera.cameraError'));
      return false;
    }
  }, [cameraRef, cropAndProcess, t]);

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
