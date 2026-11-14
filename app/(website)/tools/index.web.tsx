import { useTranslation } from 'react-i18next';

import { StoreButtons } from '@/components/website/StoreButtons';
import { stripSiteName, TOOLS, toolPath } from '@/components/website/tools/toolsRegistry';
import { BODY_TEXT, BRAND_GREEN_BRIGHT, ink } from '@/components/website/websiteColors';
import { fixedPageMetadata, fixedPageSeo } from '@/components/website/websiteMetadata';
import websiteRoutes from '@/components/website/websiteRoutes.json';

export default function ToolsIndexPage() {
  const { i18n, t } = useTranslation(undefined, { keyPrefix: 'websiteTools' });
  const language = i18n.resolvedLanguage ?? i18n.language;

  return (
    <main className="pb-20 pt-28">
      <div className="container mx-auto max-w-5xl px-4">
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-text-primary md:text-5xl">
          {t('index.title')}
        </h1>
        <p className="mb-10 max-w-2xl text-base leading-relaxed" style={{ color: BODY_TEXT }}>
          {t('index.intro')}
        </p>

        <ul className="border-t" style={{ borderColor: ink(0.08) }}>
          {TOOLS.map(({ key, routeKey }) => {
            const seo = fixedPageSeo(routeKey, language);
            return (
              <li key={key} className="border-b py-5" style={{ borderColor: ink(0.08) }}>
                <a href={toolPath(key)} className="group block">
                  <h2
                    className="text-xl font-bold underline-offset-4 group-hover:underline"
                    style={{ color: BRAND_GREEN_BRIGHT }}
                  >
                    {stripSiteName(seo.title)}
                  </h2>
                  <p
                    className="mt-1 max-w-3xl text-sm leading-relaxed"
                    style={{ color: BODY_TEXT }}
                  >
                    {seo.description}
                  </p>
                </a>
              </li>
            );
          })}
          <li className="border-b py-5" style={{ borderColor: ink(0.08) }}>
            <a href={websiteRoutes.programs.path} className="group block">
              <h2
                className="text-xl font-bold underline-offset-4 group-hover:underline"
                style={{ color: BRAND_GREEN_BRIGHT }}
              >
                {t('index.programsTitle')}
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed" style={{ color: BODY_TEXT }}>
                {t('index.programsBody')}
              </p>
            </a>
          </li>
        </ul>

        <section className="mt-12 max-w-3xl">
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

export function generateMetadata() {
  return fixedPageMetadata('tools');
}
