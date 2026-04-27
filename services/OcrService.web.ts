/**
 * OCR Service for Web
 * Uses tesseract.js for in-browser on-device OCR.
 */

import { createWorker } from 'tesseract.js';

import { EN_US } from '@/lang/lang';

import type { OcrResult } from './OcrService';

const OCR_LANGS = 'eng+spa+por+nld+deu+fra';

export async function initializeOcr(_language?: string): Promise<void> {
  // tesseract.js initializes lazily on first recognize call
}

export async function recognizeText(
  imageUri: string,
  language: string = EN_US
): Promise<OcrResult> {
  const startTime = Date.now();
  const worker = await createWorker(OCR_LANGS);

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
  return ['eng', 'spa', 'por', 'nld', 'deu', 'fra'];
}

export async function terminateOcr(): Promise<void> {
  // workers are terminated after each call
}
