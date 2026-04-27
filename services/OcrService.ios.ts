/**
 * OCR Service for iOS
 * Uses @gutenye/ocr-react-native (ONNX Runtime) — works on arm64 simulators and devices.
 * Android uses rn-mlkit-ocr instead (OcrService.android.ts) because @gutenye/ocr-react-native
 * is incompatible with RN 0.76+ on Android.
 *
 * API: Ocr.create({}) → instance, instance.detect(filePath) → TextLine[]
 * Note: @gutenye/ocr-react-native has no language option; it detects text language automatically.
 */

import Ocr from '@gutenye/ocr-react-native';

import { handleError } from '@/utils/handleError';

import type { OcrResult } from './OcrService';

let ocrInstance: Awaited<ReturnType<typeof Ocr.create>> | null = null;

export async function initializeOcr(_language?: string): Promise<void> {
  if (ocrInstance) {
    return;
  }

  ocrInstance = await Ocr.create({});
}

export async function recognizeText(imageUri: string, _language?: string): Promise<OcrResult> {
  const startTime = Date.now();
  try {
    if (!ocrInstance) {
      await initializeOcr();
    }

    // The native module expects a raw file path, not a file:// URI
    const filePath = imageUri.startsWith('file://') ? imageUri.slice(7) : imageUri;
    const lines = await ocrInstance!.detect(filePath);

    const text = lines.map((l) => l.text).join('\n');
    const avgScore =
      lines.length > 0 ? lines.reduce((sum, l) => sum + l.score, 0) / lines.length : 0;

    return {
      text,
      confidence: avgScore,
      blocks: lines.map((l) => ({
        text: l.text,
        confidence: l.score,
        frame: { x: l.frame.left, y: l.frame.top, width: l.frame.width, height: l.frame.height },
      })),
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    handleError(error, 'OcrService.ios.recognizeText');
    console.error('[OCR] Guten OCR recognition failed:', error);
    return { text: '', confidence: 0, blocks: [], processingTimeMs: Date.now() - startTime };
  }
}

export async function getAvailableLanguages(): Promise<string[]> {
  // @gutenye/ocr-react-native auto-detects language; no explicit language selection
  return ['auto'];
}

export async function terminateOcr(): Promise<void> {
  ocrInstance = null;
}
