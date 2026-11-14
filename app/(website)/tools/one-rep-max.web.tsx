import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  estimateOneRepMax,
  validateOneRepMaxInput,
} from '@/components/website/tools/oneRepMaxModel';
import {
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
import { MAX_E1RM_REPS } from '@/utils/relativeStrength';

export default function OneRepMaxToolPage() {
  const { t } = useTranslation(undefined, { keyPrefix: 'websiteToolOneRepMax' });
  const { t: unitsT } = useTranslation(undefined, { keyPrefix: 'websiteTools.units' });
  const { formatDecimal, formatInteger } = useFormatAppNumber();
  const [units, setUnits] = useToolUnits();
  const [weight, setWeight] = useState('100');
  const [reps, setReps] = useState('5');
  const [reserve, setReserve] = useState('');
  const unit = units === 'imperial' ? unitsT('lb') : unitsT('kg');

  const validation = validateOneRepMaxInput(weight, reps, reserve);
  const estimate = validation.ok ? estimateOneRepMax(validation.input) : null;
  const problem = validation.ok ? null : validation.problem;
  const sections = t('sections', { returnObjects: true }) as ToolSection[];

  return (
    <ToolLayout
      routeKey="toolOneRepMax"
      title={t('title')}
      intro={t('intro')}
      sections={sections}
      sources={[
        { label: t('sources.nuzzo'), href: 'https://doi.org/10.1007/s40279-023-01937-7' },
        { label: t('sources.zourdos'), href: 'https://doi.org/10.1519/JSC.0000000000001049' },
      ]}
      related={['rpeChart', 'strengthLevel', 'warmUpCalculator']}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <ToolPanel>
          <div className="space-y-4">
            <UnitsField units={units} onChange={setUnits} />
            <NumberField
              id="orm-weight"
              label={t('form.weight')}
              value={weight}
              onChange={setWeight}
              suffix={unit}
              invalid={problem === 'weight'}
            />
            <NumberField
              id="orm-reps"
              label={t('form.reps')}
              hint={t('form.repsHint')}
              value={reps}
              onChange={setReps}
              inputMode="numeric"
              invalid={problem === 'reps' || problem === 'repsTooHigh'}
            />
            <NumberField
              id="orm-reserve"
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
          {estimate ? (
            <>
              <ResultStat
                emphasis
                label={t('results.estimate')}
                value={`${formatDecimal(estimate.oneRepMax, 1)} ${unit}`}
                note={t('results.range', {
                  low: formatDecimal(estimate.low, 1),
                  high: formatDecimal(estimate.high, 1),
                  unit,
                })}
              />
              <ToolPanel title={t('results.tableTitle')}>
                <table className="w-full text-left text-sm tabular-nums">
                  <thead>
                    <tr style={{ color: BODY_TEXT_SOFT }}>
                      <th className="pb-2 font-semibold">{t('results.percent')}</th>
                      <th className="pb-2 font-semibold">{t('results.weight')}</th>
                      <th className="pb-2 font-semibold">{t('results.reps')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimate.rows.map((row) => (
                      <tr
                        key={row.percent}
                        className="border-t"
                        style={{ borderColor: CARD_BORDER }}
                      >
                        <td className="py-2" style={{ color: BODY_TEXT }}>
                          {formatInteger(row.percent)}%
                        </td>
                        <td className="py-2 font-bold text-text-primary">
                          {formatDecimal(row.weight, 1)} {unit}
                        </td>
                        <td className="py-2" style={{ color: BODY_TEXT }}>
                          {formatInteger(row.reps)}
                          {row.extrapolated ? ' *' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {estimate.rows.some((row) => row.extrapolated) ? (
                  <p className="mt-3 text-xs" style={{ color: BODY_TEXT_SOFT }}>
                    {t('results.extrapolatedNote', { max: formatInteger(MAX_E1RM_REPS) })}
                  </p>
                ) : null}
              </ToolPanel>
              <ToolPanel title={t('results.byFormula')}>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm tabular-nums sm:grid-cols-4">
                  {estimate.formulas.map((entry) => (
                    <li key={entry.formula} style={{ color: MUTED }}>
                      {entry.formula}:{' '}
                      <span style={{ color: BODY_TEXT }}>{formatDecimal(entry.value, 1)}</span>
                    </li>
                  ))}
                </ul>
              </ToolPanel>
            </>
          ) : null}
        </div>
      </div>
    </ToolLayout>
  );
}

export function generateMetadata() {
  return fixedPageMetadata('toolOneRepMax');
}
