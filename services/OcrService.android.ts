/**
 * OCR Service for Android
 * Uses rn-mlkit-ocr (Google ML Kit) — compatible with RN 0.76+ / Expo 55.
 *
 * @gutenye/ocr-react-native is excluded from the Android native build because it
 * links ReactAndroid::reactnativejni which was removed in RN 0.76+.
 */

import {
  getAvailableLanguages as mlkitGetLanguages,
  recognizeText as mlkitRecognizeText,
} from 'rn-mlkit-ocr';

import { handleError } from '@/utils/handleError';

import type { OcrResult } from './OcrService';

export async function initializeOcr(_language: string = 'eng'): Promise<void> {
  // rn-mlkit-ocr initializes on first use.
}

export async function recognizeText(
  imageUri: string,
  _language: string = 'eng'
): Promise<OcrResult> {
  const startTime = Date.now();
  try {
    const result = await mlkitRecognizeText(imageUri);
    return {
      text: result.text,
      blocks: result.blocks.map((b) => ({
        text: b.text,
        frame: b.frame,
        lines: b.lines,
      })),
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    handleError(error, 'OcrService.android.recognizeTextAndroid');
    console.error('[OCR] rn-mlkit-ocr recognition failed:', error);
    return { text: '', blocks: [], processingTimeMs: Date.now() - startTime };
  }
}

export async function getAvailableLanguages(): Promise<string[]> {
  try {
    const langs = await mlkitGetLanguages();
    return langs;
  } catch {
    return ['latin'];
  }
}

export async function terminateOcr(): Promise<void> {
  // rn-mlkit-ocr has no explicit teardown.
}
