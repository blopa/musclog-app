/**
 * OCR Service - Platform-agnostic interface
 * Both iOS and Android: Uses Guten OCR (ONNX Runtime)
 * - Works perfectly on iOS arm64 simulators on Apple Silicon
 * - No architecture compatibility issues
 * - Fully offline, on-device processing
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
 * @param language Optional language code (defaults to 'eng' for English)
 * @returns Promise resolving to OCR result with recognized text
 */
export function recognizeText(
  imageUri: string,
  language?: string
): Promise<OcrResult> {
  throw new Error('Not implemented - use platform-specific implementation');
}

/**
 * Get available languages for OCR
 * @returns Promise resolving to array of available language codes
 */
export function getAvailableLanguages(): Promise<string[]> {
  throw new Error('Not implemented - use platform-specific implementation');
}

/**
 * Initialize OCR worker (must be called before using recognizeText)
 * @param language Language code to initialize (defaults to 'eng')
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

