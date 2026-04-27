/**
 * OCR Service for Web
 * Uses tesseract.js for in-browser on-device OCR.
 */

import { createWorker } from 'tesseract.js';

import { mapAppLanguageToOcrLanguage } from '@/utils/ocr';

import { type OcrResult } from './OcrService';

export async function initializeOcr(_language?: string): Promise<void> {
  // tesseract.js initializes lazily on first recognize call
}

export async function recognizeText(imageUri: string, language?: string): Promise<OcrResult> {
  const startTime = Date.now();
  const worker = await createWorker(mapAppLanguageToOcrLanguage(language));

  try {
    const {
      data: { text },
    } = await worker.recognize(imageUri);
    return { text: text.trim(), blocks: [], processingTimeMs: Date.now() - startTime };
  } finally {
    await worker.terminate();
  }
}

export async function getAvailableLanguages(): Promise<string[]> {
  return ['eng', 'spa', 'por', 'nld', 'deu', 'fra', 'rus'];
}

export async function terminateOcr(): Promise<void> {
  // workers are terminated after each call
}
