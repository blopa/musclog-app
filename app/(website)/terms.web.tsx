import { AlertTriangle, FileText, Mail, Scale } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { DotPattern } from '@/components/website/WebsiteBackgrounds';

const BRAND_GREEN_BRIGHT = '#00FFA3';
const BODY_TEXT_SOFT = '#9CA3AF';
const MUTED = '#6B7280';

export default function Terms() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.terms' });

  const highlights = [
    {
      icon: FileText,
      title: t('highlights.agreement.title'),
      description: t('highlights.agreement.description'),
    },
    {
      icon: Scale,
      title: t('highlights.liability.title'),
      description: t('highlights.liability.description'),
    },
    {
      icon: AlertTriangle,
      title: t('highlights.warranty.title'),
      description: t('highlights.warranty.description'),
    },
  ];

  const definitionItems = [
    {
      term: t('sections.definitions.application.term'),
      def: t('sections.definitions.application.def'),
    },
    { term: t('sections.definitions.company.term'), def: t('sections.definitions.company.def') },
    { term: t('sections.definitions.device.term'), def: t('sections.definitions.device.def') },
    { term: t('sections.definitions.service.term'), def: t('sections.definitions.service.def') },
    { term: t('sections.definitions.you.term'), def: t('sections.definitions.you.def') },
  ];

  const sections = [
    {
      title: t('sections.interpretation.title'),
      content: (
        <>
          <p className="mb-4 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
            {t('sections.interpretation.content1')}
          </p>
          <p className="mb-4 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
            {t('sections.interpretation.content2')}
          </p>
          <ul className="space-y-2 text-sm" style={{ color: BODY_TEXT_SOFT }}>
            {definitionItems.map(({ term, def }) => (
              <li key={term} className="flex gap-2">
                <span className="mt-0.5 text-white">›</span>
                <span>
                  <strong className="text-white">{term}:</strong> {def}
                </span>
              </li>
            ))}
          </ul>
        </>
      ),
    },
    {
      title: t('sections.acknowledgment.title'),
      content: (
        <>
          <p className="mb-4 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
            {t('sections.acknowledgment.content1')}
          </p>
          <p className="mb-4 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
            {t('sections.acknowledgment.content2')}
          </p>
          <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
            {t('sections.acknowledgment.content3')}
          </p>
        </>
      ),
    },
    {
      title: t('sections.links.title'),
      content: (
        <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
          {t('sections.links.content')}
        </p>
      ),
    },
    {
      title: t('sections.termination.title'),
      content: (
        <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
          {t('sections.termination.content')}
        </p>
      ),
    },
    {
      title: t('sections.liability.title'),
      content: (
        <>
          <p className="mb-4 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
            {t('sections.liability.content1')}
          </p>
          <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
            {t('sections.liability.content2')}
          </p>
        </>
      ),
    },
    {
      title: t('sections.disclaimer.title'),
      content: (
        <>
          <p className="mb-4 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
            {t('sections.disclaimer.content1')}
          </p>
          <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
            {t('sections.disclaimer.content2')}
          </p>
        </>
      ),
    },
    {
      title: t('sections.governingLaw.title'),
      content: (
        <>
          <p className="mb-4 leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
            {t('sections.governingLaw.content1')}
          </p>
          <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
            {t('sections.governingLaw.content2')}
          </p>
        </>
      ),
    },
    {
      title: t('sections.changes.title'),
      content: (
        <p className="leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
          {t('sections.changes.content')}
        </p>
      ),
    },
  ];

  return (
    <main className="relative overflow-hidden pb-20 pt-24">
      <DotPattern className="text-primary/30" />
      <div className="from-background/50 to-background/50 absolute inset-0 bg-gradient-to-b via-transparent" />

      <div className="container relative z-10 mx-auto max-w-5xl px-4">
        {/* Title */}
        <div className="mb-10 text-center">
          <h1 className="mb-3 text-4xl font-bold text-white md:text-5xl">
            {t('titleStart')} <span style={{ color: BRAND_GREEN_BRIGHT }}>{t('conditions')}</span>
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
                borderColor: 'rgba(255,255,255,0.1)',
                backgroundColor: 'rgba(255,255,255,0.03)',
              }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full border"
                style={{
                  backgroundColor: 'rgba(34,197,94,0.1)',
                  borderColor: 'rgba(34,197,94,0.2)',
                }}
              >
                <Icon className="h-5 w-5" color={BRAND_GREEN_BRIGHT} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
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
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-3 text-xl font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                {section.title}
              </h2>
              {section.content}
            </section>
          ))}
        </div>

        {/* Contact callout */}
        <div
          className="mt-14 rounded-xl border p-6"
          style={{
            borderColor: 'rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(255,255,255,0.03)',
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <Mail className="h-5 w-5" color={BRAND_GREEN_BRIGHT} />
            <h3 className="font-semibold text-white">{t('contact.title')}</h3>
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
  );
}
