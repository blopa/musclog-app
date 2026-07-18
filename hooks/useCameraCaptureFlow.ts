import type { CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import type { RefObject } from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { openCropperAsync } from '@/utils/file';
import { showSnackbar } from '@/utils/snackbarService';

/** Barcode photos tolerate more compression than AI photos, which need legible label text. */
export const BARCODE_PHOTO_QUALITY = 0.8;
export const AI_PHOTO_QUALITY = 0.85;

type UseCameraCaptureFlowOptions = {
  cameraRef: RefObject<CameraView | null>;
  /**
   * JPEG quality for the whole pipeline: the shutter capture (iOS only — see `skipProcessing`
   * below), the gallery pick, and the crop re-encode.
   */
  quality: number;
  /** Receives the cropped image path (shutter and gallery alike). */
  process: (fileUri: string) => Promise<void>;
};

/**
 * The shared capture pipeline behind the smart-camera modals: photo (shutter or gallery pick)
 * → crop UI → `process`. A cancelled crop ends the flow silently; real failures log and show
 * the camera-error snackbar.
 */
export function useCameraCaptureFlow({ cameraRef, quality, process }: UseCameraCaptureFlowOptions) {
  const { t } = useTranslation();

  const cropAndProcess = useCallback(
    async (imageUri: string) => {
      const cropped = await openCropperAsync({
        imageUri,
        format: 'jpeg',
        compressImageQuality: quality,
      });

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
      // skipProcessing skips Android's post-capture pipeline (re-encode + orientation bake),
      // which is what made the shutter feel seconds-slow. Per expo-camera docs Android then
      // discards `quality` (iOS still honors it) and may deliver the image with its rotation
      // only in EXIF — the CanHub crop view reads EXIF, so the crop step re-bakes it upright.
      const photo = await cameraRef.current.takePictureAsync({
        quality,
        base64: false,
        skipProcessing: true,
      });
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
