import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { localeStaticParams } from '@/components/website/localeStaticParams';
import { ChoiceField, ToolNotice, ToolPanel } from '@/components/website/tools/ToolFields';
import { ToolLayout, type ToolSection } from '@/components/website/tools/ToolLayout';
import { useToolUnits } from '@/components/website/tools/useToolState';
import {
  checkLogCsv,
  LOG_DOWNLOADS,
  type LogCheck,
} from '@/components/website/tools/workoutLogTemplateModel';
import {
  BODY_TEXT,
  BODY_TEXT_SOFT,
  BRAND_GREEN_BRIGHT,
  CARD_BORDER,
  INPUT_BG,
  INPUT_BORDER,
  MUTED,
} from '@/components/website/websiteColors';
import { fixedMetadataFor } from '@/components/website/websiteMetadata';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { withExpoBaseUrl } from '@/utils/withExpoBaseUrl';

type CheckState = LogCheck | { ok: false; problem: 'read' } | null;

export default function WorkoutLogTemplateToolPage() {
  const { t } = useTranslation(undefined, { keyPrefix: 'websiteToolWorkoutLogTemplate' });
  const { formatInteger } = useFormatAppNumber();
  const [units, setUnits] = useToolUnits();
  const [check, setCheck] = useState<CheckState>(null);
  const sections = t('sections', { returnObjects: true }) as ToolSection[];

  // The file is read in the browser and never sent anywhere.
  const readFile = async (file: File | undefined) => {
    if (!file) {
      setCheck(null);
      return;
    }

    try {
      const text = await file.text();
      setCheck(checkLogCsv(text, units === 'imperial' ? 'lbs' : 'kg', new Date()));
    } catch {
      setCheck({ ok: false, problem: 'read' });
    }
  };

  return (
    <ToolLayout
      routeKey="toolWorkoutLogTemplate"
      title={t('title')}
      intro={t('intro')}
      sections={sections}
      articles={[
        { label: t('articles.trackProgress'), href: '/blog/2026/11/how-to-track-gym-progress' },
        {
          label: t('articles.importHistory'),
          href: '/blog/2026/11/move-your-workout-history-from-strong-hevy-or-fitnotes',
        },
      ]}
      related={['progressiveOverload', 'warmUpCalculator', 'rpeChart']}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <ToolPanel title={t('downloads.title')}>
          <ul className="space-y-4">
            {LOG_DOWNLOADS.map((download) => (
              <li
                key={download.key}
                className="border-b pb-4 last:border-b-0 last:pb-0"
                style={{ borderColor: CARD_BORDER }}
              >
                <a
                  href={withExpoBaseUrl(`/downloads/${download.file}`)}
                  download
                  className="text-base font-bold underline underline-offset-2"
                  style={{ color: BRAND_GREEN_BRIGHT }}
                >
                  {t(`downloads.${download.key}`)}
                </a>
                <p className="mt-1 text-sm" style={{ color: BODY_TEXT_SOFT }}>
                  {t(`downloads.${download.key}Note`)}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs" style={{ color: MUTED }}>
            {t('downloads.english')}
          </p>
        </ToolPanel>

        <ToolPanel title={t('check.title')}>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed" style={{ color: BODY_TEXT }}>
              {t('check.intro')}
            </p>
            <ChoiceField
              label={t('check.unitLabel')}
              value={units}
              onChange={setUnits}
              options={[
                { value: 'metric', label: t('check.kg') },
                { value: 'imperial', label: t('check.lb') },
              ]}
            />
            <div className="space-y-1.5">
              <label
                htmlFor="log-file"
                className="text-sm font-semibold"
                style={{ color: BODY_TEXT }}
              >
                {t('check.file')}
              </label>
              <input
                id="log-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => void readFile((event.target as HTMLInputElement).files?.[0])}
                className="block w-full rounded-control border px-3 py-2.5 text-sm"
                style={{ backgroundColor: INPUT_BG, borderColor: INPUT_BORDER, color: BODY_TEXT }}
              />
            </div>
            {check?.ok ? (
              <div className="space-y-3" aria-live="polite">
                <ToolNotice>
                  {t('check.result', {
                    workouts: t('check.workoutCount', {
                      count: check.workouts,
                      formattedCount: formatInteger(check.workouts),
                    }),
                    sets: t('check.setCount', {
                      count: check.sets,
                      formattedCount: formatInteger(check.sets),
                    }),
                  })}
                </ToolNotice>
                {check.skipped > 0 ? (
                  <ToolNotice tone="warning">
                    {t('check.skipped', {
                      count: check.skipped,
                      formattedCount: formatInteger(check.skipped),
                    })}
                  </ToolNotice>
                ) : null}
                {check.exampleRow ? (
                  <ToolNotice tone="warning">{t('check.exampleWarning')}</ToolNotice>
                ) : null}
              </div>
            ) : null}
            {check && !check.ok ? (
              <ToolNotice tone="warning">{t(`check.problems.${check.problem}`)}</ToolNotice>
            ) : null}
          </div>
        </ToolPanel>
      </div>
    </ToolLayout>
  );
}

export const generateStaticParams = localeStaticParams;

export const generateMetadata = fixedMetadataFor('toolWorkoutLogTemplate');
