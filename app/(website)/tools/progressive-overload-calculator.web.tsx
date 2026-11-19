import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GymFields } from '@/components/website/tools/GymFields';
import {
  MAX_OVERLOAD_REPS,
  MAX_OVERLOAD_RESERVE,
  MAX_PLANNED_REPS,
  OVERLOAD_EQUIPMENT,
  OVERLOAD_PROGRESSION_MODES,
  type OverloadEquipment,
  planOverload,
  SUCCESS_REPS_IN_RESERVE,
  validateOverloadInput,
} from '@/components/website/tools/progressiveOverloadModel';
import {
  ChoiceField,
  NumberField,
  ResultStat,
  ToolNotice,
  ToolPanel,
  UnitsField,
} from '@/components/website/tools/ToolFields';
import { ToolLayout, type ToolSection } from '@/components/website/tools/ToolLayout';
import { useToolGym, useToolUnits } from '@/components/website/tools/useToolState';
import { MAX_WORKING_WEIGHT } from '@/components/website/tools/warmUpCalculatorModel';
import { BODY_TEXT, INPUT_BORDER, MUTED } from '@/components/website/websiteColors';
import { fixedPageMetadata } from '@/components/website/websiteMetadata';
import type { ProgressionMode } from '@/constants/settings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';

export default function ProgressiveOverloadToolPage() {
  const { t } = useTranslation(undefined, { keyPrefix: 'websiteToolProgressiveOverload' });
  const { t: unitsT } = useTranslation(undefined, { keyPrefix: 'websiteTools.units' });
  const { formatDecimal, formatInteger } = useFormatAppNumber();
  const [units, setUnits] = useToolUnits();
  const [weight, setWeight] = useState('100');
  const [reps, setReps] = useState('8');
  const [plannedReps, setPlannedReps] = useState('8');
  const [reserve, setReserve] = useState('2');
  const [equipment, setEquipment] = useState<OverloadEquipment>('barbell');
  const [mode, setMode] = useState<ProgressionMode>('weight_first');
  const [complete, setComplete] = useState<'yes' | 'no'>('yes');
  const [twoInARow, setTwoInARow] = useState<'yes' | 'no'>('no');
  const gymState = useToolGym(units);
  const unit = units === 'imperial' ? unitsT('lb') : unitsT('kg');
  const isBarbell = equipment === 'barbell';

  const validation = validateOverloadInput(
    {
      weight,
      reps,
      plannedReps,
      reserve,
      complete: complete === 'yes',
      twoInARow: twoInARow === 'yes',
    },
    units
  );
  const problem = validation.ok ? null : validation.problem;
  // A barbell needs a readable gym; the other equipment uses a standard one.
  const plan =
    validation.ok && (!isBarbell || gymState.gym)
      ? planOverload(validation.input, { units, equipment, mode, gym: gymState.gym })
      : null;
  const sections = t('sections', { returnObjects: true }) as ToolSection[];
  const withUnit = (value: number) => `${formatDecimal(value, 1)} ${unit}`;
  const percent = (value: number) => `${formatDecimal(Math.abs(value), 1)}%`;
  const unrated = validation.ok && validation.input.repsInReserve === null;

  const changeLine = (change: number, changePercent: number) => {
    if (change === 0) {
      return t('results.changeSame');
    }

    const values = { change: withUnit(Math.abs(change)), percent: percent(changePercent) };

    return change > 0 ? t('results.changeUp', values) : t('results.changeDown', values);
  };

  const maxFor = (field: string) => {
    switch (field) {
      case 'weight':
        return formatInteger(MAX_WORKING_WEIGHT[units]);
      case 'reps':
        return formatInteger(MAX_OVERLOAD_REPS);
      case 'plannedReps':
        return formatInteger(MAX_PLANNED_REPS);
      default:
        return formatInteger(MAX_OVERLOAD_RESERVE);
    }
  };

  return (
    <ToolLayout
      routeKey="toolProgressiveOverload"
      title={t('title')}
      intro={t('intro')}
      sections={sections}
      sources={[
        { label: t('sources.acsm'), href: 'https://doi.org/10.1249/MSS.0b013e3181915670' },
        { label: t('sources.zourdos'), href: 'https://doi.org/10.1519/JSC.0000000000001049' },
      ]}
      articles={[
        {
          label: t('articles.doubleProgression'),
          href: '/blog/2026/11/double-progression-explained',
        },
        { label: t('articles.trackProgress'), href: '/blog/2026/11/how-to-track-gym-progress' },
      ]}
      related={['oneRepMax', 'rpeChart', 'warmUpCalculator']}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <ToolPanel>
          <div className="space-y-4">
            <UnitsField units={units} onChange={setUnits} />
            <NumberField
              id="overload-weight"
              label={t('form.weight')}
              hint={t('form.weightHint')}
              value={weight}
              onChange={setWeight}
              suffix={unit}
              invalid={problem === 'weight'}
            />
            <NumberField
              id="overload-reps"
              label={t('form.reps')}
              hint={t('form.repsHint')}
              value={reps}
              onChange={setReps}
              inputMode="numeric"
              invalid={problem === 'reps'}
            />
            <NumberField
              id="overload-planned"
              label={t('form.plannedReps')}
              hint={t('form.plannedRepsHint')}
              value={plannedReps}
              onChange={setPlannedReps}
              inputMode="numeric"
              invalid={problem === 'plannedReps'}
            />
            <NumberField
              id="overload-reserve"
              label={t('form.reserve')}
              hint={t('form.reserveHint')}
              value={reserve}
              onChange={setReserve}
              invalid={problem === 'reserve'}
            />
            <details className="rounded-control border p-3" style={{ borderColor: INPUT_BORDER }}>
              <summary
                className="cursor-pointer text-sm font-semibold"
                style={{ color: BODY_TEXT }}
              >
                {t('form.moreOptions')}
              </summary>
              <div className="mt-3 space-y-4">
                <ChoiceField
                  label={t('form.equipmentLabel')}
                  value={equipment}
                  onChange={setEquipment}
                  options={OVERLOAD_EQUIPMENT.map((value) => ({
                    value,
                    label: t(`form.equipment.${value}`),
                  }))}
                />
                <ChoiceField
                  label={t('form.modeLabel')}
                  value={mode}
                  onChange={setMode}
                  options={OVERLOAD_PROGRESSION_MODES.map((value) => ({
                    value,
                    label: t(`form.mode.${value}`),
                  }))}
                />
                <ChoiceField
                  label={t('form.completeLabel')}
                  value={complete}
                  onChange={setComplete}
                  options={[
                    { value: 'yes', label: t('form.yes') },
                    { value: 'no', label: t('form.no') },
                  ]}
                />
                <ChoiceField
                  label={t('form.twoInARowLabel')}
                  value={twoInARow}
                  onChange={setTwoInARow}
                  options={[
                    { value: 'no', label: t('form.twoInARowNo') },
                    { value: 'yes', label: t('form.twoInARowYes') },
                  ]}
                />
                {isBarbell ? <GymFields units={units} gymState={gymState} /> : null}
              </div>
            </details>
          </div>
        </ToolPanel>

        <div className="flex flex-col gap-4">
          {problem ? (
            <ToolNotice tone="warning">
              {t(`problems.${problem}`, { max: maxFor(problem) })}
            </ToolNotice>
          ) : null}
          {plan ? (
            <ToolPanel title={t('results.title')}>
              <div className="space-y-4">
                <ResultStat
                  emphasis
                  label={t(`results.kind.${plan.kind}`)}
                  value={t('results.target', {
                    count: plan.reps,
                    weight: withUnit(plan.weight),
                    reps: formatInteger(plan.reps),
                  })}
                  note={changeLine(plan.change, plan.changePercent)}
                />
                <ToolNotice>
                  {unrated && plan.kind === 'progression'
                    ? t('results.unrated')
                    : t(`reasons.${plan.reason}`, {
                        reserve: formatInteger(SUCCESS_REPS_IN_RESERVE),
                        planned: formatInteger(validation.ok ? validation.input.plannedReps : 0),
                        step: withUnit(plan.step),
                      })}
                </ToolNotice>
                {plan.perSide ? (
                  <p className="text-sm" style={{ color: BODY_TEXT }}>
                    <span className="font-semibold">{t('results.plates')}: </span>
                    {plan.perSide.length === 0
                      ? t('results.emptyBar')
                      : plan.perSide
                          .map((plate) =>
                            t('results.plateLine', {
                              count: formatInteger(plate.count),
                              weight: `${formatDecimal(plate.weight, 2)} ${unit}`,
                            })
                          )
                          .join(', ')}
                  </p>
                ) : null}
                <p className="text-sm" style={{ color: MUTED }}>
                  {t('results.step', { step: withUnit(plan.step) })}
                </p>
              </div>
            </ToolPanel>
          ) : null}
        </div>
      </div>
    </ToolLayout>
  );
}

export function generateMetadata() {
  return fixedPageMetadata('toolProgressiveOverload');
}
