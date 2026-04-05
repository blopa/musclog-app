/**
 * OCR Service for Web
 * Not supported on web platform
 */

import type { OcrResult } from './OcrService';

/**
 * Recognize text from an image (not supported on web)
 * @throws Error indicating OCR is not supported on web platform
 */
export async function recognizeText(): Promise<OcrResult> {
  throw new Error('OCR is not supported on web platform');
}

/**
 * Get available languages (not supported on web)
 * @throws Error indicating OCR is not supported on web platform
 */
export async function getAvailableLanguages(): Promise<string[]> {
  throw new Error('OCR is not supported on web platform');
}
