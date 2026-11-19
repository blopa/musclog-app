import { ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { StoreButtons } from '@/components/website/StoreButtons';
import {
  stripSiteName,
  TOOL_GROUPS,
  type ToolGroup,
  toolPath,
  TOOLS,
} from '@/components/website/tools/toolsRegistry';
import { useWebsiteHref } from '@/components/website/useWebsiteHref';
import { BODY_TEXT, BRAND_GREEN_BRIGHT, ink } from '@/components/website/websiteColors';
import { fixedMetadataFor, fixedPageSeo } from '@/components/website/websiteMetadata';
import websiteRoutes from '@/components/website/websiteRoutes.json';
import { localeStaticParams } from '@/components/website/localeStaticParams';

/** Whole keys, so `check-translations` sees every one of them. */
const GROUP_COPY: Record<ToolGroup, { title: string; body: string }> = {
  strength: {
    title: 'index.groups.strength.title',
    body: 'index.groups.strength.body',
  },
  training: {
    title: 'index.groups.training.title',
    body: 'index.groups.training.body',
  },
  nutrition: {
    title: 'index.groups.nutrition.title',
    body: 'index.groups.nutrition.body',
  },
};

type ToolRowProps = { href: string; title: string; description: string };

function ToolRow({ href: path, title, description }: ToolRowProps) {
  const href = useWebsiteHref();

  return (
    <li className="border-b" style={{ borderColor: ink(0.08) }}>
      <a href={href(path)} className="group flex items-start gap-4 py-4">
        <span className="min-w-0 flex-1">
          <span
            className="block text-lg font-bold underline-offset-4 group-hover:underline"
            style={{ color: BRAND_GREEN_BRIGHT }}
          >
            {title}
          </span>
          <span className="mt-1 block text-sm leading-relaxed" style={{ color: BODY_TEXT }}>
            {description}
          </span>
        </span>
        <ArrowRight
          size={18}
          color={BRAND_GREEN_BRIGHT}
          className="mt-1.5 shrink-0 transition-transform group-hover:translate-x-1"
        />
      </a>
    </li>
  );
}

export default function ToolsIndexPage() {
  const { i18n, t } = useTranslation(undefined, { keyPrefix: 'websiteTools' });
  const language = i18n.resolvedLanguage ?? i18n.language;

  return (
    <main className="pb-20 pt-28">
      <div className="container mx-auto max-w-5xl px-4">
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-text-primary md:text-5xl">
          {t('index.title')}
        </h1>
        <p className="mb-12 max-w-2xl text-base leading-relaxed" style={{ color: BODY_TEXT }}>
          {t('index.intro')}
        </p>

        {TOOL_GROUPS.map((group) => (
          <section
            key={group}
            className="grid gap-x-12 gap-y-2 border-t py-8 md:grid-cols-[1fr_2fr]"
            style={{ borderColor: ink(0.08) }}
          >
            <div>
              <h2 className="text-2xl font-bold text-text-primary">{t(GROUP_COPY[group].title)}</h2>
              <p className="mt-2 max-w-xs text-sm leading-relaxed" style={{ color: BODY_TEXT }}>
                {t(GROUP_COPY[group].body)}
              </p>
            </div>
            <ul className="border-t md:border-t-0" style={{ borderColor: ink(0.08) }}>
              {TOOLS.filter((tool) => tool.group === group).map(({ key, routeKey }) => {
                const seo = fixedPageSeo(routeKey, language);
                return (
                  <ToolRow
                    key={key}
                    href={toolPath(key)}
                    title={stripSiteName(seo.title)}
                    description={seo.description}
                  />
                );
              })}
              {group === 'training' ? (
                <ToolRow
                  href={websiteRoutes.programs.path}
                  title={t('index.programsTitle')}
                  description={t('index.programsBody')}
                />
              ) : null}
            </ul>
          </section>
        ))}

        <section className="mt-4 max-w-3xl border-t pt-10" style={{ borderColor: ink(0.08) }}>
          <h2 className="mb-2 text-2xl font-bold text-text-primary">{t('layout.ctaTitle')}</h2>
          <p className="mb-5 text-base leading-relaxed" style={{ color: BODY_TEXT }}>
            {t('layout.ctaBody')}
          </p>
          <StoreButtons />
        </section>
      </div>
    </main>
  );
}

export const generateStaticParams = localeStaticParams;

export const generateMetadata = fixedMetadataFor('tools');
