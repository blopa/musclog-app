import { recognizeText } from 'rn-mlkit-ocr';

/**
 * Runs local OCR on the given image URI and returns the recognized text.
 * Returns null if recognition fails or no text is found.
 */
export async function performOcr(imageUri: string): Promise<string | null> {
  try {
    const result = await recognizeText(imageUri);
    const text = result.text.trim();
    return text.length > 0 ? text : null;
  } catch (error) {
    console.error('[OCR] Error recognizing text:', error);
    return null;
  }
}
