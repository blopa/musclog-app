import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  DELOAD_EQUIPMENT,
  DELOAD_TARGET_RIR,
  DELOAD_WEEKS,
  type DeloadEquipment,
  type DeloadLoad,
  MAX_DELOAD_SETS,
  planDeload,
  validateDeloadInput,
} from '@/components/website/tools/deloadCalculatorModel';
import { GymFields } from '@/components/website/tools/GymFields';
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
import { BODY_TEXT, BODY_TEXT_SOFT, CARD_BORDER, MUTED } from '@/components/website/websiteColors';
import { fixedPageMetadata } from '@/components/website/websiteMetadata';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';

export default function DeloadCalculatorToolPage() {
  const { t } = useTranslation(undefined, { keyPrefix: 'websiteToolDeloadCalculator' });
  const { t: unitsT } = useTranslation(undefined, { keyPrefix: 'websiteTools.units' });
  const { formatDecimal, formatInteger } = useFormatAppNumber();
  const [units, setUnits] = useToolUnits();
  const [weight, setWeight] = useState('100');
  const [sets, setSets] = useState('3');
  const [equipment, setEquipment] = useState<DeloadEquipment>('barbell');
  const gymState = useToolGym(units);
  const unit = units === 'imperial' ? unitsT('lb') : unitsT('kg');
  const isBarbell = equipment === 'barbell';

  const validation = validateDeloadInput(weight, sets, units);
  const problem = validation.ok ? null : validation.problem;
  // A barbell needs a readable gym; the other equipment uses a standard one.
  const plan =
    validation.ok && (!isBarbell || gymState.gym)
      ? planDeload(validation.input, { units, equipment, gym: gymState.gym })
      : null;
  const sections = t('sections', { returnObjects: true }) as ToolSection[];
  const withUnit = (value: number) => `${formatDecimal(value, 1)} ${unit}`;
  const percent = (value: number) => `${formatDecimal(value, 1)}%`;

  const renderPlates = (load: DeloadLoad) => {
    if (load.perSide === null) {
      return null;
    }

    if (load.perSide.length === 0) {
      return t('results.emptyBar');
    }

    return load.perSide
      .map((plate) =>
        t('results.plateLine', {
          count: formatInteger(plate.count),
          weight: `${formatDecimal(plate.weight, 2)} ${unit}`,
        })
      )
      .join(', ');
  };

  const plates = plan ? renderPlates(plan.musclog) : null;

  return (
    <ToolLayout
      routeKey="toolDeloadCalculator"
      title={t('title')}
      intro={t('intro')}
      sections={sections}
      sources={[
        { label: t('sources.bell'), href: 'https://doi.org/10.1186/s40798-023-00633-0' },
        { label: t('sources.zourdos'), href: 'https://doi.org/10.1519/JSC.0000000000001049' },
      ]}
      articles={[
        { label: t('articles.deload'), href: '/blog/2026/11/deload-weeks-when-and-how' },
        {
          label: t('articles.doubleProgression'),
          href: '/blog/2026/11/double-progression-explained',
        },
      ]}
      related={['progressiveOverload', 'rpeChart', 'oneRepMax']}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <ToolPanel>
          <div className="space-y-4">
            <UnitsField units={units} onChange={setUnits} />
            <NumberField
              id="deload-weight"
              label={t('form.weight')}
              hint={t('form.weightHint')}
              value={weight}
              onChange={setWeight}
              suffix={unit}
              invalid={problem === 'weight'}
            />
            <NumberField
              id="deload-sets"
              label={t('form.sets')}
              hint={t('form.setsHint')}
              value={sets}
              onChange={setSets}
              inputMode="numeric"
              invalid={problem === 'sets'}
            />
            <ChoiceField
              label={t('form.equipmentLabel')}
              value={equipment}
              onChange={setEquipment}
              options={DELOAD_EQUIPMENT.map((value) => ({
                value,
                label: t(`form.equipment.${value}`),
              }))}
            />
            {isBarbell ? <GymFields units={units} gymState={gymState} /> : null}
          </div>
        </ToolPanel>

        <div className="flex flex-col gap-4">
          {problem ? (
            <ToolNotice tone="warning">
              {t(`problems.${problem}`, {
                max: formatInteger(
                  problem === 'weight' ? MAX_WORKING_WEIGHT[units] : MAX_DELOAD_SETS
                ),
              })}
            </ToolNotice>
          ) : null}
          {plan && validation.ok ? (
            <ToolPanel title={t('results.title')}>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ResultStat
                    emphasis
                    label={t('results.weight')}
                    value={withUnit(plan.musclog.weight)}
                    note={
                      plan.lighter
                        ? t('results.weightNote', {
                            percent: percent(plan.musclog.actualCutPercent),
                          })
                        : undefined
                    }
                  />
                  <ResultStat
                    emphasis
                    label={t('results.sets')}
                    value={t('results.setsValue', {
                      count: plan.setsKept,
                      sets: formatInteger(plan.setsKept),
                    })}
                    note={t('results.setsNote', { from: formatInteger(validation.input.sets) })}
                  />
                  <ResultStat
                    label={t('results.effort')}
                    value={t('results.effortValue', {
                      count: DELOAD_TARGET_RIR,
                    })}
                    note={t('results.effortNote', { count: DELOAD_TARGET_RIR })}
                  />
                  <ResultStat
                    label={t('results.duration')}
                    value={t('results.durationValue', { count: DELOAD_WEEKS })}
                    note={t('results.durationNote')}
                  />
                </div>
                {plan.lighter ? null : <ToolNotice>{t('results.noLighter')}</ToolNotice>}
                {plates ? (
                  <p className="text-sm" style={{ color: BODY_TEXT }}>
                    <span className="font-semibold">{t('results.plates')}: </span>
                    {plates}
                  </p>
                ) : null}
                <p className="text-sm" style={{ color: MUTED }}>
                  {t('results.step', { step: withUnit(plan.step) })}
                </p>
              </div>
            </ToolPanel>
          ) : null}
          {plan && plan.lighter ? (
            <ToolPanel title={t('table.title')}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm tabular-nums">
                  <thead>
                    <tr style={{ color: BODY_TEXT_SOFT }}>
                      <th className="pb-2 font-semibold">{t('table.cut')}</th>
                      <th className="pb-2 font-semibold">{t('table.weight')}</th>
                      <th className="pb-2 font-semibold">{t('table.actual')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[plan.musclog, ...plan.table].map((row, index) => (
                      <tr
                        key={row.cutPercent ?? 'musclog'}
                        className="border-t"
                        style={{ borderColor: CARD_BORDER }}
                      >
                        <td className="py-2" style={{ color: BODY_TEXT }}>
                          {index === 0
                            ? t('table.musclog')
                            : t('table.percent', { percent: percent(row.cutPercent ?? 0) })}
                        </td>
                        <td className="py-2 font-bold text-text-primary">{withUnit(row.weight)}</td>
                        <td className="py-2" style={{ color: BODY_TEXT }}>
                          {percent(row.actualCutPercent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-sm" style={{ color: MUTED }}>
                {t('table.note')}
              </p>
            </ToolPanel>
          ) : null}
        </div>
      </div>
    </ToolLayout>
  );
}

export function generateMetadata() {
  return fixedPageMetadata('toolDeloadCalculator');
}
