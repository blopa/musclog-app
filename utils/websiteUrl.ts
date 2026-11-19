import { localeForLanguage, localizedPath } from '@/components/website/localeRoutes';

const SITE_ORIGIN = 'https://musclog.app';

/**
 * The public URL of a website page in the app's language (`/terms`, `es-ES` ->
 * `https://musclog.app/es/terms`). Every website page lives under a language prefix, and an address
 * without one only forwards to English, so the app links to the prefixed one directly.
 */
export function websitePageUrl(path: string, language: string | undefined): string {
  return `${SITE_ORIGIN}${localizedPath(path, localeForLanguage(language).prefix)}`;
}
