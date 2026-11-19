import { usePathname } from 'expo-router';
import { useEffect } from 'react';

import { LanguageInitializer } from '@/components/LanguageInitializer';
import i18n from '@/lang/lang';

import { parsePublicPath } from './localeRoutes';

/**
 * The public website's language is the language in its address (`/es/tools/…` is Spanish), so a
 * stored preference can never make an address show a language it does not name. The language is set
 * while rendering, before any child reads it: the static export renders every page in one process
 * and the first browser render must match the HTML it hydrates.
 *
 * An address with no prefix (`/open`, `/test`) keeps the old behaviour: `LanguageInitializer`
 * applies the language stored in the settings once they load.
 */
export function useWebsiteLanguage(): boolean {
  const { locale } = parsePublicPath(usePathname());

  if (locale && i18n.language !== locale.language) {
    i18n.changeLanguage(locale.language).catch((error) => {
      console.warn('[useWebsiteLanguage] Failed to change language:', error);
    });
  }

  useEffect(() => {
    if (locale) {
      document.documentElement.lang = locale.hreflang;
    }
  }, [locale]);

  return locale != null;
}

/** Applies the stored language to pages that have no language of their own in the address. */
export function WebsiteLanguageInitializer() {
  const { locale } = parsePublicPath(usePathname());

  return locale ? null : <LanguageInitializer />;
}
