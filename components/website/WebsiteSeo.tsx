import { usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { useTranslation } from 'react-i18next';

const SITE_ORIGIN = 'https://musclog.app';
const SEO_IMAGE_PATH = '/images/seo-image.png';
const SEO_IMAGE_WIDTH = '1224';
const SEO_IMAGE_HEIGHT = '741';

const ROUTE_PATHS = {
  calculator: '/calculator',
  contact: '/contact',
  download: '/download',
  exercises: '/exercises',
  faq: '/faq',
  gameboy: '/gameboy',
  home: '/',
  privacy: '/privacy',
  progress: '/progress',
  repMarker: '/rep-marker',
  terms: '/terms',
  test: '/test',
} as const;

const ROUTE_ROBOTS: Partial<Record<WebsiteSeoRouteKey, string>> = {
  test: 'noindex, nofollow, noarchive',
};

const OG_LOCALE_BY_LANGUAGE: Record<string, string> = {
  'en-us': 'en_US',
  'es-es': 'es_ES',
  'nl-nl': 'nl_NL',
  'pt-br': 'pt_BR',
  'ru-ru': 'ru_RU',
};

export type WebsiteSeoRouteKey = keyof typeof ROUTE_PATHS;

const ROUTE_KEY_BY_PATH: Record<string, WebsiteSeoRouteKey> = {
  // Inverse of ROUTE_PATHS, derived so a new route only needs one entry above.
  ...(Object.fromEntries(Object.entries(ROUTE_PATHS).map(([k, v]) => [v, k])) as Record<
    string,
    WebsiteSeoRouteKey
  >),
  // Expo Router may expose the home screen under /home as well as /.
  '/home': 'home',
};

function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

function ogLocaleForLanguage(language: string | undefined): string {
  if (language == null) {
    return OG_LOCALE_BY_LANGUAGE['en-us'];
  }

  return OG_LOCALE_BY_LANGUAGE[language.toLowerCase()] ?? OG_LOCALE_BY_LANGUAGE['en-us'];
}

function normalizePathname(pathname: string | null | undefined): string {
  if (!pathname) {
    return '/';
  }

  const pathOnly = pathname.split(/[?#]/)[0] || '/';
  return pathOnly.length > 1 ? pathOnly.replace(/\/+$/, '') : pathOnly;
}

function routeKeyForPathname(pathname: string | null | undefined): WebsiteSeoRouteKey | null {
  return ROUTE_KEY_BY_PATH[normalizePathname(pathname)] ?? null;
}

export function WebsiteSeoForCurrentRoute({
  fallbackRouteKey,
}: {
  fallbackRouteKey?: WebsiteSeoRouteKey;
}) {
  const pathname = usePathname();
  const routeKey = routeKeyForPathname(pathname) ?? fallbackRouteKey ?? null;

  return routeKey == null ? null : <WebsiteSeo routeKey={routeKey} />;
}

export function WebsiteSeo({
  canonicalPath,
  routeKey,
}: {
  canonicalPath?: string;
  routeKey: WebsiteSeoRouteKey;
}) {
  const { i18n, t } = useTranslation();
  const title = t(`website.seo.routes.${routeKey}.title`);
  const description = t(`website.seo.routes.${routeKey}.description`);
  const siteName = t('website.seo.siteName');
  const imageAlt = t('website.seo.imageAlt');
  const keywords = t('website.seo.keywords');
  const pageUrl = absoluteUrl(canonicalPath ?? ROUTE_PATHS[routeKey]);
  const imageUrl = absoluteUrl(SEO_IMAGE_PATH);
  const robots = ROUTE_ROBOTS[routeKey] ?? 'index, follow';
  const locale = ogLocaleForLanguage(i18n.resolvedLanguage ?? i18n.language);

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={pageUrl} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={locale} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:secure_url" content={imageUrl} />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content={SEO_IMAGE_WIDTH} />
      <meta property="og:image:height" content={SEO_IMAGE_HEIGHT} />
      <meta property="og:image:alt" content={imageAlt} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={imageAlt} />
    </Head>
  );
}
