import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROTEIN_GOALS, proteinPlan } from '@/components/website/tools/proteinCalculatorModel';
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
import { BODY_TEXT, BODY_TEXT_SOFT, CARD_BORDER, MUTED } from '@/components/website/websiteColors';
import { fixedPageMetadata } from '@/components/website/websiteMetadata';
import type { FitnessGoal } from '@/database/models';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { kgToDisplay } from '@/utils/unitConversion';

/** Each goal's label key, written out whole so the translation checker can see every one. */
const GOAL_LABEL_KEYS = {
  hypertrophy: 'goals.hypertrophy',
  strength: 'goals.strength',
  general: 'goals.general',
  endurance: 'goals.endurance',
  weight_loss: 'goals.weightLoss',
} as const satisfies Record<FitnessGoal, string>;

export default function ProteinCalculatorToolPage() {
  const { t } = useTranslation(undefined, { keyPrefix: 'websiteToolProteinCalculator' });
  const { t: unitsT } = useTranslation(undefined, { keyPrefix: 'websiteTools.units' });
  const { formatDecimal, formatInteger } = useFormatAppNumber();
  const [units, setUnits] = useToolUnits();
  const [weight, setWeight] = useState('80');
  const [height, setHeight] = useState('180');
  const [goal, setGoal] = useState<FitnessGoal>('general');
  const [deficit, setDeficit] = useState<'yes' | 'no'>('no');
  const [goalWeight, setGoalWeight] = useState('');

  const weightUnit = units === 'imperial' ? unitsT('lb') : unitsT('kg');
  const heightUnit = units === 'imperial' ? t('form.inches') : t('form.cm');
  const validation = proteinPlan({
    units,
    weightText: weight,
    heightText: height,
    goal,
    deficit: deficit === 'yes',
    goalWeightText: goalWeight,
  });
  const plan = validation.ok ? validation.plan : null;
  const problem = validation.ok ? null : validation.problem;
  const sections = t('sections', { returnObjects: true }) as ToolSection[];
  const kgLabel = (kg: number) => `${formatDecimal(kgToDisplay(kg, units), 1)} ${weightUnit}`;

  return (
    <ToolLayout
      routeKey="toolProteinCalculator"
      title={t('title')}
      intro={t('intro')}
      sections={sections}
      sources={[
        { label: t('sources.morton'), href: 'https://pubmed.ncbi.nlm.nih.gov/28698222/' },
        { label: t('sources.helms'), href: 'https://pubmed.ncbi.nlm.nih.gov/24864135/' },
      ]}
      related={['calorieDeficit', 'netCarbs']}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <ToolPanel>
          <div className="space-y-4">
            <UnitsField units={units} onChange={setUnits} />
            <NumberField
              id="protein-weight"
              label={t('form.weight')}
              value={weight}
              onChange={setWeight}
              suffix={weightUnit}
              invalid={problem === 'weight'}
            />
            <NumberField
              id="protein-height"
              label={t('form.height')}
              value={height}
              onChange={setHeight}
              suffix={heightUnit}
              invalid={problem === 'height'}
            />
            <ChoiceField<FitnessGoal>
              label={t('form.goal')}
              value={goal}
              onChange={setGoal}
              options={PROTEIN_GOALS.map((value) => ({
                value,
                label: t(GOAL_LABEL_KEYS[value]),
              }))}
            />
            <ChoiceField<'yes' | 'no'>
              label={t('form.deficit')}
              value={deficit}
              onChange={setDeficit}
              options={[
                { value: 'yes', label: t('form.deficitYes') },
                { value: 'no', label: t('form.deficitNo') },
              ]}
            />
            <NumberField
              id="protein-goal-weight"
              label={t('form.goalWeight')}
              hint={t('form.goalWeightHint')}
              value={goalWeight}
              onChange={setGoalWeight}
              suffix={weightUnit}
              invalid={problem === 'goalWeight'}
            />
          </div>
        </ToolPanel>

        <div className="flex flex-col gap-4">
          {problem ? <ToolNotice tone="warning">{t(`problems.${problem}`)}</ToolNotice> : null}
          {plan ? (
            <>
              <ResultStat
                emphasis
                label={t('results.grams')}
                value={`${formatInteger(plan.grams)} g`}
                note={t('results.gramsNote', {
                  perKg: `${formatDecimal(plan.gramsPerKg, 1)} g/kg`,
                  reference: kgLabel(plan.referenceWeightKg),
                })}
              />
              {plan.capped ? (
                <ToolNotice>
                  {t('notes.capped', {
                    weight: kgLabel(plan.weightKg),
                    reference: kgLabel(plan.referenceWeightKg),
                  })}
                </ToolNotice>
              ) : null}
              {plan.raisedByDeficit ? (
                <ToolNotice>
                  {t('notes.deficit', { value: `${formatDecimal(plan.gramsPerKg, 1)} g/kg` })}
                </ToolNotice>
              ) : null}
              <ToolNotice>{t('notes.bodyweight')}</ToolNotice>
              <ToolNotice>{t('notes.spread')}</ToolNotice>
              <ToolNotice>{t('notes.medical')}</ToolNotice>
              <ToolPanel title={t('results.tableTitle')}>
                <table className="w-full text-left text-sm tabular-nums">
                  <thead>
                    <tr style={{ color: BODY_TEXT_SOFT }}>
                      <th className="pb-2 font-semibold">{t('results.tableGoal')}</th>
                      <th className="pb-2 font-semibold">{t('results.tablePerKg')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.table.map((row) => (
                      <tr key={row.goal} className="border-t" style={{ borderColor: CARD_BORDER }}>
                        <td className="py-2" style={{ color: MUTED }}>
                          {t(GOAL_LABEL_KEYS[row.goal])}
                        </td>
                        <td className="py-2" style={{ color: BODY_TEXT }}>
                          {formatDecimal(row.gramsPerKg, 1)} g/kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ToolPanel>
            </>
          ) : null}
        </div>
      </div>
    </ToolLayout>
  );
}

export function generateMetadata() {
  return fixedPageMetadata('toolProteinCalculator');
}
