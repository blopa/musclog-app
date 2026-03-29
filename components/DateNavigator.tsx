import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { theme } from '../theme'; // TODO: figure out a way to use useTheme instead or dynamically use dark or light theme based on configuration
import { DatePickerInput } from './modals/DatePickerInput';
import { DatePickerModal } from './modals/DatePickerModal';

type DateNavigatorProps = {
  selectedDate: Date;
  onDateChange: (date: Date) => void | Promise<void>;
};

export function DateNavigator({ selectedDate, onDateChange }: DateNavigatorProps) {
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);

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

        <DatePickerInput
          variant="inlineNav"
          selectedDate={selectedDate}
          onPress={() => setIsDatePickerVisible(true)}
        />

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
