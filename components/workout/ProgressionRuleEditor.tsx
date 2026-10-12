import type { TFunction } from 'i18next';
import { Check, ChevronRight, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { Button } from '@/components/theme/Button';
import { StepperInlineInput } from '@/components/theme/StepperInlineInput';
import type { Units } from '@/constants/settings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import {
  defaultProgressionRule,
  type FieldBounds,
  type PercentageRule,
  PROGRESSION_RULE_BOUNDS,
  PROGRESSION_RULE_TYPES,
  type ProgressionRule,
  type ProgressionRuleType,
} from '@/utils/progressionRules';
import { displayToKg, kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnitI18nKey } from '@/utils/units';

import { PROGRESSION_METHOD_KEYS } from './session/sessionModel';

type MethodType = ProgressionRuleType | 'automatic';

const METHOD_DESCRIPTION_KEYS = {
  automatic: 'progression.descriptions.automatic',
  double_progression: 'progression.descriptions.double_progression',
  linear: 'progression.descriptions.linear',
  top_set_backoff: 'progression.descriptions.top_set_backoff',
  percentage: 'progression.descriptions.percentage',
} as const satisfies Record<MethodType, string>;

const FIELD_LABEL_KEYS: Record<string, string> = {
  repMin: 'progression.fields.repMin',
  repMax: 'progression.fields.repMax',
  reps: 'progression.fields.reps',
  failuresBeforeDeload: 'progression.fields.failuresBeforeDeload',
  deloadPercent: 'progression.fields.deloadPercent',
  backoffPercent: 'progression.fields.backoffPercent',
  backoffReps: 'progression.fields.backoffReps',
  percentOfTrainingMax: 'progression.fields.percentOfTrainingMax',
  trainingMaxPercent: 'progression.fields.trainingMaxPercent',
  trainingMaxKg: 'progression.fields.trainingMaxKg',
};

/** A method chosen afresh starts new carried state, never inheriting another method's streak. */
const freshRule = (type: ProgressionRuleType): ProgressionRule => ({
  ...defaultProgressionRule(type),
  resetAt: Date.now(),
});

/** Clearing the training max makes the next session estimate it again from scratch. */
const resetTrainingMax = (rule: PercentageRule): ProgressionRule => ({
  ...rule,
  resetAt: Date.now(),
  trainingMaxKg: undefined,
});

/** "Double progression · 8–12" — how a workout row names its exercise's rule. */
export function progressionRuleSummary(
  t: TFunction,
  rule: ProgressionRule | null | undefined,
  formatInteger: (value: number) => string
): string {
  const method = t(PROGRESSION_METHOD_KEYS[rule?.type ?? 'automatic']);
  if (rule && 'repMin' in rule) {
    return `${method} · ${formatInteger(rule.repMin)}\u2060–\u2060${formatInteger(rule.repMax)}`;
  }
  if (rule?.type === 'linear' || rule?.type === 'percentage') {
    return `${method} · ${t('progression.repsShort', { reps: formatInteger(rule.reps) })}`;
  }
  return method;
}

/**
 * The method cards and, under the chosen one, its settings. Each method says in a sentence what it
 * does, because "Linear" and "Double progression" mean nothing to someone who has not run them.
 */
