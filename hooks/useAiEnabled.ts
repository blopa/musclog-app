import { useEffect, useState } from 'react';

import { SettingsService } from '@/database/services/SettingsService';

/**
 * Hook to check if AI features are enabled and configured.
 * Returns both enabled state and loading state so UI can avoid flashing "disabled" before the check completes.
 */
export function useAiEnabled(): { isEnabled: boolean; isLoading: boolean } {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkAiEnabled() {
      try {
        const enableGoogleGemini = await SettingsService.getEnableGoogleGemini();
        const googleGeminiApiKey = await SettingsService.getGoogleGeminiApiKey();
        if (enableGoogleGemini && googleGeminiApiKey?.trim()) {
          if (!cancelled) {
            setIsEnabled(true);
            setIsLoading(false);
          }
          return;
        }

        const enableOpenAi = await SettingsService.getEnableOpenAi();
        const openAiApiKey = await SettingsService.getOpenAiApiKey();
        if (enableOpenAi && openAiApiKey?.trim()) {
          if (!cancelled) {
            setIsEnabled(true);
            setIsLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setIsEnabled(false);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[useAiEnabled] Error checking AI status:', error);
        if (!cancelled) {
          setIsEnabled(false);
          setIsLoading(false);
        }
      }
    }

    checkAiEnabled();

    return () => {
      cancelled = true;
    };
  }, []);

  return { isEnabled, isLoading };
}

/**
 * Hook variant that returns { enabled, isLoading } (alias for useAiEnabled).
 * Useful for showing spinners or skeletons while checking.
 */
export function useAiEnabledWithLoading(): { enabled: boolean; isLoading: boolean } {
  const { isEnabled, isLoading } = useAiEnabled();
  return { enabled: isEnabled, isLoading };
}
