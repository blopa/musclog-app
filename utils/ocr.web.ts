import { createWorker } from 'tesseract.js';

/** Tesseract language codes: English, Spanish, Portuguese, Dutch, German, French */
const OCR_LANGS = 'eng+spa+por+nld+deu+fra';

/**
 * Runs local OCR on the given image URI and returns the recognized text.
 * Returns null if recognition fails or no text is found.
 * Supports English, Spanish, Portuguese, Dutch, German and French.
 */
export async function performOcr(imageUri: string): Promise<string | null> {
  console.log('Lets do the ocr');
  try {
    const worker = await createWorker(OCR_LANGS);
    const {
      data: { text },
    } = await worker.recognize(imageUri);
    await worker.terminate();

    const trimmedText = text.trim();
    debugger;
    return trimmedText.length > 0 ? trimmedText : null;
  } catch (error) {
    console.error('[OCR] Error recognizing text:', error);
    return null;
  }
}
