/**
 * Shared OCR Service Implementation using Guten OCR (@gutenye/ocr-react-native)
 * Uses ONNX Runtime for on-device processing — works on iOS including arm64 simulators.
 *
 * Not used on Android (rn-mlkit-ocr is used there instead) because
 * @gutenye/ocr-react-native is incompatible with RN 0.76+ on Android.
 */

import { deleteAsync, readAsStringAsync, writeAsStringAsync } from 'expo-file-system';
import { cacheDirectory, EncodingType } from 'expo-file-system/legacy';

import { handleError } from '@/utils/handleError';

import type { OcrResult } from './OcrService';

let currentLanguage: string = 'eng';
let isInitialized = false;

const AVAILABLE_LANGUAGES = ['eng', 'chi_sim', 'chi_tra', 'fra', 'deu', 'jpn', 'kor', 'rus', 'spa'];

export async function initializeOcr(language: string = 'eng'): Promise<void> {
  if (isInitialized && currentLanguage === language) {
    return;
  }
  currentLanguage = language;
  isInitialized = true;
}

export async function recognizeText(
  imageUri: string,
  language: string = 'eng'
): Promise<OcrResult> {
  const startTime = Date.now();
  try {
    if (!isInitialized || currentLanguage !== language) {
      await initializeOcr(language);
    }

    const { Recognizer } = require('@gutenye/ocr-react-native');
    const recognizer = new Recognizer({ language });

    const imageData = await readAsStringAsync(imageUri, {
      encoding: EncodingType.Base64,
    });

    const tempFileUri = `${cacheDirectory}ocr_temp_${Date.now()}.png`;
    await writeAsStringAsync(tempFileUri, imageData, {
      encoding: EncodingType.Base64,
    });

    const result = await recognizer.recognize(tempFileUri);
    await deleteAsync(tempFileUri, { idempotent: true });

    return {
      text: result.text || '',
      confidence: result.confidence || 0.8,
      blocks: result.blocks || [],
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
  isInitialized = false;
}
