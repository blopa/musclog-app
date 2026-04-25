/**
 * iOS Barcode Scanner Implementation
 *
 * TODO: Implement barcode scanning from file for iOS
 */
export async function detectBarcodes(imageUri: string): Promise<string | null> {
  console.warn(
    '[barcodeScanner.ios.ts] detectBarcodes is not implemented for iOS. ' +
      'The react-native-barcodes-detector package has been removed due to architecture incompatibility. '
  );

  return null;
}
