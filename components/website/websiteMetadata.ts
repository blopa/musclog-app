import type { GenerateMetadataFunction, Metadata } from 'expo-router/server';

import en from '@/lang/locales/en-us/website.json';
import es from '@/lang/locales/es-es/website.json';
import nl from '@/lang/locales/nl-nl/website.json';
import pt from '@/lang/locales/pt-br/website.json';
import ru from '@/lang/locales/ru-ru/website.json';

import { blogListingPath, blogTagPath } from './blogRoutes';
import {
  hreflangAlternatePaths,
  localeByPrefix,
  localeForLanguage,
  localePrefixesFor,
  localizedPath,
} from './localeRoutes';
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
const OG_LOCALES = ['en_US', 'es_ES', 'nl_NL', 'pt_BR', 'ru_RU'];

export function websiteCopy(language = 'en-us') {
  return translations[language.toLowerCase() as keyof typeof translations] ?? translations['en-us'];
}

export type PageSeo = {
  title: string;
  description: string;
  /** The LOGICAL path (`/tools/protein-calculator`); the language prefix is added per locale. */
  canonicalPath: string;
  robots?: string;
  keywords?: string;
  date?: string;
  category?: string;
  tags?: string[];
};

export function metadataForPage(page: PageSeo, language = 'en-us'): Metadata {
  const copy = websiteCopy(language).seo;
  const wanted = localeForLanguage(language);
  // A page with no copy in the visitor's language (the blog) is published in English only, and so
  // is its canonical; an unprefixed page (`/open`) keeps its address.
  const available = localePrefixesFor(page.canonicalPath);
  const prefix = available.includes(wanted.prefix)
    ? wanted.prefix
    : (available[0] ?? wanted.prefix);
  const locale = localeByPrefix(prefix).ogLocale;
  const canonicalUrl = absoluteUrl(localizedPath(page.canonicalPath, prefix));
  const alternates = hreflangAlternatePaths(page.canonicalPath);
  return {
    title: page.title,
    description: page.description,
    keywords: page.keywords ?? copy.keywords,
    robots: page.robots ?? 'index, follow',
    alternates: {
      canonical: canonicalUrl,
      ...(alternates.length > 0
        ? {
            languages: Object.fromEntries(
              alternates.map(([hreflang, path]) => [hreflang, absoluteUrl(path)])
            ),
          }
        : {}),
    },
    openGraph: {
      type: page.date ? 'article' : 'website',
      title:
        page.date || page.category ? page.title.replace(` | ${copy.siteName}`, '') : page.title,
      description: page.description,
      siteName: copy.siteName,
      locale,
      alternateLocale: OG_LOCALES.filter((value) => value !== locale),
      url: canonicalUrl,
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

export function fixedPageMetadata(routeKey: WebsiteSeoRouteKey, language = 'en-us'): Metadata {
  return metadataForPage(fixedPageSeo(routeKey, language), language);
}

/** The i18n language of a route's `[locale]` param (`pt-br` -> `pt-BR`); English when absent. */
export function languageForLocaleParam(param: string | string[] | undefined): string {
  return localeByPrefix(Array.isArray(param) ? param[0] : param).language;
}

/**
 * The `generateMetadata` export of a page with a fixed route key: the page's own copy for the
 * `[locale]` the route was exported for, with its canonical and `hreflang` alternates.
 */
export function fixedMetadataFor(routeKey: WebsiteSeoRouteKey): GenerateMetadataFunction {
  return (_request, params) => fixedPageMetadata(routeKey, languageForLocaleParam(params?.locale));
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

/** SEO for one page of a tag's listing. `tagLabel` is the tag as written on the posts. */
export function blogTagSeo(
  page: number,
  tag: string,
  tagLabel: string,
  language = 'en-us'
): PageSeo {
  const copy = websiteCopy(language);
  const interpolate = (value: string) => value.replace(/{{tag}}/g, tagLabel);
  const title = interpolate(copy.blog.tagPage.title);
  return {
    title: `${title}${page === 1 ? '' : ` — ${copy.blog.pageLabel.replace(/{{page}}/g, String(page))}`} | ${copy.seo.siteName}`,
    description: interpolate(copy.blog.tagPage.description),
    canonicalPath: blogTagPath(tag, page),
    category: tagLabel,
    keywords: `${copy.seo.keywords}, ${tagLabel}`,
  };
}
