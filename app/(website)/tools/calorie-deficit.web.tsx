import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  CALORIE_ACTIVITY_LEVELS,
  calorieDeficitPlan,
} from '@/components/website/tools/calorieDeficitModel';
import {
  ChoiceField,
  NumberField,
  ResultStat,
  ToolNotice,
  ToolPanel,
  UnitsField,
} from '@/components/website/tools/ToolFields';
import { ToolLayout,type ToolSection } from '@/components/website/tools/ToolLayout';
import { useToolUnits } from '@/components/website/tools/useToolState';
import {
  BODY_TEXT,
  HEADING_TEXT,
  INPUT_BG,
  INPUT_BORDER,
} from '@/components/website/websiteColors';
import { fixedPageMetadata } from '@/components/website/websiteMetadata';
import type { Gender } from '@/database/models';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { kgToDisplay } from '@/utils/unitConversion';

/** The local calendar day as `YYYY-MM-DD`, for the date input's minimum. */
function localIsoDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function CalorieDeficitToolPage() {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: 'websiteToolCalorieDeficit' });
  const { t: unitsT } = useTranslation(undefined, { keyPrefix: 'websiteTools.units' });
  const { formatDecimal, formatInteger } = useFormatAppNumber();
  const [units, setUnits] = useToolUnits();
  const [sex, setSex] = useState<Gender>('male');
  const [age, setAge] = useState('30');
  const [height, setHeight] = useState('180');
  const [weight, setWeight] = useState('90');
  const [activityLevel, setActivityLevel] = useState<number>(3);
  const [goalWeight, setGoalWeight] = useState('85');
  const [goalDate, setGoalDate] = useState('');
  const [today] = useState(() => localIsoDay(new Date()));

  const weightUnit = units === 'imperial' ? unitsT('lb') : unitsT('kg');
  const heightUnit = units === 'imperial' ? t('form.inches') : t('form.cm');
  const validation = calorieDeficitPlan({
    units,
    sex,
    ageText: age,
    heightText: height,
    weightText: weight,
    activityLevel,
    goalWeightText: goalWeight,
    goalDate,
    today,
  });
  const plan = validation.ok ? validation.plan : null;
  const problem = validation.ok ? null : validation.problem;
  const sections = t('sections', { returnObjects: true }) as ToolSection[];
  const kcal = (value: number) => `${formatInteger(Math.round(value))} kcal`;
  const kgLabel = (kg: number) => `${formatDecimal(kgToDisplay(kg, units), 1)} ${weightUnit}`;
  const laterDateText = plan?.laterDate
    ? new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, { dateStyle: 'long' }).format(
        new Date(`${plan.laterDate}T12:00:00`)
      )
    : null;

  return (
    <ToolLayout
      routeKey="toolCalorieDeficit"
      title={t('title')}
      intro={t('intro')}
      sections={sections}
      sources={[{ label: t('sources.hall'), href: 'https://pubmed.ncbi.nlm.nih.gov/21872751/' }]}
      related={['proteinCalculator']}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <ToolPanel>
          <div className="space-y-4">
            <UnitsField units={units} onChange={setUnits} />
            <ChoiceField<Gender>
              label={t('form.sex')}
              value={sex}
              onChange={setSex}
              options={[
                { value: 'male', label: t('form.male') },
                { value: 'female', label: t('form.female') },
              ]}
            />
            <NumberField
              id="deficit-age"
              label={t('form.age')}
              value={age}
              onChange={setAge}
              inputMode="numeric"
              invalid={problem === 'age'}
            />
            <NumberField
              id="deficit-height"
              label={t('form.height')}
              value={height}
              onChange={setHeight}
              suffix={heightUnit}
              invalid={problem === 'height'}
            />
            <NumberField
              id="deficit-weight"
              label={t('form.weight')}
              value={weight}
              onChange={setWeight}
              suffix={weightUnit}
              invalid={problem === 'weight'}
            />
            <ChoiceField<number>
              label={t('form.activity')}
              value={activityLevel}
              onChange={setActivityLevel}
              options={CALORIE_ACTIVITY_LEVELS.map((level) => ({
                value: level,
                label: t(`form.activity${level}`),
              }))}
            />
            <NumberField
              id="deficit-goal-weight"
              label={t('form.goalWeight')}
              value={goalWeight}
              onChange={setGoalWeight}
              suffix={weightUnit}
              invalid={problem === 'goalWeight'}
            />
            <div className="space-y-1.5">
              <label
                htmlFor="deficit-goal-date"
                className="text-sm font-semibold"
                style={{ color: BODY_TEXT }}
              >
                {t('form.goalDate')}
              </label>
              <input
                id="deficit-goal-date"
                type="date"
                min={today}
                value={goalDate}
                aria-invalid={problem === 'goalDate' || problem === 'goalDateNotFuture'}
                onChange={(event) => setGoalDate(event.target.value)}
                className="w-full rounded-control border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-bright/40"
                style={{
                  backgroundColor: INPUT_BG,
                  borderColor: INPUT_BORDER,
                  color: HEADING_TEXT,
                }}
              />
            </div>
          </div>
        </ToolPanel>

        <div className="flex flex-col gap-4">
          {problem ? <ToolNotice tone="warning">{t(`problems.${problem}`)}</ToolNotice> : null}
          {plan && plan.direction === 'none' ? (
            <ToolNotice>{t('notes.noChange')}</ToolNotice>
          ) : null}
          {plan && plan.direction !== 'none' ? (
            <>
              <ResultStat
                emphasis
                label={t('results.target')}
                value={kcal(plan.target)}
                note={t('results.range', {
                  low: kcal(plan.rangeLow),
                  high: kcal(plan.rangeHigh),
                })}
              />
              <ToolPanel title={t('results.summary')}>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <dt style={{ color: BODY_TEXT }}>{t('results.change')}</dt>
                    <dd className="font-bold tabular-nums text-text-primary">
                      {kgLabel(Math.abs(plan.weightChangeKg))}
                    </dd>
                  </div>
                  <div>
                    <dt style={{ color: BODY_TEXT }}>{t('results.days')}</dt>
                    <dd className="font-bold tabular-nums text-text-primary">
                      {formatInteger(plan.days)}
                    </dd>
                  </div>
                  <div>
                    <dt style={{ color: BODY_TEXT }}>
                      {plan.direction === 'loss' ? t('results.deficit') : t('results.surplus')}
                    </dt>
                    <dd className="font-bold tabular-nums text-text-primary">
                      {kcal(plan.requiredDailyChange)} {t('results.perDay')}
                    </dd>
                  </div>
                  <div>
                    <dt style={{ color: BODY_TEXT }}>{t('results.weekly')}</dt>
                    <dd className="font-bold tabular-nums text-text-primary">
                      {formatDecimal(Math.abs(plan.weeklyChangeKg), 2)} {weightUnit}{' '}
                      {t('results.perWeek')}
                    </dd>
                  </div>
                  <div>
                    <dt style={{ color: BODY_TEXT }}>{t('results.tdee')}</dt>
                    <dd className="font-bold tabular-nums text-text-primary">{kcal(plan.tdee)}</dd>
                  </div>
                  <div>
                    <dt style={{ color: BODY_TEXT }}>{t('results.share')}</dt>
                    <dd className="font-bold tabular-nums text-text-primary">
                      {formatInteger(Math.round(plan.deficitShareOfTdee * 100))}%
                    </dd>
                  </div>
                </dl>
              </ToolPanel>
              {plan.clamped ? (
                <ToolNotice>
                  {t('notes.floor', { floor: kcal(plan.minCalories) })}
                  {laterDateText ? ` ${t('notes.laterDate', { date: laterDateText })}` : ''}
                </ToolNotice>
              ) : null}
              {plan.warnings.includes('floorAboveTdee') ? (
                <ToolNotice tone="warning">{t('notes.floorAboveTdee')}</ToolNotice>
              ) : null}
              {plan.warnings.includes('paceTooFast') ? (
                <ToolNotice tone="warning">{t('notes.pace')}</ToolNotice>
              ) : null}
              {plan.warnings.includes('deficitTooLarge') ? (
                <ToolNotice tone="warning">{t('notes.deficitLarge')}</ToolNotice>
              ) : null}
            </>
          ) : null}
          <ToolNotice>{t('notes.range')}</ToolNotice>
          <ToolNotice>{t('notes.thresholds')}</ToolNotice>
        </div>
      </div>
    </ToolLayout>
  );
}

export function generateMetadata() {
  return fixedPageMetadata('toolCalorieDeficit');
}
