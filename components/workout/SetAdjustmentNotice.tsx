import { Calculator } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { InfoCard } from '@/components/cards/InfoCard';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import type { SetAdjustment } from '@/utils/setAdjustment';
import { getWeightUnitI18nKey } from '@/utils/units';

type SetAdjustmentNoticeProps = {
  adjustment: SetAdjustment;
};

/**
 * States, in one sentence, why the set on screen is not the set the plan asked for. The
 * session already re-targets weight and reps between sets; without this the user just
 * watches their numbers change on their own.
 */
export function SetAdjustmentNotice({ adjustment }: SetAdjustmentNoticeProps) {
  const { t } = useTranslation();
  const { units } = useSettings();
  const { locale, formatInteger } = useFormatAppNumber();
  const weightUnit = t(getWeightUnitI18nKey(units));

  const formatValue = (value: number) =>
    adjustment.field === 'weight'
      ? formatDisplayWeightKg(locale, units, value)
      : formatInteger(value, { useGrouping: false });

  const message =
    adjustment.cause === 'carry_over'
      ? t('workoutSession.adjustment.carryOver', {
          from: formatValue(adjustment.from),
          to: formatValue(adjustment.to),
          unit: weightUnit,
        })
      : t(
          adjustment.field === 'weight'
            ? 'workoutSession.adjustment.targetRirWeight'
            : 'workoutSession.adjustment.targetRirReps',
          {
            from: formatValue(adjustment.from),
            to: formatValue(adjustment.to),
            unit: weightUnit,
            rir: formatInteger(adjustment.targetRepsInReserve, { useGrouping: false }),
            oneRepMax: formatDisplayWeightKg(locale, units, adjustment.estimatedOneRepMaxKg),
          }
        );

  return (
    <InfoCard
      variant="accent"
      icon={Calculator}
      label={t('workoutSession.adjustment.label')}
      message={message}
      inlineLabel={true}
      size="sm"
    />
  );
}
