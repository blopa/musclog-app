import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Chip } from '@/components/theme/Chip';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { BODYWEIGHT_REP_CEILING_OPTIONS } from '@/utils/bodyweightRepCeiling';

type BodyweightRepCeilingPickerProps = {
  value: number;
  onChange: (ceiling: number) => void;
  disabled?: boolean;
};

/**
 * How many reps an unloaded bodyweight exercise climbs to before the app stops adding them and
 * suggests a harder way to progress. A fixed set of choices, never a typed number.
 */
export function BodyweightRepCeilingPicker({
  value,
  onChange,
  disabled = false,
}: BodyweightRepCeilingPickerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const label = t('exercises.viewExercise.preferences.repCeilingLabel');

  return (
    <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {BODYWEIGHT_REP_CEILING_OPTIONS.map((ceiling) => (
          <Chip
            key={ceiling}
            role="radio"
            selected={value === ceiling}
            disabled={disabled}
            onPress={() => onChange(ceiling)}
            label={formatInteger(ceiling, { useGrouping: false })}
            accessibilityLabel={t('exercises.viewExercise.preferences.repCeilingOption', {
              reps: formatInteger(ceiling, { useGrouping: false }),
            })}
            testID={`rep-ceiling-${ceiling}`}
          />
        ))}
      </View>
      <Text className="text-xs" style={{ color: theme.colors.text.tertiary }}>
        {t('exercises.viewExercise.preferences.repCeilingHint')}
      </Text>
    </View>
  );
}
