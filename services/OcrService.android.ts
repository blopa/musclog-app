/**
 * OCR Service for Android
 * Uses Guten OCR (ONNX Runtime) - Shared implementation with iOS
 * Ensures consistent cross-platform behavior
 */

import type { OcrResult } from './OcrService';

// Import Guten OCR - shared implementation for both iOS and Android
export {
  getAvailableLanguages,
  initializeOcr,
  recognizeText,
  terminateOcr,
} from './OcrServiceShared';
