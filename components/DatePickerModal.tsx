import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addDays,
  startOfWeek,
  endOfWeek,
  nextMonday,
} from 'date-fns';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { FullScreenModal } from './FullScreenModal';
import { Button } from './theme/Button';

type DatePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
};

export function DatePickerModal({
  visible,
  onClose,
  selectedDate,
  onDateSelect,
}: DatePickerModalProps) {
  const { t } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(selectedDate);
  const [tempSelectedDate, setTempSelectedDate] = useState(selectedDate);

  const today = new Date();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday = 0
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDateSelect = (date: Date) => {
    setTempSelectedDate(date);
  };

  const handleConfirm = () => {
    onDateSelect(tempSelectedDate);
    onClose();
  };

  const handleQuickDate = (type: 'today' | 'tomorrow' | 'nextMonday') => {
    let date: Date;
    switch (type) {
      case 'today':
        date = new Date();
        break;
      case 'tomorrow':
        date = addDays(new Date(), 1);
        break;
      case 'nextMonday':
        date = nextMonday(new Date());
        break;
    }
    setTempSelectedDate(date);
    setCurrentMonth(startOfMonth(date));
  };

  const formatSelectedDate = (date: Date) => {
    const dayName = format(date, 'EEEE', { weekStartsOn: 0 });
    const monthDay = format(date, 'MMM d');
    return `${dayName},\n${monthDay}`;
  };

  return (
    <FullScreenModal visible={visible} onClose={onClose} title="" scrollable={false}>
      <View className="flex-1">
        {/* Title Section */}
        <View className="px-6 pb-6 pt-2">
          <Text className="mb-1 text-sm font-semibold uppercase tracking-wider text-accent-primary">
            {t('datePicker.selectDate')}
          </Text>
          <Text className="text-[40px] font-bold leading-tight tracking-tight text-text-primary">
            {formatSelectedDate(tempSelectedDate)}
          </Text>
        </View>

        {/* Calendar */}
        <View className="flex-1 px-4">
          <View className="rounded-2xl border border-white/5 bg-bg-cardDark p-5">
            {/* Month Navigation */}
            <View className="mb-6 flex-row items-center justify-between px-1">
              <Pressable className="flex-row items-center gap-1 rounded-lg px-2 py-1">
                <Text className="text-base font-semibold text-text-primary">
                  {format(currentMonth, 'MMMM yyyy')}
                </Text>
                <ChevronDown size={theme.iconSize.sm} color={theme.colors.text.secondary} />
              </Pressable>
              <View className="flex-row items-center gap-1">
                <Pressable className="rounded-full p-1" onPress={handlePreviousMonth}>
                  <ChevronLeft size={theme.iconSize.md} color={theme.colors.text.secondary} />
                </Pressable>
                <Pressable className="rounded-full p-1" onPress={handleNextMonth}>
                  <ChevronRight size={theme.iconSize.md} color={theme.colors.text.secondary} />
                </Pressable>
              </View>
            </View>

            {/* Week Days Header */}
            <View className="mb-4 flex-row">
              {weekDays.map((day, index) => (
                <View key={index} className="flex-1">
                  <Text className="text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    {day}
                  </Text>
                </View>
              ))}
            </View>

            {/* Calendar Grid */}
            <View className="flex-row flex-wrap">
              {days.map((day, index) => {
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, today);
                const isSelected = isSameDay(day, tempSelectedDate);
                const isOtherMonth = !isCurrentMonth;

                return (
                  <Pressable
                    key={index}
                    className="h-10 w-[14.28%] items-center justify-center"
                    onPress={() => handleDateSelect(day)}>
                    {isSelected ? (
                      <View className="relative h-10 w-10 items-center justify-center">
                        <View
                          className="absolute inset-0 rounded-full"
                          style={{
                            backgroundColor: theme.colors.accent.primary,
                            shadowColor: theme.colors.accent.primary,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 8,
                          }}
                        />
                        <Text
                          className="relative z-10 text-sm font-bold"
                          style={{ color: theme.colors.text.black }}>
                          {format(day, 'd')}
                        </Text>
                      </View>
                    ) : (
                      <View
                        className={`h-10 w-10 items-center justify-center rounded-full ${
                          isToday ? 'border border-accent-primary' : ''
                        }`}>
                        <Text
                          className={`text-sm font-medium ${
                            isOtherMonth ? 'text-text-secondary' : 'text-text-primary'
                          }`}>
                          {format(day, 'd')}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Quick Date Buttons */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-6 pb-2"
            contentContainerStyle={{ gap: 12 }}
          >
            <Button
              label={t('datePicker.today')}
              variant="secondary"
              size="sm"
              width="auto"
              onPress={() => handleQuickDate('today')}
            />
            <Button
              label={t('datePicker.tomorrow')}
              variant="secondary"
              size="sm"
              width="auto"
              onPress={() => handleQuickDate('tomorrow')}
            />
            <Button
              label={t('datePicker.nextMonday')}
              variant="secondary"
              size="sm"
              width="auto"
              onPress={() => handleQuickDate('nextMonday')}
            />
          </ScrollView>
        </View>

        {/* Footer */}
        <View className="p-6 pt-4">
          <View className="mb-6 h-px bg-white/10" />
          <View className="flex-row items-center gap-4">
            <Button
              label={t('datePicker.cancel')}
              variant="outline"
              size="lg"
              width="flex-1"
              onPress={onClose}
            />
            <Pressable
              className="relative flex-1 overflow-hidden rounded-xl"
              onPress={handleConfirm}
              style={{
                height: 56,
                shadowColor: '#6366f1',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }}>
              <LinearGradient
                colors={['#6366f1', '#29e08e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="absolute inset-0"
              />
              <View className="flex h-full items-center justify-center">
                <Text className="text-base font-bold tracking-wide text-text-primary">
                  {t('datePicker.confirm')}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </FullScreenModal>
  );
}
