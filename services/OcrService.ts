/**
 * OCR Service - platform-agnostic interface.
 *
 * Callers should pass the app language/locale tag (for example `en-US` or
 * `pt-BR`). Platform-specific implementations can map that to their OCR
 * engine's expected language code, or ignore it when the engine only supports
 * auto-detection.
 */

export interface OcrResult {
  text: string;
  confidence?: number;
  blocks?: OcrBlock[];
  processingTimeMs?: number;
}

export interface OcrBlock {
  text: string;
  confidence?: number;
  frame?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  lines?: OcrLine[];
}

export interface OcrLine {
  text: string;
  confidence?: number;
  frame?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  elements?: OcrElement[];
}

export interface OcrElement {
  text: string;
  confidence?: number;
  frame?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Recognize text from an image
 * @param imageUri Path to the image (file path or URI)
 * @param language Optional app language/locale tag (for example `en-US`)
 * @returns Promise resolving to OCR result with recognized text
 */
export function recognizeText(imageUri: string, language?: string): Promise<OcrResult> {
  throw new Error('Not implemented - use platform-specific implementation');
}

/**
 * Get available languages for OCR
 * @returns Promise resolving to array of supported OCR language codes
 */
export function getAvailableLanguages(): Promise<string[]> {
  throw new Error('Not implemented - use platform-specific implementation');
}

/**
 * Initialize OCR worker (must be called before using recognizeText)
 * @param language Optional app language/locale tag (for example `en-US`)
 */
export async function initializeOcr(language?: string): Promise<void> {
  throw new Error('Not implemented - use platform-specific implementation');
}

/**
 * Terminate OCR worker and cleanup resources
 */
export async function terminateOcr(): Promise<void> {
  throw new Error('Not implemented - use platform-specific implementation');
}
