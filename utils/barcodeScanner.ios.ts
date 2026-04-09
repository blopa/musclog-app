/**
 * iOS Barcode Scanner Implementation
 *
 * This is a stub/fallback implementation for iOS.
 * The original react-native-barcodes-detector package depends on Google ML Kit
 * which doesn't support the arm64 architecture required for iOS simulators on Apple Silicon Macs.
 *
 * For barcode scanning on iOS, the app uses expo-camera's built-in barcode scanning
 * capabilities which work directly in the CameraView component.
 *
 * This file provides a stub for image-based barcode detection. For real-time
 * scanning, use the CameraView component with barcodeScannerSettings.
 */

/**
 * Stub implementation of detectBarcodes for iOS.
 * Returns null as image-based barcode detection is not available through react-native-barcodes-detector.
 *
 * For barcode scanning on iOS, use the BarcodeCameraModal component which uses
 * expo-camera's built-in barcode scanning functionality.
 */
export async function detectBarcodes(imageUri: string): Promise<string | null> {
  console.warn(
    '[barcodeScanner.ios.ts] detectBarcodes is not implemented for iOS. ' +
      'The react-native-barcodes-detector package has been removed due to architecture incompatibility. ' +
      'Use the CameraView component with barcodeScannerSettings for real-time barcode scanning instead.'
  );
  return null;
}
