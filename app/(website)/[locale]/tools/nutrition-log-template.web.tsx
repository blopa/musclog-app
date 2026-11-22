import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { localeStaticParams } from '@/components/website/localeStaticParams';
import {
  foodEatenFromPer100g,
  NUTRITION_LOG_DOWNLOADS,
} from '@/components/website/tools/nutritionLogTemplateModel';
import {
  NumberField,
  ResultStat,
  ToolNotice,
  ToolPanel,
} from '@/components/website/tools/ToolFields';
import { ToolLayout, type ToolSection } from '@/components/website/tools/ToolLayout';
import {
  BODY_TEXT_SOFT,
  BRAND_GREEN_BRIGHT,
  CARD_BORDER,
  MUTED,
} from '@/components/website/websiteColors';
import { fixedMetadataFor } from '@/components/website/websiteMetadata';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { withExpoBaseUrl } from '@/utils/withExpoBaseUrl';

export default function NutritionLogTemplateToolPage() {
  const { t } = useTranslation(undefined, { keyPrefix: 'websiteToolNutritionLogTemplate' });
  const { formatDecimal } = useFormatAppNumber();
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('12');
  const [carbs, setCarbs] = useState('60');
  const [fat, setFat] = useState('7');
  const [grams, setGrams] = useState('150');
  const sections = t('sections', { returnObjects: true }) as ToolSection[];

  const validation = foodEatenFromPer100g({
    kcalText: kcal,
    proteinText: protein,
    carbsText: carbs,
    fatText: fat,
    gramsText: grams,
  });
  const result = validation.ok ? validation.result : null;
  const problem = validation.ok ? null : validation.problem;

  return (
    <ToolLayout
      routeKey="toolNutritionLogTemplate"
      title={t('title')}
      intro={t('intro')}
      sections={sections}
      related={['proteinCalculator', 'netCarbs', 'calorieDeficit']}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <ToolPanel title={t('downloads.title')}>
          {(['ready', 'per100', 'both'] as const).map((version) => (
            <div key={version} className="mb-5 last:mb-0">
              <h3 className="text-base font-bold text-text-primary">
                {t(`downloads.versions.${version}.title`)}
              </h3>
              <p className="mt-1 text-sm" style={{ color: BODY_TEXT_SOFT }}>
                {t(`downloads.versions.${version}.body`)}
              </p>
              <ul className="mt-3 space-y-3">
                {NUTRITION_LOG_DOWNLOADS.filter((download) => download.version === version).map(
                  (download) => (
                    <li
                      key={download.key}
                      className="border-b pb-3 last:border-b-0 last:pb-0"
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
                  )
                )}
              </ul>
            </div>
          ))}
          <p className="mt-4 text-xs" style={{ color: MUTED }}>
            {t('downloads.english')}
          </p>
        </ToolPanel>

        <ToolPanel title={t('try.title')}>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
              {t('try.intro')}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                id="nutrition-log-kcal"
                label={t('try.kcal')}
                value={kcal}
                onChange={setKcal}
                suffix="kcal"
                hint={t('try.kcalHint')}
                invalid={problem === 'kcal'}
              />
              <NumberField
                id="nutrition-log-protein"
                label={t('try.protein')}
                value={protein}
                onChange={setProtein}
                suffix="g"
                invalid={problem === 'protein' || problem === 'macrosTooHigh'}
              />
              <NumberField
                id="nutrition-log-carbs"
                label={t('try.carbs')}
                value={carbs}
                onChange={setCarbs}
                suffix="g"
                invalid={problem === 'carbs' || problem === 'macrosTooHigh'}
              />
              <NumberField
                id="nutrition-log-fat"
                label={t('try.fat')}
                value={fat}
                onChange={setFat}
                suffix="g"
                invalid={problem === 'fat' || problem === 'macrosTooHigh'}
              />
            </div>
            <NumberField
              id="nutrition-log-grams"
              label={t('try.grams')}
              value={grams}
              onChange={setGrams}
              suffix="g"
              invalid={problem === 'grams'}
            />
            {problem ? (
              <ToolNotice tone="warning">{t(`try.problems.${problem}`)}</ToolNotice>
            ) : null}
            {result ? (
              <div className="space-y-3" aria-live="polite">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ResultStat
                    emphasis
                    label={t('try.results.kcal')}
                    value={formatDecimal(result.kcal, 0)}
                    note={result.kcalEstimated ? t('try.results.kcalEstimated') : undefined}
                  />
                  <ResultStat
                    label={t('try.results.protein')}
                    value={`${formatDecimal(result.protein, 1)} g`}
                  />
                  <ResultStat
                    label={t('try.results.carbs')}
                    value={`${formatDecimal(result.carbs, 1)} g`}
                  />
                  <ResultStat
                    label={t('try.results.fat')}
                    value={`${formatDecimal(result.fat, 1)} g`}
                  />
                </div>
                <p className="text-xs" style={{ color: MUTED }}>
                  {t('try.formula', { grams: formatDecimal(result.grams, 0) })}
                </p>
              </div>
            ) : null}
          </div>
        </ToolPanel>
      </div>
    </ToolLayout>
  );
}

export const generateStaticParams = localeStaticParams;

export const generateMetadata = fixedMetadataFor('toolNutritionLogTemplate');
