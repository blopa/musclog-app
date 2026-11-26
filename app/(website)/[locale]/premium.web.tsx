import { useTranslation } from 'react-i18next';

import { AiGatewayLinks } from '@/components/website/AiGatewayLinks';
import { localeStaticParams } from '@/components/website/localeStaticParams';
import { useWebsiteHref } from '@/components/website/useWebsiteHref';
import {
  BODY_TEXT_SOFT,
  BRAND_GREEN_BRIGHT,
  HEADING_TEXT,
  ink,
  MUTED,
  ON_BRAND,
} from '@/components/website/websiteColors';
import { fixedMetadataFor } from '@/components/website/websiteMetadata';
import { FaqPageJsonLd } from '@/components/website/WebsiteStructuredData';

interface PremiumFaqItem {
  q: string;
  a: string;
}

const SECTION_CLASS = 'border-t py-10';

export default function Premium() {
  const { t } = useTranslation(undefined, { keyPrefix: 'websitePremium' });
  const href = useWebsiteHref();

  const freeItems = t('free.items', { returnObjects: true }) as string[];
  const steps = t('how.steps', { returnObjects: true }) as string[];
  const subscriptionItems = t('subscription.items', { returnObjects: true }) as string[];
  const faqItems = t('faq.items', { returnObjects: true }) as PremiumFaqItem[];

  const linkStyle = { color: BRAND_GREEN_BRIGHT };

  return (
    <>
      <FaqPageJsonLd items={faqItems.map((item) => ({ question: item.q, answer: item.a }))} />
      <main className="pb-24 pt-24">
        <div className="container mx-auto max-w-3xl px-4">
          <header className="pb-10">
            <h1 className="mb-4 text-4xl font-bold md:text-5xl" style={{ color: HEADING_TEXT }}>
              {t('hero.title')}
            </h1>
            <p
              className="mb-6 text-base leading-relaxed md:text-lg"
              style={{ color: BODY_TEXT_SOFT }}
            >
              {t('hero.lead')}
            </p>
            <a
              href={href('/download')}
              className="inline-flex items-center rounded-control px-6 py-3 text-sm font-bold"
              style={{ backgroundColor: BRAND_GREEN_BRIGHT, color: ON_BRAND }}
            >
              {t('hero.cta')}
            </a>
            <p className="mt-3 text-sm" style={{ color: MUTED }}>
              {t('hero.note')}
            </p>
          </header>

          <section className={SECTION_CLASS} style={{ borderColor: ink(0.1) }}>
            <h2 className="mb-3 text-2xl font-bold" style={{ color: HEADING_TEXT }}>
              {t('free.title')}
            </h2>
            <p className="mb-4 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
              {t('free.body')}
            </p>
            <ul className="list-disc space-y-2 pl-5" style={{ color: BODY_TEXT_SOFT }}>
              {freeItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className={SECTION_CLASS} style={{ borderColor: ink(0.1) }}>
            <h2 className="mb-3 text-2xl font-bold" style={{ color: HEADING_TEXT }}>
              {t('how.title')}
            </h2>
            <ol className="list-decimal space-y-2 pl-5" style={{ color: BODY_TEXT_SOFT }}>
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <section className={SECTION_CLASS} style={{ borderColor: ink(0.1) }}>
            <h2 className="mb-3 text-2xl font-bold" style={{ color: HEADING_TEXT }}>
              {t('allowance.title')}
            </h2>
            <p className="mb-3 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
              {t('allowance.body')}
            </p>
            <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
              {t('allowance.usedUp')}
            </p>
          </section>

          <section className={SECTION_CLASS} style={{ borderColor: ink(0.1) }}>
            <h2 className="mb-3 text-2xl font-bold" style={{ color: HEADING_TEXT }}>
              {t('privacy.title')}
            </h2>
            <p className="mb-3 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
              {t('privacy.body')}
            </p>
            <AiGatewayLinks />
            <p className="mb-3 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
              {t('privacy.consent')}
            </p>
            <a href={href('/privacy')} className="font-medium hover:underline" style={linkStyle}>
              {t('privacy.link')}
            </a>
          </section>

          <section className={SECTION_CLASS} style={{ borderColor: ink(0.1) }}>
            <h2 className="mb-3 text-2xl font-bold" style={{ color: HEADING_TEXT }}>
              {t('subscription.title')}
            </h2>
            <ul className="mb-4 list-disc space-y-2 pl-5" style={{ color: BODY_TEXT_SOFT }}>
              {subscriptionItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <a href={href('/terms')} className="font-medium hover:underline" style={linkStyle}>
              {t('subscription.terms')}
            </a>
          </section>

          <section className={SECTION_CLASS} style={{ borderColor: ink(0.1) }}>
            <h2 className="mb-4 text-2xl font-bold" style={{ color: HEADING_TEXT }}>
              {t('faq.title')}
            </h2>
            <dl className="space-y-5">
              {faqItems.map((item) => (
                <div key={item.q}>
                  <dt className="mb-1 font-semibold" style={{ color: HEADING_TEXT }}>
                    {item.q}
                  </dt>
                  <dd className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </main>
    </>
  );
}

export const generateStaticParams = localeStaticParams;

export const generateMetadata = fixedMetadataFor('premium');
