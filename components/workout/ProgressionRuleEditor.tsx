import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { StepperInlineInput } from '@/components/theme/StepperInlineInput';
import type { Units } from '@/constants/settings';
import { useSettings } from '@/hooks/useSettings';
import {
  defaultProgressionRule,
  type FieldBounds,
  PROGRESSION_RULE_BOUNDS,
  PROGRESSION_RULE_TYPES,
  type ProgressionRule,
  type ProgressionRuleType,
} from '@/utils/progressionRules';
import { displayToKg, kgToDisplay } from '@/utils/unitConversion';

export function ProgressionRuleEditor({
  value,
  onChange,
  exerciseName,
  units: explicitUnits,
}: {
  value?: ProgressionRule | null;
  onChange: (rule: ProgressionRule | null) => void;
  exerciseName?: string;
  units?: Units;
}) {
  const { t } = useTranslation();
  const { units: accountUnits } = useSettings();
  const units = explicitUnits ?? accountUnits;
  const [expanded, setExpanded] = useState(false);
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
  return (
    <View className="gap-3 py-3">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        className="min-h-12 justify-center rounded-xl bg-bg-cardElevated px-3"
        testID="progression-rule-editor"
      >
        {exerciseName ? (
          <Text className="font-semibold text-text-primary">{exerciseName}</Text>
        ) : null}
        <Text className="text-sm text-accent-primary">
          {t('progression.method')} · {t(`progression.methods.${value?.type ?? 'automatic'}`)}
        </Text>
      </Pressable>
      {expanded ? (
        <View className="gap-3">
          <View className="flex-row flex-wrap gap-2">
            {(['automatic', ...PROGRESSION_RULE_TYPES] as const).map((type) => (
              <Pressable
                key={type}
                accessibilityRole="radio"
                accessibilityState={{ checked: type === (value?.type ?? 'automatic') }}
                onPress={() =>
                  onChange(
                    type === 'automatic'
                      ? null
                      : {
                          ...(value?.type === type
                            ? value
                            : defaultProgressionRule(type as ProgressionRuleType)),
                          resetAt: value?.type === type ? value.resetAt : Date.now(),
                        }
                  )
                }
                className={`min-h-12 justify-center rounded-xl px-3 ${type === (value?.type ?? 'automatic') ? 'bg-accent-primary10' : 'bg-bg-cardElevated'}`}
              >
                <Text className="text-text-primary">{t(`progression.methods.${type}`)}</Text>
              </Pressable>
            ))}
          </View>
          {value
            ? Object.entries(PROGRESSION_RULE_BOUNDS[value.type]).map(([field, bounds]) => {
                if (
                  field === 'trainingMaxKg' &&
                  value.type === 'percentage' &&
                  value.trainingMaxKg == null
                ) {
                  return (
                    <Pressable
                      key={field}
                      accessibilityRole="button"
                      className="min-h-12 justify-center"
                      onPress={() => onChange({ ...value, trainingMaxKg: 100 })}
                    >
                      <Text className="text-accent-primary">{t('progression.enterTm')}</Text>
                    </Pressable>
                  );
                }
                const stored = (value as unknown as Record<string, number>)[field];
                const number = field === 'trainingMaxKg' ? kgToDisplay(stored, units) : stored;
                const update = (n: number) =>
                  changeField(field, field === 'trainingMaxKg' ? displayToKg(n, units) : n, bounds);
                return (
                  <StepperInlineInput
                    key={field}
                    label={
                      field === 'trainingMaxKg'
                        ? `${t('progression.fields.trainingMaxKg')} (${units === 'imperial' ? 'lb' : 'kg'})`
                        : t(`progression.fields.${field}`)
                    }
                    value={number}
                    step={bounds.step}
                    maxFractionDigits={bounds.step % 1 ? 1 : 0}
                    onChangeValue={update}
                    onIncrement={() =>
                      update(
                        number +
                          (field === 'trainingMaxKg'
                            ? kgToDisplay(bounds.step, units)
                            : bounds.step)
                      )
                    }
                    onDecrement={() =>
                      update(
                        number -
                          (field === 'trainingMaxKg'
                            ? kgToDisplay(bounds.step, units)
                            : bounds.step)
                      )
                    }
                  />
                );
              })
            : null}
          {value?.type === 'percentage' ? (
            <Pressable
              accessibilityRole="button"
              className="min-h-12 justify-center"
              onPress={() => onChange({ ...value, resetAt: Date.now(), trainingMaxKg: undefined })}
            >
              <Text className="text-accent-primary">{t('progression.resetTm')}</Text>
            </Pressable>
          ) : null}
          <Text className="text-sm text-text-secondary">{t('progression.editorHint')}</Text>
        </View>
      ) : null}
    </View>
  );
}
