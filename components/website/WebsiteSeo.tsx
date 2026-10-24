import { usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { useTranslation } from 'react-i18next';

import {
  absoluteUrl,
  fixedPageSeo,
  metadataForPage,
  type PageSeo,
  SEO_IMAGE_URL,
  websiteCopy,
  type WebsiteSeoRouteKey,
} from './websiteMetadata';
import websiteRoutes from './websiteRoutes.json';

const ROUTE_KEY_BY_PATH: Record<string, WebsiteSeoRouteKey> = {
  ...Object.fromEntries(Object.entries(websiteRoutes).map(([key, route]) => [route.path, key])),
  '/home': 'home',
} as Record<string, WebsiteSeoRouteKey>;

function PageMetadata({ page }: { page: PageSeo }) {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const metadata = metadataForPage(page, language);
  const og = metadata.openGraph!;
  return (
    <Head>
      <title>{page.title}</title>
      <meta name="description" content={page.description} />
      <meta name="keywords" content={page.keywords ?? websiteCopy(language).seo.keywords} />
      <meta name="robots" content={page.robots ?? 'index, follow'} />
      <link rel="canonical" href={absoluteUrl(page.canonicalPath)} />
      <meta property="og:type" content={og.type} />
      <meta property="og:site_name" content={og.siteName} />
      <meta property="og:locale" content={og.locale} />
      {og.alternateLocale?.map((locale) => (
        <meta key={locale} property="og:locale:alternate" content={locale} />
      ))}
      <meta property="og:title" content={og.title} />
      <meta property="og:description" content={page.description} />
      <meta property="og:url" content={og.url} />
      <meta property="og:image" content={SEO_IMAGE_URL} />
      <meta property="og:image:secure_url" content={SEO_IMAGE_URL} />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content="1224" />
      <meta property="og:image:height" content="741" />
      <meta property="og:image:alt" content={websiteCopy(language).seo.imageAlt} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={page.title} />
      <meta name="twitter:description" content={page.description} />
      <meta name="twitter:image" content={SEO_IMAGE_URL} />
      <meta name="twitter:image:alt" content={websiteCopy(language).seo.imageAlt} />
      {page.date ? <meta property="article:published_time" content={og.publishedTime} /> : null}
      {page.date ? <meta property="article:section" content={page.category} /> : null}
      {page.tags?.map((tag) => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}
    </Head>
  );
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
  const { i18n } = useTranslation();
  return (
    <PageMetadata
      page={fixedPageSeo(routeKey, i18n.resolvedLanguage ?? i18n.language, canonicalPath)}
    />
  );
}

export interface BlogCategorySeoProps {
  canonicalPath: string;
  category: string;
  description: string;
  title: string;
}

export function BlogCategorySeo(props: BlogCategorySeoProps) {
  const { i18n } = useTranslation();
  const copy = websiteCopy(i18n.resolvedLanguage ?? i18n.language);
  return (
    <PageMetadata
      page={{
        ...props,
        title: `${props.title} | ${copy.seo.siteName}`,
        keywords: `${copy.seo.keywords}, ${props.category}`,
      }}
    />
  );
}

export interface BlogPostSeoProps extends BlogCategorySeoProps {
  date: string;
  tags: string[];
}

export function BlogPostSeo(props: BlogPostSeoProps) {
  const { i18n } = useTranslation();
  const copy = websiteCopy(i18n.resolvedLanguage ?? i18n.language);
  return (
    <PageMetadata
      page={{
        ...props,
        title: `${props.title} | ${copy.seo.siteName}`,
        description: props.description || props.title,
        keywords: [copy.seo.keywords, ...props.tags].join(', '),
      }}
    />
  );
}
