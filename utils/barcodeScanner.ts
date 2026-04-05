/**
 * Barcode Scanner Utility - Platform-agnostic export
 *
 * On Android: Uses react-native-barcodes-detector for image-based barcode detection (see barcodeScanner.android.ts)
 * On iOS: Stub implementation (see barcodeScanner.ios.ts) - react-native-barcodes-detector removed due to architecture incompatibility
 * On Web: Uses @ericblade/quagga2 (see file.web.ts)
 *
 * For real-time barcode scanning across platforms, use the CameraView component
 * with barcodeScannerSettings which uses expo-camera's built-in barcode detection.
 */

/**
 * Stub implementation of detectBarcodes for Web.
 *
 * For web barcode detection, the app uses Quagga2 library in file.web.ts.
 * This stub exists for compatibility with the shared interface.
 */
export async function detectBarcodes(imageUri: string): Promise<string | null> {
  console.warn(
    '[barcodeScanner.ts] detectBarcodes is not implemented for Web in this file. ' +
      'For web implementations, use the detectBarcodes function from file.web.ts which uses Quagga2.'
  );
  return null;
}
