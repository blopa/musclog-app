import type { CameraView } from 'expo-camera';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { openCropperAsync } from '@/utils/file';
import { showSnackbar } from '@/utils/snackbarService';

/** Barcode photos tolerate more compression than AI photos, which need legible label text. */
export const BARCODE_PHOTO_QUALITY = 0.8;
export const AI_PHOTO_QUALITY = 0.85;

const logPhase = (label: string, startedAt: number) => {
  if (__DEV__) {
    console.debug(`[CameraCaptureFlow] ${label}: ${Date.now() - startedAt}ms`);
  }
};

type UseCameraCaptureFlowOptions = {
  cameraRef: RefObject<CameraView | null>;
  /**
   * JPEG quality for the whole pipeline: the shutter capture (iOS only — see `skipProcessing`
   * below), the gallery pick, and the crop re-encode.
   */
  quality: number;
  /** Receives the cropped image path (shutter and gallery alike). */
  process: (fileUri: string) => Promise<void>;
  /**
   * True once expo-camera's `onCameraReady` has fired for the currently mounted camera view.
   * The first `takePictureAsync` call against a freshly bound camera session pays a one-off,
   * multi-second focus/exposure convergence cost on Android (CameraX only fully converges 3A —
   * autofocus/auto-exposure — on the first still-capture request of a session); every capture
   * after that in the same session is near-instant. That is the delay users saw *even after*
   * `skipProcessing` was added: skipProcessing only speeds up post-capture processing, not the
   * native capture itself. We pay the convergence cost once, silently, as soon as the camera
   * reports ready — before the user has framed their shot and reached for the shutter — instead
   * of making their first real tap absorb it.
   */
  cameraReady: boolean;
};

/**
 * The shared capture pipeline behind the smart-camera modals: photo (shutter or gallery pick)
 * → crop UI → `process`. A cancelled crop ends the flow silently; real failures log and show
 * the camera-error snackbar.
 */
export function useCameraCaptureFlow({
  cameraRef,
  quality,
  process,
  cameraReady,
}: UseCameraCaptureFlowOptions) {
  const { t } = useTranslation();
  const warmedUpRef = useRef(false);
  const warmUpPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!cameraReady) {
      // Reset so the next fresh camera session (new mount / remount) warms up again.
      warmedUpRef.current = false;
      return;
    }

    if (warmedUpRef.current || !cameraRef.current) {
      return;
    }
    warmedUpRef.current = true;

    const camera = cameraRef.current;
    const startedAt = Date.now();
    warmUpPromiseRef.current = camera
      .takePictureAsync({
        quality,
        base64: false,
        skipProcessing: true,
        shutterSound: false,
      })
      .then((photo) => {
        logPhase('warm-up capture', startedAt);
        if (!photo?.uri) {
          return;
        }
        try {
          const file = new File(photo.uri);
          if (file.exists) {
            file.delete();
          }
        } catch {
          // Best-effort cleanup of the throwaway warm-up photo.
        }
      })
      .catch((error) => {
        if (__DEV__) {
          console.debug('[CameraCaptureFlow] warm-up capture failed (non-fatal):', error);
        }
      })
      .finally(() => {
        warmUpPromiseRef.current = null;
      });
  }, [cameraReady, cameraRef, quality]);

  const cropAndProcess = useCallback(
    async (imageUri: string) => {
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

  const takePicture = useCallback(async () => {
    if (!cameraRef.current) {
      return;
    }

    try {
      // A silent warm-up capture (see the `cameraReady` effect above) may still be resolving
      // if the user taps the shutter within a moment of the camera mounting. Wait for it
      // instead of firing a second, concurrent `takePictureAsync` — CameraX only supports one
      // capture in flight at a time.
      if (warmUpPromiseRef.current) {
        await warmUpPromiseRef.current;
      }

      // skipProcessing skips Android's post-capture pipeline (re-encode + orientation bake),
      // which is what made the shutter feel seconds-slow. Per expo-camera docs Android then
      // discards `quality` (iOS still honors it) and may deliver the image with its rotation
      // only in EXIF — the CanHub crop view reads EXIF, so the crop step re-bakes it upright.
      const startedAt = Date.now();
      const photo = await cameraRef.current.takePictureAsync({
        quality,
        base64: false,
        skipProcessing: true,
      });
      logPhase('shutter capture', startedAt);
      await cropAndProcess(photo.uri);
    } catch (error) {
      console.error('Error taking picture:', error);
      showSnackbar('error', t('food.aiCamera.cameraError'));
    }
  }, [cameraRef, quality, cropAndProcess, t]);

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
