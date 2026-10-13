import { useTranslation } from 'react-i18next';

import type { Units } from '@/constants/settings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { isStartAdjustment, type SetAdjustment, type StartRuleDetail } from '@/utils/setAdjustment';
import { getWeightUnitI18nKey } from '@/utils/units';

import { startAdjustmentMessageKey } from './startAdjustmentMessage';

/**
 * Whole translation keys for a rule's reason, so `scripts/check-translations.js` sees every one of
 * them (a key completed at the call site reads as unused).
 */
const RULE_REASON_KEYS = {
  range: {
    add_weight: 'progression.reason.range.add_weight',
    add_reps: 'progression.reason.range.add_reps',
    hold: 'progression.reason.range.hold',
    deload: 'progression.reason.range.deload',
  },
  linear: {
    add_weight: 'progression.reason.linear.add_weight',
    hold: 'progression.reason.linear.hold',
    deload: 'progression.reason.linear.deload',
  },
  backoff: 'progression.reason.backoff',
  percentage: 'progression.reason.percentage',
} as const;

function ruleReasonKey(rule: StartRuleDetail): string {
  switch (rule.kind) {
    case 'range':
      return RULE_REASON_KEYS.range[rule.outcome];
    case 'linear':
      return RULE_REASON_KEYS.linear[rule.outcome];
    case 'backoff':
      return RULE_REASON_KEYS.backoff;
    case 'percentage':
      return RULE_REASON_KEYS.percentage;
  }
}

/**
 * The one sentence that explains why a set's numbers are not the plan's — shared by every surface
 * that shows an adjustment (live session, preview, Next time, Weekly Review), so they cannot phrase
 * the same change two ways.
 */
export function useAdjustmentMessage(adjustment: SetAdjustment | null | undefined, units: Units) {
  const { t } = useTranslation();
  const { locale, formatInteger } = useFormatAppNumber();
  if (!adjustment) {
    return null;
  }
  const weightUnit = t(getWeightUnitI18nKey(units));
  const formatWeight = (kg: number) => formatDisplayWeightKg(locale, units, kg);
  const formatReps = (reps: number) => formatInteger(reps, { useGrouping: false });
  const formatValue = (value: number) =>
    adjustment.field === 'weight' ? formatWeight(value) : formatReps(value);

  if (isStartAdjustment(adjustment)) {
    if (adjustment.rule) {
      const rule = adjustment.rule;
      return t(ruleReasonKey(rule), {
        ...rule,
        weight: formatWeight(adjustment.now.weightKg),
        reps: formatReps(adjustment.now.reps),
        unit: weightUnit,
        top: 'topSetKg' in rule ? formatWeight(rule.topSetKg) : '',
        tm: 'trainingMaxKg' in rule ? formatWeight(rule.trainingMaxKg) : '',
      });
    }
    const isWeight = adjustment.field === 'weight';
    return t(startAdjustmentMessageKey(adjustment), {
      to: formatValue(adjustment.to),
      from: formatValue(adjustment.from),
      last: isWeight ? formatWeight(adjustment.last.weightKg) : formatReps(adjustment.last.reps),
      weight: formatWeight(adjustment.now.weightKg),
      reps: formatReps(adjustment.now.reps),
      lastReps: formatReps(adjustment.last.reps),
      planReps: formatReps(adjustment.plan.reps),
      rir: formatInteger(Math.round(adjustment.last.averageRepsInReserve), { useGrouping: false }),
      unit: weightUnit,
    });
  }
  if (adjustment.cause === 'carry_over') {
    return t('workoutSession.adjustment.carryOver', {
      from: formatValue(adjustment.from),
      to: formatValue(adjustment.to),
      unit: weightUnit,
    });
  }
  if (adjustment.cause === 'backoff') {
    return t(RULE_REASON_KEYS.backoff, {
      percent: adjustment.percent,
      top: formatWeight(adjustment.topSetKg),
      weight: formatWeight(adjustment.to),
      unit: weightUnit,
    });
  }
  return t(
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
