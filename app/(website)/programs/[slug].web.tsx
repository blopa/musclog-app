import { useLocalSearchParams } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { exerciseSearchPath } from '@/components/website/exerciseSearchParam';
import { PROGRAM_SLUGS, programPath } from '@/components/website/programRoutes';
import {
  getProgram,
  programOpenUrl,
  workoutCount,
} from '@/components/website/programs/programsModel';
import { StoreButtons } from '@/components/website/StoreButtons';
import {
  BODY_TEXT,
  BODY_TEXT_SOFT,
  BRAND_GREEN,
  BRAND_GREEN_BRIGHT,
  CARD_BORDER,
  ink,
  MUTED,
  ON_BRAND,
} from '@/components/website/websiteColors';
import { metadataForPage, websiteCopy } from '@/components/website/websiteMetadata';
import { WebsitePageSeo } from '@/components/website/WebsiteSeo';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import enPrograms from '@/lang/locales/en-us/websitePrograms.json';

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return PROGRAM_SLUGS.map((slug) => ({ slug }));
}

export default function ProgramPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { i18n, t } = useTranslation(undefined, { keyPrefix: 'websitePrograms' });
  const { t: layoutT } = useTranslation(undefined, { keyPrefix: 'websiteTools.layout' });
  const { formatInteger } = useFormatAppNumber();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const program = useMemo(() => getProgram(String(slug), language), [slug, language]);
  const summaries = t('summaries', { returnObjects: true }) as Record<string, string>;
  const how = t('detail.how', { returnObjects: true }) as string[];

  if (!program) {
    return (
      <main className="pb-20 pt-28">
        <div className="container mx-auto max-w-5xl px-4">
          <h1 className="mb-3 text-3xl font-bold text-text-primary">{t('detail.notFoundTitle')}</h1>
          <p className="mb-4 text-base" style={{ color: BODY_TEXT }}>
            {t('detail.notFoundBody')}
          </p>
          <a
            href="/programs"
            className="font-semibold underline"
            style={{ color: BRAND_GREEN_BRIGHT }}
          >
            {t('detail.allPrograms')}
          </a>
        </div>
      </main>
    );
  }

  const dayLabel = (position: number) => t('detail.dayLabel', { n: formatInteger(position) });
  const summary = summaries[program.slug] ?? program.description ?? '';
  const copy = websiteCopy(language);
  const reps = (min: number | undefined, top: number) =>
    min === undefined ? formatInteger(top) : `${formatInteger(min)}–${formatInteger(top)}`;

  return (
    <main className="pb-20 pt-28">
      <WebsitePageSeo
        page={{
          title: `${t('detail.metaTitle', { title: program.title })} | ${copy.seo.siteName}`,
          description: summary,
          canonicalPath: programPath(program.slug),
        }}
      />
      <div className="container mx-auto max-w-5xl px-4">
        <a
          href="/programs"
          className="text-sm font-semibold transition-colors hover:text-accent-primary"
          style={{ color: BODY_TEXT_SOFT }}
        >
          {t('detail.allPrograms')}
        </a>
        <h1 className="mb-3 mt-3 text-4xl font-bold tracking-tight text-text-primary md:text-5xl">
          {program.title}
        </h1>
        <p className="mb-2 text-sm font-semibold" style={{ color: BODY_TEXT_SOFT }}>
          {t(`difficulty.${program.difficulty}`)} ·{' '}
          {t('index.workouts', { count: workoutCount(program) })}
          {program.durationMinutes
            ? ` · ${t('index.minutes', { minutes: program.durationMinutes })}`
            : ''}
        </p>
        <p className="mb-8 max-w-3xl text-base leading-relaxed" style={{ color: BODY_TEXT }}>
          {summary}
        </p>

        <section className="mb-10 max-w-3xl">
          <h2 className="mb-2 text-xl font-bold text-text-primary">{t('detail.openTitle')}</h2>
          <p className="mb-4 text-base leading-relaxed" style={{ color: BODY_TEXT }}>
            {t('detail.openBody')}
          </p>
          <a
            href={programOpenUrl(program, dayLabel)}
            className="inline-flex min-h-11 items-center rounded-control px-5 py-2.5 text-sm font-bold"
            style={{ backgroundColor: BRAND_GREEN, color: ON_BRAND }}
          >
            {t('detail.openButton')}
          </a>
        </section>

        {program.days.map((day) => (
          <section key={day.position} className="mb-8">
            <h2 className="mb-3 text-2xl font-bold text-text-primary">
              {day.name ?? dayLabel(day.position)}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr style={{ color: BODY_TEXT_SOFT }}>
                    <th className="pb-2 pr-3 font-semibold">{t('detail.exercise')}</th>
                    <th className="pb-2 pr-3 font-semibold">{t('detail.setsReps')}</th>
                    <th className="pb-2 font-semibold">{t('detail.rest')}</th>
                  </tr>
                </thead>
                <tbody>
                  {day.exercises.map((exercise, index) => (
                    <tr
                      key={`${exercise.exerciseSlug}-${index}`}
                      className="border-t align-top"
                      style={{ borderColor: CARD_BORDER }}
                    >
                      <td className="py-2 pr-3">
                        <a
                          href={exerciseSearchPath(exercise.name)}
                          className="font-semibold text-text-primary underline-offset-2 hover:underline"
                        >
                          {exercise.name}
                        </a>
                        {exercise.supersetGroup ? (
                          <span className="ml-2 text-xs" style={{ color: MUTED }}>
                            {t('detail.supersetGroup', { group: exercise.supersetGroup })}
                          </span>
                        ) : null}
                        {exercise.notes ? (
                          <span className="mt-0.5 block text-xs" style={{ color: MUTED }}>
                            {exercise.notes}
                          </span>
                        ) : null}
                      </td>
                      <td
                        className="whitespace-nowrap py-2 pr-3 tabular-nums"
                        style={{ color: BODY_TEXT }}
                      >
                        {formatInteger(exercise.sets)} × {reps(exercise.minReps, exercise.reps)}
                      </td>
                      <td
                        className="whitespace-nowrap py-2 tabular-nums"
                        style={{ color: BODY_TEXT }}
                      >
                        {exercise.restSeconds === undefined
                          ? ''
                          : t('detail.restSeconds', {
                              seconds: formatInteger(exercise.restSeconds),
                            })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <section className="mt-10 max-w-3xl border-t pt-8" style={{ borderColor: ink(0.08) }}>
          <h2 className="mb-3 text-2xl font-bold text-text-primary">{t('detail.howTitle')}</h2>
          {how.map((paragraph) => (
            <p
              key={paragraph}
              className="mb-3 text-base leading-relaxed"
              style={{ color: BODY_TEXT }}
            >
              {paragraph}
            </p>
          ))}
        </section>

        <section className="mt-10 max-w-3xl border-t pt-8" style={{ borderColor: ink(0.08) }}>
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

export const generateMetadata: GenerateMetadataFunction = async (_request, params) => {
  const program = getProgram(String(params.slug), 'en-US');
  const copy = websiteCopy();
  if (!program) {
    return metadataForPage({
      title: `${copy.seo.siteName}`,
      description: copy.seo.routes.programs.description,
      canonicalPath: '/programs',
      robots: 'noindex, nofollow',
    });
  }

  const programsCopy = enPrograms.websitePrograms;
  const summaries = programsCopy.summaries as Record<string, string>;
  return metadataForPage({
    title: `${programsCopy.detail.metaTitle.replace('{{title}}', program.title)} | ${copy.seo.siteName}`,
    description: summaries[program.slug] ?? copy.seo.routes.programs.description,
    canonicalPath: programPath(program.slug),
  });
};
