import * as DocumentPicker from 'expo-document-picker';
import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import { ImageManipulator } from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
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
