import type { Metadata } from 'expo-router/server';

import en from '@/lang/locales/en-us/website.json';
import es from '@/lang/locales/es-es/website.json';
import nl from '@/lang/locales/nl-nl/website.json';
import pt from '@/lang/locales/pt-br/website.json';
import ru from '@/lang/locales/ru-ru/website.json';

import { blogListingPath } from './blogRoutes';
import websiteRoutes from './websiteRoutes.json';

export type WebsiteSeoRouteKey = keyof typeof websiteRoutes;
export const SITE_ORIGIN = 'https://musclog.app';

export function absoluteUrl(path: string): string {
  return /^https?:\/\//i.test(path)
    ? path
    : `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export const SEO_IMAGE_URL = absoluteUrl('/images/seo-image.png');
const translations = {
  'en-us': en.website,
  'es-es': es.website,
  'nl-nl': nl.website,
  'pt-br': pt.website,
  'ru-ru': ru.website,
};
const locales = {
  'en-us': 'en_US',
  'es-es': 'es_ES',
  'nl-nl': 'nl_NL',
  'pt-br': 'pt_BR',
  'ru-ru': 'ru_RU',
};

export function websiteCopy(language = 'en-us') {
  return translations[language.toLowerCase() as keyof typeof translations] ?? translations['en-us'];
}

export type PageSeo = {
  title: string;
  description: string;
  canonicalPath: string;
  robots?: string;
  keywords?: string;
  date?: string;
  category?: string;
  tags?: string[];
};

export function metadataForPage(page: PageSeo, language = 'en-us'): Metadata {
  const copy = websiteCopy(language).seo;
  const locale = locales[language.toLowerCase() as keyof typeof locales] ?? locales['en-us'];
  return {
    title: page.title,
    description: page.description,
    keywords: page.keywords ?? copy.keywords,
    robots: page.robots ?? 'index, follow',
    alternates: { canonical: absoluteUrl(page.canonicalPath) },
    openGraph: {
      type: page.date ? 'article' : 'website',
      title:
        page.date || page.category ? page.title.replace(` | ${copy.siteName}`, '') : page.title,
      description: page.description,
      siteName: copy.siteName,
      locale,
      alternateLocale: Object.values(locales).filter((value) => value !== locale),
      url: absoluteUrl(page.canonicalPath),
      images: [
        {
          url: SEO_IMAGE_URL,
          secureUrl: SEO_IMAGE_URL,
          type: 'image/png',
          width: 1224,
          height: 741,
          alt: copy.imageAlt,
        },
      ],
      ...(page.date
        ? { publishedTime: `${page.date}T00:00:00.000Z`, section: page.category, tags: page.tags }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      images: [{ url: SEO_IMAGE_URL, alt: copy.imageAlt }],
    },
  };
}

export function fixedPageSeo(
  routeKey: WebsiteSeoRouteKey,
  language = 'en-us',
  canonicalPath?: string
): PageSeo {
  const route = websiteRoutes[routeKey] as { path: string; robots?: string };
  const copy = websiteCopy(language).seo.routes[routeKey];
  return { ...copy, canonicalPath: canonicalPath ?? route.path, robots: route.robots };
}

export function fixedPageMetadata(routeKey: WebsiteSeoRouteKey): Metadata {
  return metadataForPage(fixedPageSeo(routeKey));
}

export function blogListingSeo(page: number, category?: string, language = 'en-us'): PageSeo {
  const copy = websiteCopy(language);
  if (!category) {
    return fixedPageSeo('blog', language, blogListingPath(page));
  }

  const categoryLabel =
    copy.blog.categories[category as keyof typeof copy.blog.categories] ?? category;
  const interpolate = (value: string) => value.replace(/{{category}}/g, categoryLabel);
  const title = interpolate(copy.blog.categoryPage.title);
  return {
    title: `${title}${page === 1 ? '' : ` — ${copy.blog.pageLabel.replace(/{{page}}/g, String(page))}`} | ${copy.seo.siteName}`,
    description: interpolate(copy.blog.categoryPage.description),
    canonicalPath: blogListingPath(page, category),
    category: categoryLabel,
    keywords: `${copy.seo.keywords}, ${categoryLabel}`,
  };
}
