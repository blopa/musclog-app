import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { programPath } from '@/components/website/programRoutes';
import { listPrograms, workoutCount } from '@/components/website/programs/programsModel';
import { StoreButtons } from '@/components/website/StoreButtons';
import {
  BODY_TEXT,
  BODY_TEXT_SOFT,
  BRAND_GREEN_BRIGHT,
  ink,
} from '@/components/website/websiteColors';
import { fixedPageMetadata } from '@/components/website/websiteMetadata';

export default function ProgramsIndexPage() {
  const { i18n, t } = useTranslation(undefined, { keyPrefix: 'websitePrograms' });
  const { t: layoutT } = useTranslation(undefined, { keyPrefix: 'websiteTools.layout' });
  const language = i18n.resolvedLanguage ?? i18n.language;
  const programs = useMemo(() => listPrograms(language), [language]);
  const summaries = t('summaries', { returnObjects: true }) as Record<string, string>;

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
          {programs.map((program) => (
            <li key={program.slug} className="border-b py-5" style={{ borderColor: ink(0.08) }}>
              <a href={programPath(program.slug)} className="group block">
                <h2
                  className="text-xl font-bold underline-offset-4 group-hover:underline"
                  style={{ color: BRAND_GREEN_BRIGHT }}
                >
                  {program.title}
                </h2>
                <p className="mt-1 text-sm font-semibold" style={{ color: BODY_TEXT_SOFT }}>
                  {t(`difficulty.${program.difficulty}`)} ·{' '}
                  {t('index.workouts', { count: workoutCount(program) })}
                  {program.durationMinutes
                    ? ` · ${t('index.minutes', { minutes: program.durationMinutes })}`
                    : ''}
                </p>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed" style={{ color: BODY_TEXT }}>
                  {summaries[program.slug]}
                </p>
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-sm">
          <a
            href="/exercises"
            className="font-semibold underline underline-offset-2"
            style={{ color: BRAND_GREEN_BRIGHT }}
          >
            {t('index.exercisesLink')}
          </a>
        </p>

        <section className="mt-12 max-w-3xl border-t pt-8" style={{ borderColor: ink(0.08) }}>
          <h2 className="mb-2 text-2xl font-bold text-text-primary">{layoutT('ctaTitle')}</h2>
          <p className="mb-5 text-base leading-relaxed" style={{ color: BODY_TEXT }}>
            {layoutT('ctaBody')}
          </p>
          <StoreButtons />
        </section>
      </div>
    </main>
  );
}

export function generateMetadata() {
  return fixedPageMetadata('programs');
}
