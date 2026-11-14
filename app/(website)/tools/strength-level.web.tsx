import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  checkStrength,
  type StrengthLift,
  strengthLifts,
  strengthTable,
  validateStrengthCheck,
} from '@/components/website/tools/strengthLevelModel';
import {
  ChoiceField,
  NumberField,
  ResultStat,
  ToolNotice,
  ToolPanel,
  UnitsField,
} from '@/components/website/tools/ToolFields';
import { ToolLayout, type ToolSection } from '@/components/website/tools/ToolLayout';
import { useToolUnits } from '@/components/website/tools/useToolState';
import {
  BODY_TEXT,
  BODY_TEXT_SOFT,
  CARD_BORDER,
  HEADING_TEXT,
  INPUT_BG,
  INPUT_BORDER,
  MUTED,
} from '@/components/website/websiteColors';
import { fixedPageMetadata } from '@/components/website/websiteMetadata';
import { getExerciseCatalogue } from '@/data/exerciseCatalogue';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import type { StrengthGender } from '@/utils/relativeStrength';
import type { StrengthLevel } from '@/utils/strengthLevel';
import { kgToDisplay } from '@/utils/unitConversion';

const GENDERS: StrengthGender[] = ['male', 'female', 'other'];

export default function StrengthLevelToolPage() {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: 'websiteToolStrengthLevel' });
  const { t: unitsT } = useTranslation(undefined, { keyPrefix: 'websiteTools.units' });
  const { formatDecimal } = useFormatAppNumber();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [units, setUnits] = useToolUnits();
  const [gender, setGender] = useState<StrengthGender>('male');
  const [liftSlug, setLiftSlug] = useState('Barbell_Squat');
  const [bodyWeight, setBodyWeight] = useState('80');
  const [weight, setWeight] = useState('120');
  const [reps, setReps] = useState('5');
  const [reserve, setReserve] = useState('');
  const unit = units === 'imperial' ? unitsT('lb') : unitsT('kg');

  const lifts = useMemo(() => {
    const names = new Map(
      getExerciseCatalogue(language).map((entry) => [entry.exerciseSlug, entry.name])
    );
    return strengthLifts((slug) => names.get(slug) ?? slug);
  }, [language]);

  const lift: StrengthLift | null = lifts.find((entry) => entry.slug === liftSlug) ?? null;

  const validation = validateStrengthCheck({
    units,
    gender,
    lift,
    bodyWeightText: bodyWeight,
    weightText: weight,
    repsText: reps,
    reserveText: reserve,
  });
  const problem = validation.ok ? null : validation.problem;
  const result = validation.ok ? checkStrength(validation.input) : null;
  const sections = t('sections', { returnObjects: true }) as ToolSection[];

  const sexLabels: Record<StrengthGender, string> = {
    male: t('form.sexMale'),
    female: t('form.sexFemale'),
    other: t('form.sexOther'),
  };

  const levelLabel = (level: StrengthLevel): string =>
    ({
      beginner: t('results.levels.beginner'),
      novice: t('results.levels.novice'),
      intermediate: t('results.levels.intermediate'),
      advanced: t('results.levels.advanced'),
      elite: t('results.levels.elite'),
    })[level];

  const show = (kg: number) => `${formatDecimal(kgToDisplay(kg, units), 1)} ${unit}`;
  const table = validation.ok
    ? strengthTable(validation.input.bodyWeightKg, validation.input.lift)
    : null;

  return (
    <ToolLayout
      routeKey="toolStrengthLevel"
      title={t('title')}
      intro={t('intro')}
      sections={sections}
      sources={[
        { label: t('sources.openpowerlifting'), href: 'https://www.openpowerlifting.org/' },
      ]}
      related={['oneRepMax', 'rpeChart', 'warmUpCalculator']}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <ToolPanel>
          <div className="space-y-4">
            <UnitsField units={units} onChange={setUnits} />
            <ChoiceField
              label={t('form.sex')}
              value={gender}
              onChange={setGender}
              options={GENDERS.map((value) => ({ value, label: sexLabels[value] }))}
            />
            <NumberField
              id="strength-body-weight"
              label={t('form.bodyWeight')}
              value={bodyWeight}
              onChange={setBodyWeight}
              suffix={unit}
              invalid={problem === 'bodyWeight'}
            />
            <div className="space-y-1.5">
              <label
                htmlFor="strength-lift"
                className="text-sm font-semibold"
                style={{ color: BODY_TEXT }}
              >
                {t('form.lift')}
              </label>
              <select
                id="strength-lift"
                value={liftSlug}
                onChange={(event) => setLiftSlug(event.target.value)}
                className="w-full rounded-control border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-bright/40"
                style={{
                  backgroundColor: INPUT_BG,
                  borderColor: INPUT_BORDER,
                  color: HEADING_TEXT,
                }}
              >
                {lifts.map((entry) => (
                  <option key={entry.slug} value={entry.slug}>
                    {entry.perHand ? `${entry.name} (${t('form.perHand')})` : entry.name}
                  </option>
                ))}
              </select>
            </div>
            <NumberField
              id="strength-weight"
              label={t('form.weight')}
              value={weight}
              onChange={setWeight}
              suffix={unit}
              invalid={problem === 'weight'}
            />
            <NumberField
              id="strength-reps"
              label={t('form.reps')}
              hint={t('form.repsHint')}
              value={reps}
              onChange={setReps}
              inputMode="numeric"
              invalid={problem === 'reps' || problem === 'repsTooHigh'}
            />
            <NumberField
              id="strength-reserve"
              label={t('form.reserve')}
              hint={t('form.reserveHint')}
              value={reserve}
              onChange={setReserve}
              inputMode="numeric"
              invalid={problem === 'reserve'}
            />
          </div>
        </ToolPanel>

        <div className="flex flex-col gap-4">
          {problem ? <ToolNotice tone="warning">{t(`problems.${problem}`)}</ToolNotice> : null}
          {result ? (
            <>
              <ResultStat
                emphasis
                label={t('results.level')}
                value={
                  result.grade.upperLevel
                    ? t('results.range', {
                        lower: levelLabel(result.grade.level),
                        upper: levelLabel(result.grade.upperLevel),
                      })
                    : levelLabel(result.grade.level)
                }
                note={
                  result.grade.upperLevel
                    ? t('results.otherNote')
                    : `${t('results.estimate')}: ${show(result.estimated1RmKg)}`
                }
              />
              {result.grade.upperLevel ? null : (
                <ToolNotice>
                  {result.grade.nextLevel && result.grade.nextLevelKg !== null
                    ? t('results.nextLevel', {
                        level: levelLabel(result.grade.nextLevel),
                        weight: formatDecimal(kgToDisplay(result.grade.nextLevelKg, units), 1),
                        unit,
                      })
                    : t('results.topLevel')}
                </ToolNotice>
              )}
              <ToolPanel title={t('results.tableTitle')}>
                <table className="w-full text-left text-sm tabular-nums">
                  <thead>
                    <tr style={{ color: BODY_TEXT_SOFT }}>
                      <th className="pb-2 font-semibold">{t('results.tableLevel')}</th>
                      {gender === 'other' ? (
                        <>
                          <th className="pb-2 font-semibold">{t('results.tableMale')}</th>
                          <th className="pb-2 font-semibold">{t('results.tableFemale')}</th>
                        </>
                      ) : (
                        <th className="pb-2 font-semibold">{t('results.tableOne')}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(table ?? []).map((row) => (
                      <tr key={row.level} className="border-t" style={{ borderColor: CARD_BORDER }}>
                        <td className="py-2" style={{ color: BODY_TEXT }}>
                          {levelLabel(row.level)}
                        </td>
                        {gender === 'other' ? (
                          <>
                            <td className="py-2 font-bold text-text-primary">{show(row.maleKg)}</td>
                            <td className="py-2 font-bold text-text-primary">
                              {show(row.femaleKg)}
                            </td>
                          </>
                        ) : (
                          <td className="py-2 font-bold text-text-primary">
                            {show(gender === 'female' ? row.femaleKg : row.maleKg)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs leading-relaxed" style={{ color: MUTED }}>
                  {t('results.tableNote')}
                </p>
              </ToolPanel>
            </>
          ) : null}
        </div>
      </div>
    </ToolLayout>
  );
}

export function generateMetadata() {
  return fixedPageMetadata('toolStrengthLevel');
}
