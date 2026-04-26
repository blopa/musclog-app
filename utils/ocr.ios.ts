import { recognizeText } from '@/services/OcrService';

/**
 * iOS OCR Implementation
 *
 * This implementation uses Guten OCR (via OcrService) which works on iOS devices
 * and arm64 simulators.
 */
export async function performOcr(imageUri: string): Promise<string | null> {
  try {
    const result = await recognizeText(imageUri);
    const text = result.text.trim();
    return text.length > 0 ? text : null;
  } catch (error) {
    console.error('[OCR] iOS OCR recognition failed:', error);
    return null;
  }
}
