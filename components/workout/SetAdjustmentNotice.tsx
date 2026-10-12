import { Calculator } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { InfoCard } from '@/components/cards/InfoCard';
import type { Units } from '@/constants/settings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { isStartAdjustment, type SetAdjustment } from '@/utils/setAdjustment';
import { getWeightUnitI18nKey } from '@/utils/units';

import { startAdjustmentMessageKey } from './startAdjustmentMessage';

type SetAdjustmentNoticeProps = {
  adjustment: SetAdjustment;
  units?: Units;
  /** Undo a start adjustment. Offered only for those: a between-sets change has no "last time". */
  onRevert?: () => void;
};

/**
 * States, in one sentence, why the set on screen is not the set the plan asked for. The session
 * already re-targets weight and reps between sets, and starts a workout from how the last one
 * went; without this the user just watches their numbers change on their own.
 */
export function SetAdjustmentNotice({
  adjustment,
  onRevert,
  units: exerciseUnits,
}: SetAdjustmentNoticeProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { units: accountUnits } = useSettings();
  const units = exerciseUnits ?? accountUnits;
  const { locale, formatInteger } = useFormatAppNumber();
  const weightUnit = t(getWeightUnitI18nKey(units));

  const formatWeight = (kg: number) => formatDisplayWeightKg(locale, units, kg);
  const formatReps = (reps: number) => formatInteger(reps, { useGrouping: false });
  const formatValue = (value: number) =>
    adjustment.field === 'weight' ? formatWeight(value) : formatReps(value);

  let message: string;
  if (isStartAdjustment(adjustment)) {
    const isWeight = adjustment.field === 'weight';
    message = t(startAdjustmentMessageKey(adjustment), {
      to: formatValue(adjustment.to),
      from: formatValue(adjustment.from),
      last: isWeight ? formatWeight(adjustment.last.weightKg) : formatReps(adjustment.last.reps),
      reps: formatReps(adjustment.now.reps),
      lastReps: formatReps(adjustment.last.reps),
      planReps: formatReps(adjustment.plan.reps),
      rir: formatInteger(Math.round(adjustment.last.averageRepsInReserve), { useGrouping: false }),
      unit: weightUnit,
    });
    if (adjustment.rule) {
      const rule = adjustment.rule;
      const key =
        rule.kind === 'range'
          ? `progression.reason.range.${rule.outcome}`
          : rule.kind === 'linear'
            ? `progression.reason.linear.${rule.outcome}`
            : `progression.reason.${rule.kind}`;
      message = t(key, {
        ...rule,
        weight: formatWeight(adjustment.now.weightKg),
        reps: formatReps(adjustment.now.reps),
        unit: weightUnit,
        top: 'topSetKg' in rule ? formatWeight(rule.topSetKg) : '',
        tm: 'trainingMaxKg' in rule ? formatWeight(rule.trainingMaxKg) : '',
      });
    }
  } else if (adjustment.cause === 'carry_over') {
    message = t('workoutSession.adjustment.carryOver', {
      from: formatValue(adjustment.from),
      to: formatValue(adjustment.to),
      unit: weightUnit,
    });
  } else if (adjustment.cause === 'backoff') {
    message = t('progression.reason.backoff', {
      percent: adjustment.percent,
      top: formatWeight(adjustment.topSetKg),
      weight: formatWeight(adjustment.to),
      unit: weightUnit,
    });
  } else {
    message = t(
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
  }

  const revertLabel =
    isStartAdjustment(adjustment) && (adjustment.rule || adjustment.cause === 'repeat')
      ? t('workoutSession.adjustment.usePlan')
      : t('workoutSession.adjustment.usePlan');

  return (
    <View className="gap-1" testID="set-adjustment-notice">
      <InfoCard
        variant="accent"
        icon={Calculator}
        label={t('workoutSession.adjustment.label')}
        message={message}
        inlineLabel={true}
        size="sm"
      />
      {onRevert ? (
        <Pressable
          onPress={onRevert}
          accessibilityRole="button"
          className="min-h-11 justify-center self-start px-2 py-1"
          testID="set-adjustment-revert"
        >
          <Text className="text-sm font-semibold" style={{ color: theme.colors.accent.primary }}>
            {revertLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
