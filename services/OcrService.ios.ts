/**
 * OCR Service for iOS
 * Uses Guten OCR (ONNX Runtime) - Works perfectly on arm64 simulators
 * No architecture compatibility issues unlike ML Kit
 */

import type { OcrResult } from './OcrService';

// Import Guten OCR - shared implementation for both iOS and Android
export {
  getAvailableLanguages,
  initializeOcr,
  recognizeText,
  terminateOcr,
} from './OcrServiceShared';
