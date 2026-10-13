import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Chip } from '@/components/theme/Chip';
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
            <Chip
              key={unit ?? 'default'}
              selected={selected}
              disabled={disabled}
              onPress={() => onChange(unit)}
              label={choiceLabel(unit)}
            />
          );
        })}
      </View>
    </View>
  );
}
