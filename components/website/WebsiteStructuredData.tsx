import { useTranslation } from 'react-i18next';

import { GITHUB_REPO_URL } from '@/constants/misc';

import { blogPostPath } from './blogRoutes';
import {
  DEFAULT_LOCALE_PREFIX,
  localeForLanguage,
  localizedPath,
  parsePublicPath,
} from './localeRoutes';
import { absoluteUrl, seoImageUrl } from './websiteMetadata';

const SITE_NAME = 'Musclog';
const LOGO_URL = seoImageUrl(DEFAULT_LOCALE_PREFIX);
const SAME_AS = [GITHUB_REPO_URL, 'https://instagram.com/musclog.app'];
/** The organisation and the site are one entity in every language, named by the default-language home. */
const ENTITY_URL = absoluteUrl(localizedPath('/', DEFAULT_LOCALE_PREFIX));

/**
 * The absolute, localized URL of a page (given by its LOGICAL path) in the visitor's language, and
 * the `hreflang` of the language that URL is in (the blog has English copy only, so a Spanish
 * visitor's post URL is `/en/blog/…` and says `en`).
 */
function usePageLocation(path: string): { inLanguage: string; url: string } {
  const { i18n } = useTranslation();
  const { prefix } = localeForLanguage(i18n.resolvedLanguage ?? i18n.language);
  const localized = localizedPath(path, prefix);

  return {
    inLanguage: (parsePublicPath(localized).locale ?? localeForLanguage('en')).hreflang,
    url: absoluteUrl(localized),
  };
}

/** Escape script terminators before embedding JSON-LD in prerendered HTML. */
function jsonLdText(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * Sitewide Organization + WebSite JSON-LD, mounted once in the website layout
 * so every route carries a consistent entity graph for AI/LLM crawlers and
 * search engines to anchor citations to. See components/website/WebsiteSeo.tsx
 * for the per-route title/description/OG/Twitter metadata this complements.
 */
export function WebsiteOrganizationJsonLd() {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: SITE_NAME,
        url: ENTITY_URL,
        logo: LOGO_URL,
        sameAs: SAME_AS,
      },
      {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: ENTITY_URL,
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(graph) }} />
    </>
  );
}

/**
 * SoftwareApplication JSON-LD for the home page. No aggregateRating/review
 * fields — never fabricate those, only add them once real store ratings can
 * be sourced (Google penalizes misleading structured data).
 */
export function SoftwareApplicationJsonLd({ description }: { description: string }) {
  const { inLanguage, url } = usePageLocation('/');
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    url,
    inLanguage,
    description,
    operatingSystem: 'ANDROID, IOS',
    applicationCategory: 'HealthApplication',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(schema) }} />
    </>
  );
}

/**
 * WebApplication JSON-LD for a free in-browser tool (/tools/*). Free, no rating or review fields:
 * those only ever come from real sources, and misleading structured data is penalised.
 */
export function WebApplicationJsonLd({
  name,
  description,
  path,
}: {
  name: string;
  description: string;
  path: string;
}) {
  const { inLanguage, url } = usePageLocation(path);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    description,
    url,
    inLanguage,
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Any',
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    provider: { '@type': 'Organization', name: SITE_NAME, url: ENTITY_URL },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(schema) }} />
    </>
  );
}

export interface FaqPageJsonLdItem {
  question: string;
  answer: string;
}

/** FAQPage JSON-LD for the /faq route, built from the same items it renders. */
export function FaqPageJsonLd({ items }: { items: FaqPageJsonLdItem[] }) {
  if (items.length === 0) {
    return null;
  }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(schema) }} />
    </>
  );
}

interface BlogListingJsonLdPost {
  slug: string;
  title: string;
}

interface BlogListingJsonLdProps {
  canonicalPath: string;
  description: string;
  positionOffset: number;
  posts: BlogListingJsonLdPost[];
  title: string;
}

/**
 * CollectionPage JSON-LD for one statically generated page of the blog index — all posts or one
 * category. Nothing here is category-specific; the caller passes the page's own title and posts.
 */
export function BlogListingJsonLd({
  canonicalPath,
  description,
  positionOffset,
  posts,
  title,
}: BlogListingJsonLdProps) {
  const { inLanguage, url } = usePageLocation(canonicalPath);
  const { i18n } = useTranslation();
  const { prefix } = localeForLanguage(i18n.resolvedLanguage ?? i18n.language);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url,
    inLanguage,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: posts.length,
      itemListElement: posts.map((post, index) => ({
        '@type': 'ListItem',
        position: positionOffset + index + 1,
        name: post.title,
        url: absoluteUrl(localizedPath(blogPostPath(post.slug), prefix)),
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(schema) }} />
    </>
  );
}

interface BlogPostingJsonLdProps {
  canonicalPath: string;
  category: string;
  date: string;
  description: string;
  tags: string[];
  title: string;
}

/** BlogPosting JSON-LD built from the same frontmatter rendered by the post page. */
export function BlogPostingJsonLd({
  canonicalPath,
  category,
  date,
  description,
  tags,
  title,
}: BlogPostingJsonLdProps) {
  const { inLanguage, url } = usePageLocation(canonicalPath);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: description || title,
    inLanguage,
    datePublished: date,
    articleSection: category,
    keywords: tags,
    image: LOGO_URL,
    mainEntityOfPage: url,
    url,
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: ENTITY_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: ENTITY_URL,
      logo: {
        '@type': 'ImageObject',
        url: LOGO_URL,
      },
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(schema) }} />
    </>
  );
}
