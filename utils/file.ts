import { Asset } from 'expo-asset';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import { ReadingOptions } from 'expo-file-system/src/legacy/FileSystem.types';
import ExpoImageCropTool from 'expo-image-crop-tool';
import { OpenCropperOptions } from 'expo-image-crop-tool/src/ExpoImageCropTool.types';
import { ImageManipulator } from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import * as Updates from 'expo-updates';
import { DevSettings } from 'react-native';
import { BarcodeFormat, detectBarcodes as RNDetectBarcodes } from 'react-native-barcodes-detector';

import { dumpDatabase, restoreDatabase } from '../database/exportImport';

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

export async function resizeImage(photoUri: string, width: number = 512): Promise<string> {
  const manipulatedImage = await ImageManipulator.manipulateAsync(
    photoUri,
    [{ resize: { width } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  return manipulatedImage.uri;
}

export async function detectBarcodes(imageUri: string) {
  const barcodes = await RNDetectBarcodes(imageUri, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8]);

  return barcodes.length > 0 ? barcodes[0].rawValue : null;
}

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

/**
 * Copies a bundled exercise image (from require()) to the app's document directory.
 * Uses expo-asset to properly resolve and download bundled assets in all environments.
 *
 * @param assetSource - The result of require() for the image (or getBundledExerciseImageSourceByIndex).
 * @param destFilename - Filename to use in document/exercises/ (e.g. exercise-{id}.png).
 * @returns The permanent file:// URI to store in the database, or throws on failure.
 */
export async function copyBundledExerciseImageToDocument(
  assetSource: number,
  destFilename: string
): Promise<string> {
  const exercisesDir = new Directory(Paths.document, 'exercises');
  if (!exercisesDir.exists) {
    exercisesDir.create();
  }

  const destFile = new File(exercisesDir, destFilename);

  // If the file was already copied (e.g. a previous interrupted seeding run, or
  // multiple exercises sharing the same fallback image), reuse it.
  if (destFile.exists) {
    return destFile.uri;
  }

  try {
    // Use expo-asset to download and resolve the bundled asset
    // This works in both development and production builds
    const asset = await Asset.fromModule(assetSource).downloadAsync();
    if (asset.localUri) {
      const srcFile = new File(asset.localUri);
      srcFile.copy(destFile);
      return destFile.uri;
    } else {
      throw new Error('Asset download failed - no localUri available');
    }
  } catch (error) {
    console.error('Failed to copy exercise image:', error);
    throw new Error(
      `Failed to copy exercise image: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function reloadApp() {
  if (__DEV__) {
    // In development mode, use DevSettings.reload() to reload the app
    DevSettings.reload();
    return;
  }

  // In production, check if Updates is enabled before reloading
  if (Updates.isEnabled) {
    await Updates.reloadAsync();
  } else {
    console.warn('Updates is not enabled. App reload skipped.');
  }
}
