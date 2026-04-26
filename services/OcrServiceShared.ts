/**
 * Shared OCR Service Implementation using Guten OCR (@gutenye/ocr-react-native)
 * Uses ONNX Runtime for on-device processing — works on iOS including arm64 simulators.
 *
 * Not used on Android (rn-mlkit-ocr is used there instead) because
 * @gutenye/ocr-react-native is incompatible with RN 0.76+ on Android.
 */

import { handleError } from '@/utils/handleError';

import type { OcrResult } from './OcrService';

let currentLanguage: string = 'eng';
let isInitialized = false;
let ocrInstance: any = null;

const AVAILABLE_LANGUAGES = ['eng', 'chi_sim', 'chi_tra', 'fra', 'deu', 'jpn', 'kor', 'rus', 'spa'];

export async function initializeOcr(language: string = 'eng'): Promise<void> {
  if (isInitialized && currentLanguage === language && ocrInstance) {
    return;
  }

  try {
    const Ocr = require('@gutenye/ocr-react-native').default;

    ocrInstance = await Ocr.create({ language });
    currentLanguage = language;
    isInitialized = true;
  } catch (error) {
    handleError(error, 'OcrServiceShared.initializeOcr');
    console.error('[OCR] Failed to initialize Guten OCR:', error);
    throw error;
  }
}

export async function recognizeText(
  imageUri: string,
  language: string = 'eng'
): Promise<OcrResult> {
  const startTime = Date.now();
  try {
    if (!isInitialized || currentLanguage !== language || !ocrInstance) {
      await initializeOcr(language);
    }

    // Guten OCR works with file paths.
    const filePath = imageUri.startsWith('file://') ? imageUri : `file://${imageUri}`;

    const lines = await ocrInstance.detect(filePath);

    // Combine lines into a single text string
    const text = lines.map((l: any) => l.text).join('\n');

    return {
      text: text || '',
      confidence: 0.8, // Guten OCR detect doesn't seem to return global confidence directly
      blocks: lines.map((l: any) => ({
        text: l.text,
        confidence: 0.8,
        frame: l.frame,
      })),
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    handleError(error, 'OcrServiceShared.recognizeTextGutenOcr');
    console.error('[OCR] Guten OCR recognition failed:', error);
    return { text: '', confidence: 0, blocks: [], processingTimeMs: Date.now() - startTime };
  }
}

export async function getAvailableLanguages(): Promise<string[]> {
  return AVAILABLE_LANGUAGES;
}

export async function terminateOcr(): Promise<void> {
  // Guten OCR Ocr.ts doesn't have a terminate method, but it might be handled by JS GC
  // or internal native cleanup.
  ocrInstance = null;
  isInitialized = false;
}
