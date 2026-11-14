import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GymFields } from '@/components/website/tools/GymFields';
import {
  MAX_PLATE_TARGET,
  solvePlateLoad,
  validatePlateTarget,
} from '@/components/website/tools/plateCalculatorModel';
import {
  NumberField,
  ResultStat,
  ToolNotice,
  ToolPanel,
  UnitsField,
} from '@/components/website/tools/ToolFields';
import { ToolLayout, type ToolSection } from '@/components/website/tools/ToolLayout';
import { useToolGym, useToolUnits } from '@/components/website/tools/useToolState';
import { BODY_TEXT, BODY_TEXT_SOFT, MUTED } from '@/components/website/websiteColors';
import { fixedPageMetadata } from '@/components/website/websiteMetadata';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';

export default function PlateCalculatorToolPage() {
  const { t } = useTranslation(undefined, { keyPrefix: 'websiteToolPlateCalculator' });
  const { t: unitsT } = useTranslation(undefined, { keyPrefix: 'websiteTools.units' });
  const { formatDecimal, formatInteger } = useFormatAppNumber();
  const [units, setUnits] = useToolUnits();
  const [target, setTarget] = useState('140');
  const gymState = useToolGym(units);
  const unit = units === 'imperial' ? unitsT('lb') : unitsT('kg');

  const validation = validatePlateTarget(target, units);
  const problem = validation.ok ? null : validation.problem;
  const solution =
    validation.ok && gymState.gym ? solvePlateLoad(validation.target, units, gymState.gym) : null;
  const sections = t('sections', { returnObjects: true }) as ToolSection[];
  const withUnit = (value: number) => `${formatDecimal(value, 2)} ${unit}`;

  return (
    <ToolLayout
      routeKey="toolPlateCalculator"
      title={t('title')}
      intro={t('intro')}
      sections={sections}
      related={['warmUpCalculator', 'oneRepMax']}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <ToolPanel>
          <div className="space-y-4">
            <UnitsField units={units} onChange={setUnits} />
            <NumberField
              id="plate-target"
              label={t('form.target')}
              hint={t('form.targetHint')}
              value={target}
              onChange={setTarget}
              suffix={unit}
              invalid={problem === 'target'}
            />
            <GymFields units={units} gymState={gymState} />
          </div>
        </ToolPanel>

        <div className="flex flex-col gap-4">
          {problem ? (
            <ToolNotice tone="warning">
              {t(`problems.${problem}`, {
                max: formatDecimal(MAX_PLATE_TARGET[units], 0),
                unit,
              })}
            </ToolNotice>
          ) : null}
          {solution ? (
            <>
              <ResultStat
                emphasis
                label={t('results.loaded')}
                value={withUnit(solution.loadedWeight)}
                note={
                  solution.exact
                    ? t('results.exact')
                    : t('results.inexact', {
                        target: withUnit(validation.ok ? validation.target : 0),
                        below: withUnit(solution.loadedWeight),
                        nearest: withUnit(solution.nearestLoadable),
                      })
                }
              />
              {solution.belowBar ? (
                <ToolNotice tone="warning">
                  {t('results.belowBar', { bar: withUnit(solution.barWeight) })}
                </ToolNotice>
              ) : (
                <ToolPanel title={t('results.perSide')}>
                  {solution.perSide.length === 0 ? (
                    <p className="text-sm" style={{ color: MUTED }}>
                      {t('results.noPlates')}
                    </p>
                  ) : (
                    <ul className="space-y-2 text-base tabular-nums">
                      {solution.perSide.map((plate) => (
                        <li key={plate.weight} style={{ color: BODY_TEXT }}>
                          <span className="font-bold text-text-primary">
                            {t('results.plateLine', {
                              count: formatInteger(plate.count),
                              weight: withUnit(plate.weight),
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-4 text-sm" style={{ color: BODY_TEXT_SOFT }}>
                    {t('results.barLine', { bar: withUnit(solution.barWeight) })}
                  </p>
                </ToolPanel>
              )}
            </>
          ) : null}
        </div>
      </div>
    </ToolLayout>
  );
}

export function generateMetadata() {
  return fixedPageMetadata('toolPlateCalculator');
}
