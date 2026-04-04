/**
 * iOS OCR Implementation
 *
 * This is a stub/fallback implementation for iOS.
 * The original rn-mlkit-ocr package has been removed because Google ML Kit
 * doesn't support the arm64 architecture required for iOS simulators on Apple Silicon Macs.
 *
 * For actual OCR on iOS, consider these alternatives:
 * 1. Use the OcrService/OcrServiceShared which uses Guten OCR (already implemented)
 * 2. Use a cloud-based OCR API (Google Vision API, AWS Textract, etc.)
 * 3. Use expo-camera with on-device text recognition from expo-image-manipulator
 *
 * This file exists to prevent build errors while keeping the import interface consistent.
 */

/**
 * Stub implementation of performOcr for iOS.
 * Returns null as OCR functionality is not available through rn-mlkit-ocr on this platform.
 *
 * Use the OcrService (Guten OCR based) instead for actual OCR functionality on iOS.
 */
export async function performOcr(imageUri: string): Promise<string | null> {
  console.warn(
    '[ocr.ios.ts] performOcr is not implemented for iOS. ' +
      'The rn-mlkit-ocr package has been removed due to architecture incompatibility. ' +
      'Please use OcrService from "@/services/OcrService" which uses Guten OCR instead.'
  );
  return null;
}