export function ProgressionRuleFields({
  value,
  onChange,
  units: explicitUnits,
  plannedWeightKg,
}: {
  value?: ProgressionRule | null;
  onChange: (rule: ProgressionRule | null) => void;
  units?: Units;
  /** The exercise's planned load, used to suggest a starting training max. */
  plannedWeightKg?: number;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { units: accountUnits } = useSettings();
  const units = explicitUnits ?? accountUnits;
  const selected: MethodType = value?.type ?? 'automatic';

  const changeField = (field: string, n: number, bounds: FieldBounds) => {
    if (!value) {
      return;
    }
    const rule = { ...value, [field]: Math.min(bounds.max, Math.max(bounds.min, n)) };
    if ('repMin' in rule && rule.repMin > rule.repMax) {
      if (field === 'repMin') {
        rule.repMax = rule.repMin;
      } else {
        rule.repMin = rule.repMax;
      }
    }
    onChange(rule);
  };
  const choose = (type: MethodType) => {
    if (type === 'automatic') {
      onChange(null);
      return;
    }
    if (value?.type === type) {
      return;
    }
    onChange(freshRule(type));
  };
  const suggestedTrainingMax = () => {
    if (value?.type !== 'percentage' || !plannedWeightKg) {
      return 100;
    }
    const fromPlan = plannedWeightKg / (value.percentOfTrainingMax / 100);
    return Math.max(1, Math.round(fromPlan / 2.5) * 2.5);
  };

  const fields = value
    ? Object.entries(PROGRESSION_RULE_BOUNDS[value.type]).map(([field, bounds]) => {
        if (
          field === 'trainingMaxKg' &&
          value.type === 'percentage' &&
          value.trainingMaxKg == null
        ) {
          return (
            <View key={field} className="gap-2 rounded-xl bg-bg-overlay p-3">
              <Text className="text-sm text-text-secondary">{t('progression.tmEstimated')}</Text>
              <Button
                label={t('progression.enterTm')}
                variant="outline"
                size="sm"
                onPress={() => onChange({ ...value, trainingMaxKg: suggestedTrainingMax() })}
              />
            </View>
          );
        }
        const stored = (value as unknown as Record<string, number>)[field];
        const isWeight = field === 'trainingMaxKg';
        const number = isWeight ? kgToDisplay(stored, units) : stored;
        const step = isWeight ? kgToDisplay(bounds.step, units) : bounds.step;
        const update = (n: number) =>
          changeField(field, isWeight ? displayToKg(n, units) : n, bounds);
        return (
          <StepperInlineInput
            key={field}
            label={t(FIELD_LABEL_KEYS[field])}
            unit={isWeight ? t(getWeightUnitI18nKey(units)) : undefined}
            value={number}
            step={step}
            maxFractionDigits={bounds.step % 1 || isWeight ? 1 : 0}
            onChangeValue={update}
            onIncrement={() => update(number + step)}
            onDecrement={() => update(number - step)}
          />
        );
      })
    : null;

  return (
    <View className="gap-2">
      {(['automatic', ...PROGRESSION_RULE_TYPES] as const).map((type) => {
        const isSelected = type === selected;
        return (
          <View
            key={type}
            className={`overflow-hidden rounded-xl border ${isSelected ? 'border-accent-primary bg-accent-primary/10' : 'border-border-light bg-bg-card'}`}
          >
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              onPress={() => choose(type)}
              className="min-h-14 flex-row items-center gap-3 px-3 py-3"
            >
              <View
                className={`h-6 w-6 items-center justify-center rounded-full border-2 ${isSelected ? 'border-accent-primary bg-accent-primary' : 'border-border-default'}`}
              >
                {isSelected ? (
                  <Check size={14} strokeWidth={3} color={theme.colors.text.onAccent} />
                ) : null}
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-base font-semibold text-text-primary">
                  {t(PROGRESSION_METHOD_KEYS[type])}
                </Text>
                <Text className="text-sm text-text-secondary">
                  {t(METHOD_DESCRIPTION_KEYS[type])}
                </Text>
              </View>
            </Pressable>
            {isSelected && fields ? <View className="gap-3 px-3 pb-3">{fields}</View> : null}
          </View>
        );
      })}
      {value?.type === 'percentage' && value.trainingMaxKg != null ? (
        <Pressable
          accessibilityRole="button"
          className="min-h-11 justify-center"
          onPress={() => onChange(resetTrainingMax(value))}
        >
          <Text className="text-sm font-semibold text-accent-primary">
            {t('progression.resetTm')}
          </Text>
        </Pressable>
      ) : null}
      <Text className="pt-1 text-xs text-text-tertiary">{t('progression.editorHint')}</Text>
    </View>
  );
}

/** A tappable "Progression · Double progression · 8–12" row that opens the rule sheet. */
export function ProgressionRuleRow({
  value,
  onPress,
}: {
  value?: ProgressionRule | null;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-14 flex-row items-center gap-3 rounded-xl border border-border-light bg-bg-overlay px-4"
      testID="progression-rule-editor"
    >
      <TrendingUp size={theme.iconSize.md} color={theme.colors.accent.primary} />
      <View className="min-w-0 flex-1">
        <Text className="text-xs font-semibold uppercase text-text-secondary">
          {t('progression.method')}
        </Text>
        <Text className="text-base font-semibold text-text-primary" numberOfLines={1}>
          {progressionRuleSummary(t, value, (n) => formatInteger(n, { useGrouping: false }))}
        </Text>
      </View>
      <ChevronRight size={theme.iconSize.md} color={theme.colors.text.tertiary} />
    </Pressable>
  );
}

/** The rule sheet: choose a method for one exercise of a workout and tune it. */
export function ProgressionRuleSheet({
  exerciseName,
  value,
  onChange,
  onClose,
  units,
  plannedWeightKg,
}: {
  exerciseName?: string;
  value?: ProgressionRule | null;
  onChange: (rule: ProgressionRule | null) => void;
  onClose: () => void;
  units?: Units;
  plannedWeightKg?: number;
}) {
  const { t } = useTranslation();
  return (
    <BottomPopUp
      visible
      onClose={onClose}
      title={t('progression.method')}
      subtitle={exerciseName}
      footer={<Button label={t('trainingFlow.done')} width="full" onPress={onClose} />}
    >
      <View className="pb-4">
        <ProgressionRuleFields
          value={value}
          onChange={onChange}
          units={units}
          plannedWeightKg={plannedWeightKg}
        />
      </View>
    </BottomPopUp>
  );
}
