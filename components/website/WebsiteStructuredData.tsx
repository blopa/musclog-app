import { GITHUB_REPO_URL } from '@/constants/misc';

import { blogPostPath } from './blogRoutes';
import { SITE_ORIGIN } from './websiteMetadata';

const SITE_NAME = 'Musclog';
const LOGO_URL = `${SITE_ORIGIN}/images/seo-image.png`;
const SAME_AS = [GITHUB_REPO_URL, 'https://instagram.com/musclog.app'];

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
        url: SITE_ORIGIN,
        logo: LOGO_URL,
        sameAs: SAME_AS,
      },
      {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_ORIGIN,
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
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    url: SITE_ORIGIN,
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
  const url = `${SITE_ORIGIN}${canonicalPath}`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: posts.length,
      itemListElement: posts.map((post, index) => ({
        '@type': 'ListItem',
        position: positionOffset + index + 1,
        name: post.title,
        url: `${SITE_ORIGIN}${blogPostPath(post.slug)}`,
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
  const url = `${SITE_ORIGIN}${canonicalPath}`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: description || title,
    datePublished: date,
    articleSection: category,
    keywords: tags,
    image: LOGO_URL,
    mainEntityOfPage: url,
    url,
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_ORIGIN,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_ORIGIN,
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
