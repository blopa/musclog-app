import { Database, Globe, Lock, Mail, Shield, Smartphone } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { DotPattern } from '@/components/website/WebsiteBackgrounds';
import {
  BODY_TEXT_SOFT,
  brand,
  BRAND_GREEN_BRIGHT,
  brandBright,
  hue,
  ink,
  MUTED,
} from '@/components/website/websiteColors';

const DEFINITION_KEYS = [
  'account',
  'application',
  'company',
  'device',
  'personalData',
  'service',
  'serviceProvider',
  'usageData',
  'you',
] as const;

export default function Privacy() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.privacy' });

  const highlights = [
    {
      icon: Shield,
      title: t('highlights.dataProtection.title'),
      description: t('highlights.dataProtection.description'),
    },
    {
      icon: Database,
      title: t('highlights.localFirst.title'),
      description: t('highlights.localFirst.description'),
    },
    {
      icon: Lock,
      title: t('highlights.security.title'),
      description: t('highlights.security.description'),
    },
  ];

  const typesCollectedItems = t('sections.collecting.typesCollected.items', {
    returnObjects: true,
  }) as string[];
  const googleOAuthItems = t('sections.collecting.googleOAuth.items', {
    returnObjects: true,
  }) as string[];
  const appPermissionsItems = t('sections.collecting.appPermissions.items', {
    returnObjects: true,
  }) as string[];
  const useOfDataItems = t('sections.useOfData.items', { returnObjects: true }) as string[];
  const sharingItems = t('sections.sharing.items', { returnObjects: true }) as string[];
  const disclosureItems = t('sections.disclosure.items', { returnObjects: true }) as string[];
  const analyticsItems = t('sections.analytics.items', { returnObjects: true }) as string[];
  const appItems = t('appVsWebsite.app.items', { returnObjects: true }) as string[];
  const websiteItems = t('appVsWebsite.website.items', { returnObjects: true }) as string[];

  const scopePanels = [
    {
      key: 'app',
      icon: Smartphone,
      title: t('appVsWebsite.app.title'),
      summary: t('appVsWebsite.app.summary'),
      items: appItems,
      accent: BRAND_GREEN_BRIGHT,
      borderColor: 'rgb(var(--c-ink-DEFAULT)/0.25)',
      backgroundColor: brandBright(0.04),
      badgeBackground: brandBright(0.12),
      badgeBorder: brandBright(0.22),
    },
    {
      key: 'website',
      icon: Globe,
      title: t('appVsWebsite.website.title'),
      summary: t('appVsWebsite.website.summary'),
      items: websiteItems,
      accent: hue('info'),
      borderColor: hue('info', 0.25),
      backgroundColor: hue('info', 0.04),
      badgeBackground: hue('info', 0.12),
      badgeBorder: hue('info', 0.22),
    },
  ];

  return (
    <>
      <main className="relative overflow-hidden pb-20 pt-24">
        <DotPattern className="text-accent-primary/30" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg-primary/50 via-transparent to-bg-primary/50" />

        <div className="container relative z-10 mx-auto max-w-5xl px-4">
          {/* Title */}
          <div className="mb-10 text-center">
            <h1 className="mb-3 text-4xl font-bold text-text-primary md:text-5xl">
              {t('titleStart')}{' '}
              <span style={{ color: BRAND_GREEN_BRIGHT }}>{t('titleHighlight')}</span>
            </h1>
            <p className="text-sm" style={{ color: MUTED }}>
              {t('lastUpdated')}
            </p>
          </div>

          {/* Highlight cards */}
          <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {highlights.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex flex-col items-center gap-3 rounded-xl border p-5 text-center"
                style={{
                  borderColor: ink(0.1),
                  backgroundColor: ink(0.03),
                }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full border"
                  style={{
                    backgroundColor: brand(0.1),
                    borderColor: brand(0.2),
                  }}
                >
                  <Icon className="h-5 w-5" color={BRAND_GREEN_BRIGHT} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{title}</p>
                  <p className="mt-0.5 text-xs" style={{ color: MUTED }}>
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Intro */}
          <p className="mb-10 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
            {t('intro')}
          </p>

          {/* Sections */}
          <div className="space-y-10">
            {/* Scope */}
            <section>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('sections.scope.title')}
              </h2>
              <p className="mb-5 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.scope.content')}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                {scopePanels.map(
                  ({
                    key,
                    icon: Icon,
                    title,
                    summary,
                    items,
                    accent,
                    borderColor,
                    backgroundColor,
                    badgeBackground,
                    badgeBorder,
                  }) => (
                    <div
                      key={key}
                      className="rounded-2xl border p-5"
                      style={{ borderColor, backgroundColor }}
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-full border"
                          style={{ backgroundColor: badgeBackground, borderColor: badgeBorder }}
                        >
                          <Icon className="h-5 w-5" color={accent} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-text-primary">{title}</h3>
                        </div>
                      </div>

                      <p className="mb-4 text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                        {summary}
                      </p>

                      <ul className="space-y-2 text-sm" style={{ color: BODY_TEXT_SOFT }}>
                        {items.map((item, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="mt-0.5 shrink-0" style={{ color: accent }}>
                              ›
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                )}
              </div>
            </section>

            {/* Interpretation and Definitions */}
            <section>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('sections.interpretation.title')}
              </h2>
              <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.interpretation.content')}
              </p>
            </section>

            {/* Definitions */}
            <section>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('sections.definitions.title')}
              </h2>
              <ul className="space-y-2 text-sm" style={{ color: BODY_TEXT_SOFT }}>
                {DEFINITION_KEYS.map((key) => (
                  <li key={key} className="flex gap-2">
                    <span className="mt-0.5 text-text-primary">›</span>
                    <span>
                      <strong className="text-text-primary">
                        {t(`sections.definitions.items.${key}.term`)}:
                      </strong>{' '}
                      {t(`sections.definitions.items.${key}.def`)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Collecting and Using Your Personal Data */}
            <section>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('sections.collecting.title')}
              </h2>
              <p className="mb-6 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.collecting.content')}
              </p>

              <div className="space-y-6">
                {/* Types of Data Collected */}
                <div>
                  <h3 className="mb-2 text-base font-semibold text-text-primary">
                    {t('sections.collecting.typesCollected.title')}
                  </h3>
                  <p className="mb-3 text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                    {t('sections.collecting.typesCollected.content')}
                  </p>
                  <ul className="space-y-1.5 text-sm" style={{ color: BODY_TEXT_SOFT }}>
                    {typesCollectedItems.map((item, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-0.5 text-text-primary">›</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Google OAuth Data */}
                <div>
                  <h3 className="mb-2 text-base font-semibold text-text-primary">
                    {t('sections.collecting.googleOAuth.title')}
                  </h3>
                  <p className="mb-3 text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                    {t('sections.collecting.googleOAuth.content')}
                  </p>
                  <ul className="space-y-1.5 text-sm" style={{ color: BODY_TEXT_SOFT }}>
                    {googleOAuthItems.map((item, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-0.5 text-text-primary">›</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Usage Data */}
                <div>
                  <h3 className="mb-2 text-base font-semibold text-text-primary">
                    {t('sections.collecting.usageData.title')}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                    {t('sections.collecting.usageData.content')}
                  </p>
                </div>

                {/* App Permissions */}
                <div>
                  <h3 className="mb-2 text-base font-semibold text-text-primary">
                    {t('sections.collecting.appPermissions.title')}
                  </h3>
                  <p className="mb-3 text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                    {t('sections.collecting.appPermissions.content')}
                  </p>
                  <ul className="space-y-1.5 text-sm" style={{ color: BODY_TEXT_SOFT }}>
                    {appPermissionsItems.map((item, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-0.5 text-text-primary">›</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Optional AI Providers */}
                <div>
                  <h3 className="mb-2 text-base font-semibold text-text-primary">
                    {t('sections.collecting.optionalAi.title')}
                  </h3>
                  <p className="mb-4 text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                    {t('sections.collecting.optionalAi.content1')}
                  </p>
                  <p className="mb-4 text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                    {t('sections.collecting.optionalAi.content2')}
                  </p>
                  <p className="mb-4 text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                    {t('sections.collecting.optionalAi.content3')}
                  </p>
                  <p className="mb-4 text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                    {t('sections.collecting.optionalAi.content4')}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                    {t('sections.collecting.optionalAi.content5')}{' '}
                    <a
                      href="https://www.cloudflare.com/privacypolicy/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                      style={{ color: BRAND_GREEN_BRIGHT }}
                    >
                      {t('sections.collecting.optionalAi.cloudflarePrivacyPolicy')}
                    </a>
                    ,{' '}
                    <a
                      href="https://openai.com/policies/privacy-policy/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                      style={{ color: BRAND_GREEN_BRIGHT }}
                    >
                      {t('sections.collecting.optionalAi.openaiPrivacyPolicy')}
                    </a>
                    ,{' '}
                    <a
                      href="https://policies.google.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                      style={{ color: BRAND_GREEN_BRIGHT }}
                    >
                      {t('sections.collecting.optionalAi.googlePrivacyPolicy')}
                    </a>
                    , {t('sections.collecting.optionalAi.and')}{' '}
                    <a
                      href="https://www.apple.com/legal/privacy/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                      style={{ color: BRAND_GREEN_BRIGHT }}
                    >
                      {t('sections.collecting.optionalAi.applePrivacyPolicy')}
                    </a>
                    .
                  </p>
                </div>
              </div>
            </section>

            {/* Voluntary Training Data Contribution */}
            <section>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('sections.trainingData.title')}
              </h2>
              <p className="mb-4 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.trainingData.content1')}
              </p>
              <p className="mb-4 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.trainingData.content2')}
              </p>
              <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.trainingData.content3')}
              </p>
            </section>

            {/* Use of Your Personal Data */}
            <section>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('sections.useOfData.title')}
              </h2>
              <ul className="space-y-2 text-sm" style={{ color: BODY_TEXT_SOFT }}>
                {useOfDataItems.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 text-text-primary">›</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Sharing Your Personal Data */}
            <section>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('sections.sharing.title')}
              </h2>
              <ul className="space-y-2 text-sm" style={{ color: BODY_TEXT_SOFT }}>
                {sharingItems.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 text-text-primary">›</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Retention */}
            <section>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('sections.retention.title')}
              </h2>
              <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.retention.content')}
              </p>
            </section>

            {/* Transfer */}
            <section>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('sections.transfer.title')}
              </h2>
              <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.transfer.content')}
              </p>
            </section>

            {/* Delete */}
            <section>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('sections.deletion.title')}
              </h2>
              <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.deletion.content')}
              </p>
            </section>

            {/* Disclosure */}
            <section>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('sections.disclosure.title')}
              </h2>
              <p className="mb-3 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.disclosure.content')}
              </p>
              <ul className="space-y-1.5 text-sm" style={{ color: BODY_TEXT_SOFT }}>
                {disclosureItems.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 text-text-primary">›</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Security */}
            <section>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('sections.security.title')}
              </h2>
              <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.security.content')}
              </p>
            </section>

            {/* Children's Privacy */}
            <section>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('sections.childrenPrivacy.title')}
              </h2>
              <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.childrenPrivacy.content')}
              </p>
            </section>

            {/* Links to Other Websites */}
            <section>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('sections.links.title')}
              </h2>
              <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.links.content')}
              </p>
            </section>

            {/* Changes */}
            <section>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('sections.changes.title')}
              </h2>
              <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.changes.content')}
              </p>
            </section>

            {/* Google Play */}
            <section>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('sections.googlePlay.title')}
              </h2>
              <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.googlePlay.content')}
              </p>
            </section>

            {/* Anonymous Crash Reporting Fallback */}
            <section>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('sections.errorReportingFallback.title')}
              </h2>
              <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.errorReportingFallback.content')}
              </p>
            </section>

            {/* Website Analytics */}
            <section>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('sections.analytics.title')}
              </h2>
              <p className="mb-4 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.analytics.content1')}
              </p>
              <p className="mb-4 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.analytics.content2')}
              </p>
              <p className="mb-3 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.analytics.content3')}
              </p>
              <ul className="mb-4 space-y-1.5 text-sm" style={{ color: BODY_TEXT_SOFT }}>
                {analyticsItems.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 text-text-primary">›</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mb-4 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.analytics.content4')}
              </p>
              <p className="mb-4 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.analytics.content5')}{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  style={{ color: BRAND_GREEN_BRIGHT }}
                >
                  {t('sections.analytics.googlePrivacyPolicy')}
                </a>
                .
              </p>
              <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                {t('sections.analytics.content6')}
              </p>
            </section>
          </div>

          {/* Contact callout */}
          <div
            className="mt-14 rounded-xl border p-6"
            style={{
              borderColor: ink(0.1),
              backgroundColor: ink(0.03),
            }}
          >
            <div className="mb-2 flex items-center gap-2">
              <Mail className="h-5 w-5" color={BRAND_GREEN_BRIGHT} />
              <h3 className="font-semibold text-text-primary">{t('contact.title')}</h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
              {t('contact.content')}{' '}
              <a
                href="mailto:support@musclog.app"
                className="hover:underline"
                style={{ color: BRAND_GREEN_BRIGHT }}
              >
                support@musclog.app
              </a>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
