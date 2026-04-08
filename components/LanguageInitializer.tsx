import { useEffect } from 'react';

import { useSettings } from '@/hooks/useSettings';
import i18n from '@/lang/lang';

export function LanguageInitializer() {
  const { language } = useSettings();

  useEffect(() => {
    // Only set the language if it's different from the current language
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language).catch((err) => {
        console.warn('[LanguageInitializer] Failed to change language:', err);
      });
    }
  }, [language]);

  return null;
}
