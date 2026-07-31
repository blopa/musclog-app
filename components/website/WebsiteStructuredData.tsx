import Head from 'expo-router/head';

const SITE_ORIGIN = 'https://musclog.app';
const SITE_NAME = 'Musclog';
const LOGO_URL = `${SITE_ORIGIN}/images/seo-image.png`;
const SAME_AS = ['https://github.com/blopa/musclog-app', 'https://instagram.com/musclog.app'];

/**
 * JSON-LD must be embedded via dangerouslySetInnerHTML, not JSX children —
 * React HTML-escapes text children (e.g. `"` -> `&quot;`), but browsers
 * never decode HTML entities inside <script> content, which would corrupt
 * the JSON. `<` is additionally escaped so a value containing "</script>"
 * can't prematurely close the tag.
 */
function jsonLdHtml(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') };
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
    <Head>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(graph)} />
    </Head>
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
    <Head>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(schema)} />
    </Head>
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
    <Head>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(schema)} />
    </Head>
  );
}
