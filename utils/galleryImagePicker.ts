import * as ImagePicker from 'expo-image-picker';

import { openCropperAsync } from '@/utils/file';

/**
 * Opens the modern system photo picker (Android Photo Picker / iOS PHPicker — expo-image-picker's
 * default when no `legacy` flag is passed) and returns the picked image's URI, or `null` if the
 * user cancels. This picker hands back only the user-selected item through a temporary content
 * grant, so it needs no media-library permission request. expo-image-picker works identically on
 * web (it opens a hidden `<input type=file accept=image/*>` under the hood), so unlike
 * `openCropperAsync` this has no platform-specific behavior and does not need a `.web.ts`
 * counterpart. This is the single "pick from gallery" entry point every image-attach flow in the
 * app should share, so gallery picking feels identical everywhere.
 *
 * Deliberately picks at `quality: 1` and takes no quality argument: every caller re-encodes the
 * result through `openCropperAsync`, so compressing here would stack a second lossy pass on top
 * (a requested 0.8 actually landing at ~0.64) for no benefit. The crop step is the single place
 * output quality is chosen. This matters most on the smart-camera path, where the photo has to
 * stay legible enough for OCR and barcode decoding.
 */
export async function pickImageFromGallery(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    base64: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  return result.assets[0].uri;
}

/**
 * The full "pick from gallery" flow: opens the system photo picker, then runs the result through
 * the app's crop tool. Resolves `null` if the user cancels either step. Used by every screen that
 * lets the user attach or upload a photo from the gallery (chat attachments, meal/food/exercise
 * photo uploads); the smart camera modals use `pickImageFromGallery` and `openCropperAsync`
 * directly instead, since they need separate timing/error handling for each step.
 */
export async function pickAndCropImageFromGallery(
  /** JPEG quality of the crop re-encode — the only lossy step in this flow. */
  compressImageQuality: number = 0.8
): Promise<string | null> {
  const pickedUri = await pickImageFromGallery();
  if (!pickedUri) {
    return null;
  }

  const cropped = await openCropperAsync({
    imageUri: pickedUri,
    format: 'jpeg',
    compressImageQuality,
  });

  return cropped?.path ?? null;
}
