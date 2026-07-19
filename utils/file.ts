import ExpoImageCropTool, { OpenCropperOptions } from '@bsky.app/expo-image-crop-tool';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import {
  cacheDirectory,
  copyAsync,
  documentDirectory,
  EncodingType,
  makeDirectoryAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';

import { dumpDatabase } from '@/database/exportDb';
import { restoreDatabase } from '@/database/importDb';

import { detectBarcodes } from './barcodeScanner';
import { timestampSlug } from './timestampSlug';
type ReadingOptions = NonNullable<Parameters<typeof readAsStringAsync>[1]>;

export { detectBarcodes };

type ExportDatabaseOptions = {
  includeDeletedRecords?: boolean;
};

function getExportFileName(): string {
  return `${timestampSlug()}-musclog-export.json`;
}

export async function downloadFile(uri: string, fileName?: string): Promise<void> {
  try {
    await Sharing.shareAsync(uri);
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}

export async function exportDatabase(
  encryptionPhrase?: string,
  options: ExportDatabaseOptions = {}
): Promise<void> {
  try {
    const dbDump = await dumpDatabase(encryptionPhrase, options);
    if (!cacheDirectory) {
      throw new Error('Cache directory is not available');
    }

    const fileUri = `${cacheDirectory}${getExportFileName()}`;
    await writeAsStringAsync(fileUri, dbDump);
    await downloadFile(fileUri);
  } catch (error) {
    console.error('Error exporting database:', error);
    throw error;
  }
}

export async function importDatabase(decryptionPhrase?: string): Promise<void> {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const { uri } = result.assets[0];
    const dbDump = await readAsStringAsync(uri);
    await restoreDatabase(dbDump, decryptionPhrase);
  } catch (error) {
    console.error('Error importing database:', error);
    throw error;
  }
}

export async function pickDocument(types?: string[]): Promise<DocumentPicker.DocumentPickerResult> {
  try {
    return await DocumentPicker.getDocumentAsync({
      type: types || ['image/*', 'application/pdf', 'text/plain'],
      copyToCacheDirectory: true,
    });
  } catch (error) {
    console.error('Error picking document:', error);
    throw error;
  }
}

export async function resizeImage(photoUri: string, width: number = 512): Promise<string> {
  const manipulatedImage = await ImageManipulator.manipulateAsync(
    photoUri,
    [{ resize: { width } }],
    {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  return manipulatedImage.uri;
}

/**
 * Creates a small thumbnail of an image, optionally returning base64.
 * Used for chat previews.
 */
export async function createThumbnail(
  uri: string,
  width: number = 300
): Promise<{ uri: string; base64?: string }> {
  const result = await ImageManipulator.manipulateAsync(uri, [{ resize: { width } }], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  return { uri: result.uri, base64: result.base64 };
}

// detectBarcodes is now imported from platform-specific implementation
// See barcodeScanner.ios.ts and barcodeScanner.android.ts

/**
 * Copies a temporary image URI (e.g. from expo-image-picker) into the app's
 * permanent document directory so it survives app restarts and OS cache clears.
 *
 * If an existing permanent URI is supplied (e.g. when replacing a previous
 * image), the old file is deleted before saving the new one.
 *
 * @param tempUri  - The temporary `file:///` URI returned by the image picker.
 * @param existingUri - Optional URI of a previously saved exercise image to delete.
 * @returns The permanent `file:///` URI that should be stored in the database.
 */
export async function saveExerciseImage(tempUri: string, existingUri?: string): Promise<string> {
  // Ensure the exercises directory exists
  const exercisesDir = new Directory(Paths.document, 'exercises');
  if (!exercisesDir.exists) {
    exercisesDir.create();
  }

  // Build a unique filename from the current timestamp and a random suffix,
  // preserving the original extension when possible.
  const ext = tempUri.split('.').pop()?.split('?')[0] || 'jpg';
  const filename = `exercise-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  // Copy from the temporary picker URI to the permanent destination
  const srcFile = new File(tempUri);
  const destFile = new File(exercisesDir, filename);
  srcFile.copySync(destFile);

  // Remove the old file if one was provided (best-effort; ignore errors)
  if (existingUri) {
    try {
      const oldFile = new File(existingUri);
      if (oldFile.exists) {
        oldFile.delete();
      }
    } catch {
      // Non-fatal: old file may have already been removed
    }
  }

  return destFile.uri;
}

/**
 * Copies a temporary image URI (e.g. from expo-image-picker) into the app's
 * permanent document directory so it survives app restarts and OS cache clears.
 *
 * @param tempUri  - The temporary `file:///` URI returned by the image picker.
 * @param existingUri - Optional URI of a previously saved meal image to delete.
 * @returns The permanent `file:///` URI that should be stored in the database.
 */
export async function saveMealImage(tempUri: string, existingUri?: string): Promise<string> {
  // Ensure the meals directory exists
  const mealsDir = new Directory(Paths.document, 'meals');
  if (!mealsDir.exists) {
    mealsDir.create();
  }

  // Build a unique filename from the current timestamp and a random suffix,
  // preserving the original extension when possible.
  const ext = tempUri.split('.').pop()?.split('?')[0] || 'jpg';
  const filename = `meal-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  // Copy from the temporary picker URI to the permanent destination
  const srcFile = new File(tempUri);
  const destFile = new File(mealsDir, filename);
  srcFile.copySync(destFile);

  // Remove the old file if one was provided (best-effort; ignore errors)
  if (existingUri) {
    try {
      const oldFile = new File(existingUri);
      if (oldFile.exists) {
        oldFile.delete();
      }
    } catch {
      // Non-fatal: old file may have already been removed
    }
  }

  return destFile.uri;
}

/**
 * Copies a temporary food image URI into permanent document storage.
 *
 * @param tempUri  - The temporary `file:///` URI returned by the image picker.
 * @param existingUri - Optional URI of a previously saved food image to delete.
 * @returns The permanent `file:///` URI that should be stored in the database.
 */
export async function saveFoodImage(tempUri: string, existingUri?: string): Promise<string> {
  const foodsDir = new Directory(Paths.document, 'foods');
  if (!foodsDir.exists) {
    foodsDir.create();
  }

  const ext = tempUri.split('.').pop()?.split('?')[0] || 'jpg';
  const filename = `food-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const srcFile = new File(tempUri);
  const destFile = new File(foodsDir, filename);
  srcFile.copySync(destFile);

  if (existingUri) {
    try {
      const oldFile = new File(existingUri);
      if (oldFile.exists) {
        oldFile.delete();
      }
    } catch {
      // Non-fatal: old file may have already been removed
    }
  }

  return destFile.uri;
}

/**
 * Deletes a permanently stored exercise image file.
 * Safe to call with any URI — non-local or missing files are silently ignored.
 */
export async function deleteExerciseImage(imageUri: string): Promise<void> {
  try {
    if (!imageUri.startsWith('file://')) {
      return;
    }
    const file = new File(imageUri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Deletes a permanently stored meal image file.
 */
export async function deleteMealImage(imageUri: string): Promise<void> {
  try {
    if (!imageUri.startsWith('file://')) {
      return;
    }
    const file = new File(imageUri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Deletes a permanently stored food image file.
 */
export async function deleteFoodImage(imageUri: string): Promise<void> {
  try {
    if (!imageUri.startsWith('file://')) {
      return;
    }
    const file = new File(imageUri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Opens the native crop UI. Resolves `null` when the user dismisses it — a normal outcome,
 * not an error — so callers never have to distinguish cancellation from real failures.
 */
export async function openCropperAsync(options: OpenCropperOptions) {
  try {
    return await ExpoImageCropTool.openCropperAsync(options);
  } catch (error) {
    // The module rejects with "Crop cancelled" on both platforms; match loosely in case the
    // bridge decorates the message.
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('cancel')) {
      return null;
    }

    throw error;
  }
}

export async function readFileAsStringAsync(fileUri: string, options: ReadingOptions = {}) {
  return readAsStringAsync(fileUri, options);
}

export function shouldSeedDevData() {
  // return !isProduction();
  return false;
}

const FOOD_IMAGES_DIR = `${documentDirectory}food_images/`;

async function ensureFoodImagesDir(): Promise<void> {
  await makeDirectoryAsync(FOOD_IMAGES_DIR, { intermediates: true });
}

/** Saves a raw base64 string (no data-URI prefix) as a JPEG in the app's document directory. Returns the local file URI. */
export async function saveBase64ImageToFile(base64: string): Promise<string> {
  await ensureFoodImagesDir();
  const filename = `food_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const destUri = `${FOOD_IMAGES_DIR}${filename}`;
  await writeAsStringAsync(destUri, base64, { encoding: EncodingType.Base64 });
  return destUri;
}

/** Copies a local image file (e.g. a temp crop path) into the app's document directory for persistent storage. Returns the new local file URI. */
export async function copyImageToDocumentDirectory(sourceUri: string): Promise<string> {
  await ensureFoodImagesDir();
  const ext = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
  const filename = `food_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const destUri = `${FOOD_IMAGES_DIR}${filename}`;
  await copyAsync({ from: sourceUri, to: destUri });
  return destUri;
}
