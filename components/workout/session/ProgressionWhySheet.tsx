import {
  Calculator,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  type LucideIcon,
  PencilLine,
  Undo2,
  Warehouse,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { useAdjustmentMessage } from '@/components/workout/useAdjustmentMessage';
import type { Units } from '@/constants/settings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { parseSessionProgressionState, type ProgressionRule } from '@/utils/progressionRules';
import { isStartAdjustment, type SetAdjustment } from '@/utils/setAdjustment';
import type { SetPrescription } from '@/utils/setPrescription';
import { getWeightUnitI18nKey } from '@/utils/units';

import { GuidanceBadgeLine } from './GuidanceSummary';
import { type GuidanceState, PROGRESSION_METHOD_KEYS } from './sessionModel';

function ActionRow({
  icon: Icon,
  label,
  hint,
  onPress,
  testID,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onPress: () => void;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      className="min-h-14 flex-row items-center gap-3 rounded-xl bg-bg-overlay px-4 py-3"
    >
      <Icon size={theme.iconSize.md} color={theme.colors.accent.primary} />
      <View className="min-w-0 flex-1">
        <Text className="text-base font-semibold text-text-primary">{label}</Text>
        {hint ? <Text className="text-xs text-text-secondary">{hint}</Text> : null}
      </View>
      <ChevronRight size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
    </Pressable>
  );
}

/**
 * "Why?" for an exercise's targets: the method, the reason in one sentence, the numbers the
 * calculation used, and what the user can do about it — undo for this session, or a lasting change
 * through the gym or the workout editor.
 */
export function ProgressionWhySheet({
  exerciseName,
  state,
  rule,
  progressionJson,
  adjustment,
  prescription,
  units,
  isBarLoaded,
  canEditPlan,
  onClose,
  onRevert,
  onPlates,
  onEditGym,
  onEditPlan,
  onEditTarget,
}: {
  exerciseName: string;
  state: GuidanceState;
  rule: ProgressionRule | null;
  progressionJson?: string;
  adjustment?: SetAdjustment | null;
  prescription: SetPrescription | null;
  units: Units;
  isBarLoaded: boolean;
  canEditPlan: boolean;
  onClose: () => void;
  onRevert: () => void;
  onPlates: () => void;
  onEditGym: () => void;
  onEditPlan: () => void;
  onEditTarget: () => void;
}) {
  const { t } = useTranslation();
  const { locale, formatInteger, formatDecimal } = useFormatAppNumber();
  const message = useAdjustmentMessage(adjustment, units);
  const unit = t(getWeightUnitI18nKey(units));
  const load = (value: { weightKg: number; reps: number }) =>
    `${formatDisplayWeightKg(locale, units, value.weightKg)} ${unit} × ${formatInteger(value.reps, { useGrouping: false })}`;
  const int = (value: number) => formatInteger(value, { useGrouping: false });

  let ruleLine: string | null = null;
  if (rule?.type === 'double_progression') {
    ruleLine = t('progression.summary.range', { min: int(rule.repMin), max: int(rule.repMax) });
  } else if (rule?.type === 'linear') {
    ruleLine = t('progression.summary.linear', {
      reps: int(rule.reps),
      misses: int(rule.failuresBeforeDeload),
      percent: int(rule.deloadPercent),
    });
  } else if (rule?.type === 'top_set_backoff') {
    ruleLine = t('progression.summary.topSet', {
      min: int(rule.repMin),
      max: int(rule.repMax),
      percent: int(rule.backoffPercent),
      reps: int(rule.backoffReps),
    });
  } else if (rule?.type === 'percentage') {
    const tm = parseSessionProgressionState(progressionJson)?.trainingMaxKg ?? rule.trainingMaxKg;
    ruleLine =
      tm != null
        ? t('progression.summary.percentage', {
            percent: formatDecimal(rule.percentOfTrainingMax, 1),
            reps: int(rule.reps),
            tm: formatDisplayWeightKg(locale, units, tm),
            unit,
          })
        : t('progression.summary.percentageNoTm');
  }

  const inputs: { label: string; value: string }[] = [];
  if (ruleLine) {
    inputs.push({ label: t(PROGRESSION_METHOD_KEYS[rule!.type]), value: ruleLine });
  }
  if (prescription) {
    inputs.push({ label: t('progression.inputs.plan'), value: load(prescription.plan) });
  }
  if (prescription?.previous) {
    inputs.push({ label: t('progression.inputs.lastTime'), value: load(prescription.previous) });
  }
  if (prescription) {
    inputs.push({
      label: t('progression.inputs.today'),
      value: load(prescription.recommendation),
    });
  }

  const canRevert = !!adjustment && isStartAdjustment(adjustment);
  let lead = message;
  if (state === 'attention') {
    lead = t('progression.attentionHint');
  } else if (!lead) {
    lead = t(rule ? 'progression.followRule' : 'progression.learningHint');
  }

  return (
    <BottomPopUp
      visible
      onClose={onClose}
      title={t('trainingFlow.whyTitle')}
      subtitle={exerciseName}
    >
      <View className="gap-5 pb-6" testID="progression-why">
        <View className="gap-3">
          <GuidanceBadgeLine state={state} rule={rule} />
          <Text className="text-base leading-6 text-text-primary">{lead}</Text>
          {prescription?.override === 'plan' ? (
            <Text className="text-sm text-text-secondary">{t('progression.usingPlan')}</Text>
          ) : null}
          {prescription?.override === 'manual' ? (
            <Text className="text-sm text-text-secondary">{t('progression.usingManual')}</Text>
          ) : null}
        </View>

        {inputs.length ? (
          <View className="overflow-hidden rounded-xl border border-border-light">
            {inputs.map((row, index) => (
              <View
                key={row.label}
                className={`flex-row items-center justify-between gap-3 px-4 py-3 ${index ? 'border-t border-border-light' : ''}`}
              >
                <Text className="text-sm text-text-secondary">{row.label}</Text>
                <Text className="shrink text-right text-sm font-semibold text-text-primary">
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View className="gap-2">
          {canRevert ? (
            <ActionRow
              icon={Undo2}
              label={t('workoutSession.adjustment.usePlan')}
              hint={t('progression.usePlanHint')}
              onPress={onRevert}
              testID="why-use-plan"
            />
          ) : null}
          {state === 'attention' ? (
            <ActionRow
              icon={PencilLine}
              label={t('progression.editTarget')}
              onPress={onEditTarget}
            />
          ) : null}
          {isBarLoaded ? (
            <ActionRow
              icon={Calculator}
              label={t('workoutSettings.plateCalculator.title')}
              onPress={onPlates}
            />
          ) : null}
          <ActionRow
            icon={state === 'attention' ? Warehouse : Dumbbell}
            label={t('progression.editGym')}
            hint={t('progression.editGymHint')}
            onPress={onEditGym}
          />
          {canEditPlan ? (
            <ActionRow
              icon={ClipboardList}
              label={t('progression.editPlan')}
              hint={t('progression.editPlanHint')}
              onPress={onEditPlan}
            />
          ) : null}
        </View>
      </View>
    </BottomPopUp>
  );
}
