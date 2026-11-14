import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  calculateRpeTarget,
  CALCULATOR_RPES,
  CHART_RPES,
  reserveForRpe,
  rpeChartRows,
  validateRpeCalculator,
} from '@/components/website/tools/rpeChartModel';
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
import { BODY_TEXT, BODY_TEXT_SOFT, CARD_BORDER, MUTED } from '@/components/website/websiteColors';
import { fixedPageMetadata } from '@/components/website/websiteMetadata';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { kgToDisplay } from '@/utils/unitConversion';

export default function RpeChartToolPage() {
  const { t } = useTranslation(undefined, { keyPrefix: 'websiteToolRpeChart' });
  const { t: unitsT } = useTranslation(undefined, { keyPrefix: 'websiteTools.units' });
  const { formatDecimal, formatInteger } = useFormatAppNumber();
  const [units, setUnits] = useToolUnits();
  const [weight, setWeight] = useState('100');
  const [reps, setReps] = useState('5');
  const [rpe, setRpe] = useState<number>(8);
  const [targetReps, setTargetReps] = useState('3');
  const [targetRpe, setTargetRpe] = useState<number>(9);
  const unit = units === 'imperial' ? unitsT('lb') : unitsT('kg');

  const chart = rpeChartRows();
  const validation = validateRpeCalculator({
    units,
    weightText: weight,
    repsText: reps,
    rpe,
    targetRepsText: targetReps,
    targetRpe,
  });
  const problem = validation.ok ? null : validation.problem;
  const result = validation.ok ? calculateRpeTarget(validation.input) : null;
  const sections = t('sections', { returnObjects: true }) as ToolSection[];

  const meanings: Record<number, string> = {
    10: t('meaning.none'),
    9: t('meaning.one'),
    8: t('meaning.two'),
    7: t('meaning.three'),
    6: t('meaning.four'),
  };

  const show = (kg: number) => `${formatDecimal(kgToDisplay(kg, units), 1)} ${unit}`;

  return (
    <ToolLayout
      routeKey="toolRpeChart"
      title={t('title')}
      intro={t('intro')}
      sections={sections}
      sources={[
        { label: t('sources.zourdos'), href: 'https://doi.org/10.1519/JSC.0000000000001049' },
      ]}
      related={['oneRepMax', 'warmUpCalculator']}
    >
      <div className="flex flex-col gap-6">
        <ToolPanel title={t('chart.title')}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm tabular-nums">
              <thead>
                <tr style={{ color: BODY_TEXT_SOFT }}>
                  <th className="pb-2 font-semibold">{t('chart.reps')}</th>
                  {CHART_RPES.map((value) => (
                    <th key={value} className="pb-2 font-semibold">
                      {t('chart.rpeColumn', { rpe: formatInteger(value) })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.map((row) => (
                  <tr key={row.reps} className="border-t" style={{ borderColor: CARD_BORDER }}>
                    <td className="py-2" style={{ color: BODY_TEXT }}>
                      {formatInteger(row.reps)}
                    </td>
                    {row.cells.map((cell) => (
                      <td key={cell.rpe} className="py-2 font-bold text-text-primary">
                        {formatInteger(cell.percent)}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: MUTED }}>
            {t('chart.note')}
          </p>
        </ToolPanel>

        <ToolPanel title={t('meaning.title')}>
          <table className="w-full text-left text-sm tabular-nums">
            <thead>
              <tr style={{ color: BODY_TEXT_SOFT }}>
                <th className="pb-2 font-semibold">{t('meaning.rpe')}</th>
                <th className="pb-2 font-semibold">{t('meaning.reserve')}</th>
                <th className="pb-2 font-semibold">{t('meaning.meaning')}</th>
              </tr>
            </thead>
            <tbody>
              {CHART_RPES.map((value) => (
                <tr key={value} className="border-t" style={{ borderColor: CARD_BORDER }}>
                  <td className="py-2 font-bold text-text-primary">{formatInteger(value)}</td>
                  <td className="py-2" style={{ color: BODY_TEXT }}>
                    {formatInteger(reserveForRpe(value))}
                  </td>
                  <td className="py-2" style={{ color: BODY_TEXT }}>
                    {meanings[value]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ToolPanel>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
          <ToolPanel>
            <div className="space-y-4">
              <UnitsField units={units} onChange={setUnits} />
              <NumberField
                id="rpe-weight"
                label={t('form.weight')}
                value={weight}
                onChange={setWeight}
                suffix={unit}
                invalid={problem === 'weight'}
              />
              <NumberField
                id="rpe-reps"
                label={t('form.reps')}
                hint={t('form.repsHint')}
                value={reps}
                onChange={setReps}
                inputMode="numeric"
                invalid={problem === 'reps'}
              />
              <ChoiceField
                label={t('form.rpe')}
                value={rpe}
                onChange={setRpe}
                options={CALCULATOR_RPES.map((value) => ({ value, label: formatInteger(value) }))}
              />
              <NumberField
                id="rpe-target-reps"
                label={t('form.targetReps')}
                hint={t('form.targetRepsHint')}
                value={targetReps}
                onChange={setTargetReps}
                inputMode="numeric"
                invalid={problem === 'targetReps'}
              />
              <ChoiceField
                label={t('form.targetRpe')}
                value={targetRpe}
                onChange={setTargetRpe}
                options={CALCULATOR_RPES.map((value) => ({ value, label: formatInteger(value) }))}
              />
            </div>
          </ToolPanel>

          <div className="flex flex-col gap-4">
            {problem ? <ToolNotice tone="warning">{t(`problems.${problem}`)}</ToolNotice> : null}
            {result ? (
              <>
                <ResultStat label={t('results.oneRepMax')} value={show(result.oneRepMaxKg)} />
                <ResultStat
                  emphasis
                  label={t('results.target')}
                  value={show(result.targetKg)}
                  note={`${formatInteger(validation.ok ? validation.input.targetReps : 0)} ${t('results.reps')} ${t('results.atRpe')} ${formatInteger(targetRpe)}`}
                />
                <ResultStat
                  label={t('results.targetRounded')}
                  value={show(result.roundedTargetKg)}
                  note={t('results.roundedNote')}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}

export function generateMetadata() {
  return fixedPageMetadata('toolRpeChart');
}
