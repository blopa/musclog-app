import { format, isToday, isYesterday } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import i18n, { LanguageKeys, LOCALE_MAP } from '../lang/lang';
import { theme } from '../theme';
import { DatePickerModal } from './modals/DatePickerModal';

type DateNavigatorProps = {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
};

export function DateNavigator({ selectedDate, onDateChange }: DateNavigatorProps) {
  const { t } = useTranslation();
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);

  const currentLanguage = (i18n.language || 'en-US') as LanguageKeys;
  const locale = LOCALE_MAP[currentLanguage] || LOCALE_MAP['en-US'];

  const getDisplayLabel = () => {
    if (isToday(selectedDate)) {
      return t('datePicker.today');
    }
    if (isYesterday(selectedDate)) {
      return t('datePicker.yesterday');
    }
    return format(selectedDate, 'MMM d, yyyy', { locale });
  };

  const goToPreviousDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    onDateChange(prev);
  };

  const goToNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    onDateChange(next);
  };

  return (
    <>
      <View className="flex-row items-center justify-between px-4 py-4">
        <Pressable
          onPress={goToPreviousDay}
          className="rounded-lg p-3 active:bg-bg-secondary"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <ChevronLeft size={theme.iconSize.md} color={theme.colors.text.primary} />
        </Pressable>

        <Pressable
          onPress={() => setIsDatePickerVisible(true)}
          className="flex-row items-center gap-2"
        >
          <Text className="text-xl font-semibold text-text-primary">{getDisplayLabel()}</Text>
          <Calendar size={theme.iconSize.sm} color={theme.colors.accent.secondary} />
        </Pressable>

        <Pressable
          onPress={goToNextDay}
          className="rounded-lg p-3 active:bg-bg-secondary"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <ChevronRight size={theme.iconSize.md} color={theme.colors.text.primary} />
        </Pressable>
      </View>

      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        selectedDate={selectedDate}
        onDateSelect={onDateChange}
      />
    </>
  );
}
