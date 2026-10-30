import { useEffect } from 'react';

import { isStaticExport } from '@/constants/platform';
import { useSettings } from '@/hooks/useSettings';
import i18n from '@/lang/lang';

export function LanguageInitializer() {
  const { isLoading, language } = useSettings();

  useEffect(() => {
    // Until settings load, `language` is a default (or the mirrored value that
    // `AppDbReadyGate` has already applied); switching to a default would flash
    // English before the stored language arrives.
    if (isStaticExport || isLoading) {
      return;
    }

    // Only set the language if it's different from the current language
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language).catch((err) => {
        console.warn('[LanguageInitializer] Failed to change language:', err);
      });
    }
  }, [isLoading, language]);

  return null;
}
