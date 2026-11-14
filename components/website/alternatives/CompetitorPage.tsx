import { useTranslation } from 'react-i18next';

import { StoreButtons } from '@/components/website/StoreButtons';
import {
  BODY_TEXT,
  BODY_TEXT_SOFT,
  BRAND_GREEN_BRIGHT,
  CARD_BORDER,
  ink,
} from '@/components/website/websiteColors';

import { COMPETITORS, type CompetitorId } from './competitors';

interface FactCopy {
  topic: string;
  them: string;
  musclog: string;
}

/**
 * One /alternatives/<app> page: dated, sourced facts about the other app beside what Musclog does,
 * an honest "which one fits you", and how to bring a workout history over. The facts' sources are
 * in `competitors.ts` (one link per row); the wording is in `websiteAlternativesPages`.
 */
export function CompetitorPage({ id }: { id: CompetitorId }) {
  const { i18n, t } = useTranslation(undefined, { keyPrefix: 'websiteAlternativesPages' });
  const { t: layoutT } = useTranslation(undefined, { keyPrefix: 'websiteTools.layout' });
  const language = i18n.resolvedLanguage ?? i18n.language;
  const competitor = COMPETITORS.find((entry) => entry.id === id)!;
  const name = competitor.name;
  const facts = t(`apps.${id}.facts`, { returnObjects: true }) as FactCopy[];
  const importText = t(`apps.${id}.import`);
  const checkedOn = new Intl.DateTimeFormat(language, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${competitor.checkedOn}T00:00:00Z`));

  return (
    <main className="pb-20 pt-28">
      <div className="container mx-auto max-w-5xl px-4">
        <a
          href="/alternatives"
          className="text-sm font-semibold transition-colors hover:text-accent-primary"
          style={{ color: BODY_TEXT_SOFT }}
        >
          {t('shared.allComparisons')}
        </a>
        <h1 className="mb-3 mt-3 text-4xl font-bold tracking-tight text-text-primary md:text-5xl">
          {t('shared.title', { name })}
        </h1>
        <p className="mb-3 max-w-3xl text-base leading-relaxed" style={{ color: BODY_TEXT }}>
          {t(`apps.${id}.intro`)}
        </p>
        <p className="mb-8 max-w-3xl text-sm" style={{ color: BODY_TEXT_SOFT }}>
          {t('shared.checked', { name, date: checkedOn })}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr style={{ color: BODY_TEXT_SOFT }}>
                <th className="pb-2 pr-4 font-semibold">{t('shared.colTopic')}</th>
                <th className="pb-2 pr-4 font-semibold">{name}</th>
                <th className="pb-2 font-semibold">{t('shared.colMusclog')}</th>
              </tr>
            </thead>
            <tbody>
              {facts.map((fact, index) => (
                <tr
                  key={fact.topic}
                  className="border-t align-top"
                  style={{ borderColor: CARD_BORDER }}
                >
                  <td className="py-3 pr-4 font-semibold text-text-primary">{fact.topic}</td>
                  <td className="py-3 pr-4" style={{ color: BODY_TEXT }}>
                    {fact.them}{' '}
                    <a
                      href={competitor.sources[index]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="whitespace-nowrap underline underline-offset-2"
                      style={{ color: BRAND_GREEN_BRIGHT }}
                    >
                      {t('shared.source')}
                    </a>
                  </td>
                  <td className="py-3" style={{ color: BODY_TEXT }}>
                    {fact.musclog}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-10 max-w-3xl">
          <h2 className="mb-3 text-2xl font-bold text-text-primary">{t('shared.chooseTitle')}</h2>
          <p className="mb-2 text-base leading-relaxed" style={{ color: BODY_TEXT }}>
            {t(`apps.${id}.chooseThem`)}
          </p>
          <p className="text-base leading-relaxed" style={{ color: BODY_TEXT }}>
            {t(`apps.${id}.chooseMusclog`)}
          </p>
        </section>

        {competitor.hasImport ? (
          <section className="mt-10 max-w-3xl">
            <h2 className="mb-3 text-2xl font-bold text-text-primary">{t('shared.importTitle')}</h2>
            <p className="text-base leading-relaxed" style={{ color: BODY_TEXT }}>
              {importText}
            </p>
          </section>
        ) : null}

        <section className="mt-10 max-w-3xl border-t pt-8" style={{ borderColor: ink(0.08) }}>
          <h2 className="mb-2 text-2xl font-bold text-text-primary">{layoutT('ctaTitle')}</h2>
          <p className="mb-5 text-base leading-relaxed" style={{ color: BODY_TEXT }}>
            {layoutT('ctaBody')}
          </p>
          <StoreButtons />
          <p className="mt-6 text-xs" style={{ color: BODY_TEXT_SOFT }}>
            {t('shared.nonAffiliation', { name })}
          </p>
        </section>
      </div>
    </main>
  );
}
