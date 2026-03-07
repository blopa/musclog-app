import { createWorker } from 'tesseract.js';

/**
 * Runs local OCR on the given image URI and returns the recognized text.
 * Returns null if recognition fails or no text is found.
 */
export async function performOcr(imageUri: string): Promise<string | null> {
  debugger;
  try {
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(imageUri);
    await worker.terminate();
    
    const trimmedText = text.trim();
    return trimmedText.length > 0 ? trimmedText : null;
  } catch (error) {
    console.error('[OCR] Error recognizing text:', error);
    return null;
  }
}
