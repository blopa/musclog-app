/**
 * useOcr - Hook for performing OCR recognition on images
 * Uses Guten OCR which works perfectly on iOS arm64 simulators on Apple Silicon
 * and on Android devices
 */

import { useState, useCallback, useEffect } from 'react';
import * as OcrService from '@/services/OcrService';
import type { OcrResult } from '@/services/OcrService';

interface UseOcrState {
  result: OcrResult | null;
  loading: boolean;
  error: Error | null;
  isInitialized: boolean;
}

interface UseOcrOptions {
  autoInitialize?: boolean;
  language?: string;
}

export function useOcr(options: UseOcrOptions = {}) {
  const { autoInitialize = true, language = 'eng' } = options;

  const [state, setState] = useState<UseOcrState>({
    result: null,
    loading: false,
    error: null,
    isInitialized: false,
  });

  // Auto-initialize on mount if requested
  useEffect(() => {
    if (autoInitialize) {
      OcrService.initializeOcr(language)
        .then(() => {
          setState((prev) => ({ ...prev, isInitialized: true }));
        })
        .catch((err) => {
          console.warn('[useOcr] Auto-initialization warning (non-blocking):', err);
          // Don't fail on initialization - it may work on first recognition
          setState((prev) => ({ ...prev, isInitialized: true }));
        });
    }

    // Cleanup on unmount
    return () => {
      OcrService.terminateOcr().catch(console.warn);
    };
  }, [autoInitialize, language]);

  const recognizeText = useCallback(
    async (imageUri: string, recognitionLanguage?: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // Ensure initialization
        if (!state.isInitialized) {
          await OcrService.initializeOcr(recognitionLanguage || language);
        }

        const result = await OcrService.recognizeText(
          imageUri,
          recognitionLanguage || language
        );
        setState((prev) => ({
          ...prev,
          result,
          loading: false,
          error: null,
        }));
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        setState((prev) => ({
          ...prev,
          result: null,
          loading: false,
          error: err,
        }));
        throw err;
      }
    },
    [state.isInitialized, language]
  );

  const getAvailableLanguages = useCallback(async () => {
    try {
      return await OcrService.getAvailableLanguages();
    } catch (error) {
      console.warn('Failed to get available languages:', error);
      return ['eng'];
    }
  }, []);

  const initialize = useCallback(async (lang?: string) => {
    try {
      await OcrService.initializeOcr(lang);
      setState((prev) => ({ ...prev, isInitialized: true }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Initialization failed');
      setState((prev) => ({ ...prev, error: err }));
      throw err;
    }
  }, []);

  const terminate = useCallback(async () => {
    await OcrService.terminateOcr();
    setState((prev) => ({ ...prev, isInitialized: false }));
  }, []);

  return {
    ...state,
    recognizeText,
    getAvailableLanguages,
    initialize,
    terminate,
  };
}
