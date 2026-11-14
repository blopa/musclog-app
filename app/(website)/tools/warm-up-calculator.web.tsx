import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GymFields } from '@/components/website/tools/GymFields';
import {
  ChoiceField,
  NumberField,
  ToolNotice,
  ToolPanel,
  UnitsField,
} from '@/components/website/tools/ToolFields';
import { ToolLayout, type ToolSection } from '@/components/website/tools/ToolLayout';
import { useToolGym, useToolUnits } from '@/components/website/tools/useToolState';
import {
  planWarmups,
  validateWorkingWeight,
  WARMUP_REST,
  type WarmupEquipment,
  type WarmupRow,
} from '@/components/website/tools/warmUpCalculatorModel';
import { BODY_TEXT, BODY_TEXT_SOFT, CARD_BORDER, MUTED } from '@/components/website/websiteColors';
import { fixedPageMetadata } from '@/components/website/websiteMetadata';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';

export default function WarmUpCalculatorToolPage() {
  const { t } = useTranslation(undefined, { keyPrefix: 'websiteToolWarmUpCalculator' });
  const { t: unitsT } = useTranslation(undefined, { keyPrefix: 'websiteTools.units' });
  const { formatDecimal, formatInteger } = useFormatAppNumber();
  const [units, setUnits] = useToolUnits();
  const [working, setWorking] = useState('100');
  const [equipment, setEquipment] = useState<WarmupEquipment>('barbell');
  const gymState = useToolGym(units);
  const unit = units === 'imperial' ? unitsT('lb') : unitsT('kg');
  const isBarbell = equipment === 'barbell';

  const validation = validateWorkingWeight(working, units);
  const problem = validation.ok ? null : validation.problem;
  // A barbell needs a readable gym; the other equipment uses a standard one.
  const gym = isBarbell ? gymState.gym : null;
  const plan =
    validation.ok && (!isBarbell || gym)
      ? planWarmups(validation.working, units, equipment, gym)
      : null;
  const sections = t('sections', { returnObjects: true }) as ToolSection[];
  const withUnit = (value: number) => `${formatDecimal(value, 2)} ${unit}`;

  const renderPlates = (row: WarmupRow) => {
    if (row.perSide === null) {
      return null;
    }

    if (row.perSide.length === 0) {
      return t('results.emptyBar');
    }

    return row.perSide
      .map((plate) =>
        t('results.plateLine', {
          count: formatInteger(plate.count),
          weight: withUnit(plate.weight),
        })
      )
      .join(', ');
  };

  return (
    <ToolLayout
      routeKey="toolWarmUpCalculator"
      title={t('title')}
      intro={t('intro')}
      sections={sections}
      related={['plateCalculator', 'oneRepMax']}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <ToolPanel>
          <div className="space-y-4">
            <UnitsField units={units} onChange={setUnits} />
            <NumberField
              id="warmup-working"
              label={t('form.working')}
              hint={t('form.workingHint')}
              value={working}
              onChange={setWorking}
              suffix={unit}
              invalid={problem === 'working'}
            />
            <ChoiceField
              label={t('form.equipmentLabel')}
              value={equipment}
              onChange={setEquipment}
              options={[
                { value: 'barbell', label: t('form.equipment.barbell') },
                { value: 'dumbbell', label: t('form.equipment.dumbbell') },
                { value: 'machine', label: t('form.equipment.machine') },
              ]}
            />
            {isBarbell ? <GymFields units={units} gymState={gymState} /> : null}
          </div>
        </ToolPanel>

        <div className="flex flex-col gap-4">
          {problem ? <ToolNotice tone="warning">{t('problems.working')}</ToolNotice> : null}
          {plan ? (
            <ToolPanel title={t('results.title')}>
              {plan.reason ? (
                <ToolNotice>
                  {plan.reason === 'barIsWarmUp' ? t('results.barIsWarmUp') : t('results.noRamp')}
                </ToolNotice>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm tabular-nums">
                    <thead>
                      <tr style={{ color: BODY_TEXT_SOFT }}>
                        <th className="pb-2 font-semibold">{t('results.set')}</th>
                        <th className="pb-2 font-semibold">{t('results.weight')}</th>
                        <th className="pb-2 font-semibold">{t('results.reps')}</th>
                        {isBarbell ? (
                          <th className="pb-2 font-semibold">{t('results.plates')}</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {plan.sets.map((row, index) => (
                        <tr
                          key={`${row.weightKg}-${index}`}
                          className="border-t"
                          style={{ borderColor: CARD_BORDER }}
                        >
                          <td className="py-2" style={{ color: BODY_TEXT }}>
                            {formatInteger(index + 1)}
                          </td>
                          <td className="py-2 font-bold text-text-primary">
                            {withUnit(row.weight)}
                          </td>
                          <td className="py-2" style={{ color: BODY_TEXT }}>
                            {formatInteger(row.reps ?? 0)}
                          </td>
                          {isBarbell ? (
                            <td className="py-2" style={{ color: BODY_TEXT }}>
                              {renderPlates(row)}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                      <tr className="border-t" style={{ borderColor: CARD_BORDER }}>
                        <td className="py-2" style={{ color: BODY_TEXT }}>
                          {t('results.working')}
                        </td>
                        <td className="py-2 font-bold text-text-primary">
                          {withUnit(plan.working.weight)}
                        </td>
                        <td className="py-2" style={{ color: MUTED }}>
                          {t('results.target')}
                        </td>
                        {isBarbell ? (
                          <td className="py-2" style={{ color: BODY_TEXT }}>
                            {renderPlates(plan.working)}
                          </td>
                        ) : null}
                      </tr>
                    </tbody>
                  </table>
                  <p className="mt-4 text-sm" style={{ color: MUTED }}>
                    {t('results.rest', { seconds: formatInteger(WARMUP_REST) })}
                  </p>
                  {isBarbell && !plan.workingLoadable ? (
                    <div className="mt-4">
                      <ToolNotice>{t('results.workingNotLoadable')}</ToolNotice>
                    </div>
                  ) : null}
                </div>
              )}
            </ToolPanel>
          ) : null}
        </div>
      </div>
    </ToolLayout>
  );
}

export function generateMetadata() {
  return fixedPageMetadata('toolWarmUpCalculator');
}
