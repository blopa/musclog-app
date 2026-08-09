import { usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { useTranslation } from 'react-i18next';

import websiteRoutes from './websiteRoutes.json';

const SITE_ORIGIN = 'https://musclog.app';
const SEO_IMAGE_PATH = '/images/seo-image.png';
const SEO_IMAGE_WIDTH = '1224';
const SEO_IMAGE_HEIGHT = '741';

export type WebsiteSeoRouteKey = keyof typeof websiteRoutes;

interface WebsiteRoute {
  /** Canonical path, e.g. `/faq`. */
  path: string;
  /** `robots` directive; indexable routes omit it and get `index, follow`. */
  robots?: string;
}

/**
 * The website's route registry, widened to its contract once here so nothing
 * downstream deals with the raw JSON shape. `websiteRoutes.json` is also read
 * by `scripts/generate-web-seo-files.js` (robots.txt / sitemap.xml / llms.txt),
 * which is the point: adding a public route is a single edit there, not the
 * same list maintained in four places.
 */
const WEBSITE_ROUTES: Record<WebsiteSeoRouteKey, WebsiteRoute> = websiteRoutes;

const OG_LOCALE_BY_LANGUAGE: Record<string, string> = {
  'en-us': 'en_US',
  'es-es': 'es_ES',
  'nl-nl': 'nl_NL',
  'pt-br': 'pt_BR',
  'ru-ru': 'ru_RU',
};

const ROUTE_KEY_BY_PATH: Record<string, WebsiteSeoRouteKey> = {
  // Inverse of the registry, derived so a new route only needs its JSON entry.
  ...(Object.fromEntries(
    Object.entries(WEBSITE_ROUTES).map(([key, route]) => [route.path, key])
  ) as Record<string, WebsiteSeoRouteKey>),
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
  const pageUrl = absoluteUrl(canonicalPath ?? WEBSITE_ROUTES[routeKey].path);
  const imageUrl = absoluteUrl(SEO_IMAGE_PATH);
  const robots = WEBSITE_ROUTES[routeKey].robots ?? 'index, follow';
  const locale = ogLocaleForLanguage(i18n.resolvedLanguage ?? i18n.language);
  const alternateLocales = Object.values(OG_LOCALE_BY_LANGUAGE).filter((l) => l !== locale);

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
      {alternateLocales.map((alt) => (
        <meta key={alt} property="og:locale:alternate" content={alt} />
      ))}
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

export interface BlogPostSeoProps {
  canonicalPath: string;
  category: string;
  date: string;
  description: string;
  tags: string[];
  title: string;
}

export function BlogPostSeo({
  canonicalPath,
  category,
  date,
  description,
  tags,
  title,
}: BlogPostSeoProps) {
  const { i18n, t } = useTranslation();
  const siteName = t('website.seo.siteName');
  const imageAlt = t('website.seo.imageAlt');
  const pageTitle = `${title} | ${siteName}`;
  const pageDescription = description || title;
  const pageUrl = absoluteUrl(canonicalPath);
  const imageUrl = absoluteUrl(SEO_IMAGE_PATH);
  const locale = ogLocaleForLanguage(i18n.resolvedLanguage ?? i18n.language);
  const alternateLocales = Object.values(OG_LOCALE_BY_LANGUAGE).filter((l) => l !== locale);
  const keywords = [t('website.seo.keywords'), ...tags].join(', ');

  return (
    <Head>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <meta name="keywords" content={keywords} />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={pageUrl} />

      <meta property="og:type" content="article" />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={locale} />
      {alternateLocales.map((alt) => (
        <meta key={alt} property="og:locale:alternate" content={alt} />
      ))}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:secure_url" content={imageUrl} />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content={SEO_IMAGE_WIDTH} />
      <meta property="og:image:height" content={SEO_IMAGE_HEIGHT} />
      <meta property="og:image:alt" content={imageAlt} />
      <meta property="article:published_time" content={`${date}T00:00:00.000Z`} />
      <meta property="article:section" content={category} />
      {tags.map((tag) => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={imageAlt} />
    </Head>
  );
}
