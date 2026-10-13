import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Chip } from '@/components/theme/Chip';

export function WeekdayChoiceChips({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (day: number) => void;
  disabled?: boolean;
}) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  return (
    <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
      {Array.from({ length: 7 }, (_, offset) => (offset + 1) % 7).map((day) => (
        <Chip
          key={day}
          variant="solid"
          role="radio"
          selected={value === day}
          disabled={disabled}
          onPress={() => onChange(day)}
          label={new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(
            new Date(2024, 0, 7 + day)
          )}
          accessibilityLabel={new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(
            new Date(2024, 0, 7 + day)
          )}
        />
      ))}
    </View>
  );
}
