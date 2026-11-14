import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { StoreButtons } from '@/components/website/StoreButtons';
import {
  BODY_TEXT,
  BODY_TEXT_SOFT,
  BRAND_GREEN_BRIGHT,
  ink,
} from '@/components/website/websiteColors';
import { fixedPageSeo } from '@/components/website/websiteMetadata';
import websiteRoutes from '@/components/website/websiteRoutes.json';
import { WebApplicationJsonLd } from '@/components/website/WebsiteStructuredData';

import { stripSiteName, type ToolKey, toolPath, type ToolRouteKey, TOOLS } from './toolsRegistry';

export interface ToolSection {
  title: string;
  /** Paragraphs, in order. */
  body: string[];
}

export interface ToolSource {
  label: string;
  href: string;
}

interface ToolLayoutProps {
  routeKey: ToolRouteKey;
  title: string;
  intro: string;
  /** The interactive part: the form and its results. */
  children: ReactNode;
  /** "How it works": plain explanation under the tool. */
  sections?: ToolSection[];
  /** Studies and references behind the numbers, linked. */
  sources?: ToolSource[];
  /** Other tools worth a link from this one. */
  related?: ToolKey[];
}

/**
 * The frame every /tools page shares: heading, the tool itself, plain-language explanation,
 * sources, links to sibling tools and the one call to action (the store buttons). The page owns
 * its copy and passes it in translated, so a new tool is a form and a function, not a layout.
 */
export function ToolLayout({
  routeKey,
  title,
  intro,
  children,
  sections = [],
  sources = [],
  related = [],
}: ToolLayoutProps) {
  const { i18n, t } = useTranslation(undefined, { keyPrefix: 'websiteTools.layout' });
  const language = i18n.resolvedLanguage ?? i18n.language;
  const seo = fixedPageSeo(routeKey, language);

  return (
    <main className="pb-20 pt-28">
      <WebApplicationJsonLd
        name={stripSiteName(seo.title)}
        description={seo.description}
        path={websiteRoutes[routeKey].path}
      />
      <div className="container mx-auto max-w-5xl px-4">
        <a
          href="/tools"
          className="text-sm font-semibold transition-colors hover:text-accent-primary"
          style={{ color: BODY_TEXT_SOFT }}
        >
          {t('allTools')}
        </a>
        <h1 className="mb-3 mt-3 text-4xl font-bold tracking-tight text-text-primary md:text-5xl">
          {title}
        </h1>
        <p className="mb-8 max-w-2xl text-base leading-relaxed" style={{ color: BODY_TEXT }}>
          {intro}
        </p>

        {children}

        {sections.length > 0 ? (
          <section className="mt-12 max-w-3xl border-t pt-8" style={{ borderColor: ink(0.08) }}>
            <h2 className="mb-4 text-2xl font-bold text-text-primary">{t('howItWorks')}</h2>
            {sections.map((section) => (
              <div key={section.title} className="mb-6">
                <h3 className="mb-2 text-lg font-bold text-text-primary">{section.title}</h3>
                {section.body.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="mb-3 text-base leading-relaxed"
                    style={{ color: BODY_TEXT }}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            ))}
            <p className="text-sm" style={{ color: BODY_TEXT_SOFT }}>
              {t('sameMath')} {t('localOnly')}
            </p>
          </section>
        ) : null}

        {sources.length > 0 ? (
          <section className="mt-8 max-w-3xl">
            <h2 className="mb-3 text-lg font-bold text-text-primary">{t('sources')}</h2>
            <ul className="space-y-2 text-sm">
              {sources.map((source) => (
                <li key={source.href}>
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                    style={{ color: BRAND_GREEN_BRIGHT }}
                  >
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {related.length > 0 ? (
          <section className="mt-8 max-w-3xl border-t pt-8" style={{ borderColor: ink(0.08) }}>
            <h2 className="mb-3 text-lg font-bold text-text-primary">{t('related')}</h2>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
              {related.map((key) => {
                const tool = TOOLS.find((entry) => entry.key === key)!;
                return (
                  <li key={key}>
                    <a
                      href={toolPath(key)}
                      className="underline underline-offset-2"
                      style={{ color: BRAND_GREEN_BRIGHT }}
                    >
                      {stripSiteName(fixedPageSeo(tool.routeKey, language).title)}
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="mt-12 max-w-3xl border-t pt-8" style={{ borderColor: ink(0.08) }}>
          <h2 className="mb-2 text-2xl font-bold text-text-primary">{t('ctaTitle')}</h2>
          <p className="mb-5 text-base leading-relaxed" style={{ color: BODY_TEXT }}>
            {t('ctaBody')}
          </p>
          <StoreButtons />
        </section>
      </div>
    </main>
  );
}
