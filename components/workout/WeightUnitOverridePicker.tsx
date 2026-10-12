import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { WeightUnitOverride } from '@/utils/unitConversion';

/** `null` is "no override", so the picker always has a way back to following the next level up. */
const UNIT_CHOICES: readonly (WeightUnitOverride | null)[] = [null, 'kg', 'lbs'];

type WeightUnitOverridePickerProps = {
  label: string;
  /** What `null` means here ("App default", "Account setting"). */
  defaultLabel: string;
  value: WeightUnitOverride | null;
  onChange: (unit: WeightUnitOverride | null) => void;
  disabled?: boolean;
};

/**
 * The kg / lbs / default choice for a unit OVERRIDE — an exercise's or a gym's. Shared so the two
 * levels of `resolveWeightUnits` look and behave the same; storage stays metric whatever is chosen.
 */
export function WeightUnitOverridePicker({
  label,
  defaultLabel,
  value,
  onChange,
  disabled = false,
}: WeightUnitOverridePickerProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const choiceLabel = (unit: WeightUnitOverride | null) => {
    if (unit === null) {
      return defaultLabel;
    }
    return t(unit === 'kg' ? 'workoutSession.kg' : 'workoutSession.lb');
  };

  return (
    <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {UNIT_CHOICES.map((unit) => {
          const selected = value === unit;
          return (
            <Pressable
              key={unit ?? 'default'}
              onPress={() => onChange(unit)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className="rounded-full border px-4 py-2"
              style={{
                backgroundColor: selected
                  ? theme.colors.accent.primary20
                  : theme.colors.background.card,
                borderColor: selected ? theme.colors.accent.primary : theme.colors.border.light,
              }}
            >
              <Text
                className="font-medium"
                style={{
                  color: selected ? theme.colors.accent.primary : theme.colors.text.primary,
                }}
              >
                {choiceLabel(unit)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
