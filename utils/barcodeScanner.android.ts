import { BarcodeFormat, detectBarcodes as RNDetectBarcodes } from 'react-native-barcodes-detector';

/**
 * Detect barcodes in an image.
 *
 * This implementation uses react-native-barcodes-detector which works on Android devices.
 * It scans for common product barcode formats (EAN-13, EAN-8, UPC-A, UPC-E).
 *
 * @param imageUri - URI of the image to scan for barcodes
 * @returns The first detected barcode value, or null if none found
 */
export async function detectBarcodes(imageUri: string): Promise<string | null> {
  const barcodes = await RNDetectBarcodes(imageUri, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);

  return barcodes.length > 0 ? barcodes[0].rawValue : null;
}
