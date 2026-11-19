import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { localeForLanguage, localizedPath } from './localeRoutes';

/**
 * Turns a logical website path (`/tools/protein-calculator`, `/exercises?q=squat`) into the public
 * URL in the visitor's current language (`/es/tools/protein-calculator`). Every internal link on the
 * website goes through this; a hand-written `/tools/…` would land on the old-address forwarding page.
 *
 * Addresses that are not website pages (`/app`, `/open`, `/images/…`, an `https://` URL) come back
 * untouched, and so do pages with no copy in the current language (the blog stays `/en/blog/…`).
 */
export function useWebsiteHref(): (path: string) => string {
  const { i18n } = useTranslation();
  const { prefix } = localeForLanguage(i18n.resolvedLanguage ?? i18n.language);

  return useCallback(
    (path: string) => (/^[a-z][a-z0-9+.-]*:/i.test(path) ? path : localizedPath(path, prefix)),
    [prefix]
  );
}
