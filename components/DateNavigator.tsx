import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { localCalendarDayDate, localCalendarDayPlusDays } from '@/utils/calendarDate';

import { DatePickerInput } from './modals/DatePickerInput';
import { type DatePickerDayStatus, DatePickerModal } from './modals/DatePickerModal';

type DateNavigatorProps = {
  selectedDate: Date;
  onDateChange: (date: Date) => void | Promise<void>;
  /** Drops the outer padding, for the `center` slot of `ScreenHeader`, which pads itself. */
  compact?: boolean;
  /** Marks days in the picker; see `DatePickerModal`. Keep the reference stable. */
  loadDayStatuses?: (
    gridStart: Date,
    gridEnd: Date
  ) => Promise<ReadonlyMap<number, DatePickerDayStatus>>;
};

export function DateNavigator({
  selectedDate,
  onDateChange,
  compact = false,
  loadDayStatuses,
}: DateNavigatorProps) {
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const theme = useTheme();

  const goToPreviousDay = () => {
    onDateChange(localCalendarDayPlusDays(selectedDate, -1));
  };

  const goToNextDay = () => {
    onDateChange(localCalendarDayPlusDays(selectedDate, 1));
  };

  return (
    <>
      <View className={`flex-row items-center justify-between ${compact ? '' : 'px-4 py-4'}`}>
        <Pressable
          onPress={goToPreviousDay}
          className="rounded-control p-3 active:bg-bg-secondary"
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
          className="rounded-control p-3 active:bg-bg-secondary"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <ChevronRight size={theme.iconSize.md} color={theme.colors.text.primary} />
        </Pressable>
      </View>

      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        selectedDate={selectedDate}
        loadDayStatuses={loadDayStatuses}
        onDateSelect={(date) => {
          void onDateChange(localCalendarDayDate(date));
        }}
      />
    </>
  );
}
