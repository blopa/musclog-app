import { format, isSameDay } from 'date-fns';
import { Calendar, Edit } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useDateFnsLocale } from '../../hooks/useDateFnsLocale';
import { useTheme } from '../../hooks/useTheme';

export type DatePickerInputProps = {
  selectedDate: Date;
  onPress: () => void;
  /** When omitted, the label uses `food.foodDetails.date`. */
  label?: string;
  variant?: 'default' | 'compact'; // TODO: implement compact version, will have a slightly smaller icon and smaller height
};

export function DatePickerInput({ selectedDate, onPress, label, variant = 'default' }: DatePickerInputProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const dateFnsLocale = useDateFnsLocale();

  return (
    <View>
      <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
        {label ?? t('food.foodDetails.date')}
      </Text>
      <Pressable
        className="flex-row items-center justify-between rounded-lg border border-white/10 bg-bg-cardDark p-4"
        onPress={onPress}
      >
        <View className="flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: theme.colors.status.indigo20,
            }}
          >
            <Calendar size={theme.iconSize.md} color={theme.colors.accent.primary} />
          </View>
          <View>
            <Text className="font-medium text-text-primary">
              {isSameDay(selectedDate, new Date())
                ? t('food.foodDetails.today')
                : format(selectedDate, 'EEEE', { locale: dateFnsLocale })}
            </Text>
            <Text className="text-xs text-text-secondary">
              {format(selectedDate, 'MMMM d, yyyy', { locale: dateFnsLocale })}
            </Text>
          </View>
        </View>
        <Edit size={theme.iconSize.sm} color={theme.colors.text.secondary} />
      </Pressable>
    </View>
  );
}
