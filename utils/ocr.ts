/**
 * OCR Utility - Platform-agnostic export
 *
 * On Android: Uses rn-mlkit-ocr for on-device OCR (see ocr.android.ts)
 * On iOS: Stub implementation (see ocr.ios.ts) - rn-mlkit-ocr removed due to architecture incompatibility
 * On Web: Stub implementation (this file)
 *
 * For cross-platform OCR, consider using OcrService from "@/services/OcrService"
 * which uses Guten OCR and works on both iOS and Android.
 */

/**
 * Stub implementation of performOcr for Web.
 * Returns null as OCR functionality is not available in the browser through rn-mlkit-ocr.
 *
 * For OCR on web, consider using a cloud-based OCR API (Google Vision API, AWS Textract, etc.)
 * or the OcrService if running in a React Native environment.
 */
export async function performOcr(imageUri: string): Promise<string | null> {
  console.warn(
    '[ocr.ts] performOcr is not implemented for Web. ' +
      'Please use a cloud-based OCR API for web implementations.'
  );
  return null;
}
