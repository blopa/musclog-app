import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import ExpoImageCropTool from 'expo-image-crop-tool';
import { OpenCropperOptions } from 'expo-image-crop-tool/src/ExpoImageCropTool.types';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';

import { dumpDatabase } from '@/database/export';
import { restoreDatabase } from '@/database/import';

import { detectBarcodes } from './barcodeScanner';
type ReadingOptions = NonNullable<Parameters<typeof readAsStringAsync>[1]>;

export { detectBarcodes };

function getExportFileName(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${timestamp}-musclog-export.json`;
}

export async function exportDatabase(encryptionPhrase?: string): Promise<void> {
  try {
    const dbDump = await dumpDatabase(encryptionPhrase);
    if (!cacheDirectory) {
      throw new Error('Cache directory is not available');
    }

    const fileUri = `${cacheDirectory}${getExportFileName()}`;
    await writeAsStringAsync(fileUri, dbDump);
    await Sharing.shareAsync(fileUri);
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
  srcFile.copy(destFile);

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

export async function openCropperAsync(options: OpenCropperOptions) {
  return ExpoImageCropTool.openCropperAsync(options);
}

export async function readFileAsStringAsync(fileUri: string, options: ReadingOptions = {}) {
  return readAsStringAsync(fileUri, options);
}

export function shouldSeedDevData() {
  // return __DEV__;
  return false;
}
