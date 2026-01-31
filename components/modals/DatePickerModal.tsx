import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal } from 'react-native';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react-native';
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
  setMonth,
  setYear,
  getYear,
  getMonth,
} from 'date-fns';
import { useTranslation } from 'react-i18next';
import i18n, { LOCALE_MAP, LanguageKeys } from '../../lang/lang';
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { Button } from '../theme/Button';

type DatePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  minYear?: number;
  maxYear?: number;
};

export function DatePickerModal({
  visible,
  onClose,
  selectedDate,
  onDateSelect,
  minYear,
  maxYear,
}: DatePickerModalProps) {
  const { t } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(selectedDate);
  const [tempSelectedDate, setTempSelectedDate] = useState(selectedDate);
  const [isMonthYearPickerVisible, setIsMonthYearPickerVisible] = useState(false);
  const [selectedYear, setSelectedYear] = useState(getYear(currentMonth));
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(getMonth(currentMonth));

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

  const handleMonthYearSelect = () => {
    const newDate = setYear(setMonth(new Date(), selectedMonthIndex), selectedYear);
    setCurrentMonth(startOfMonth(newDate));
    setIsMonthYearPickerVisible(false);
  };

  const handleMonthYearPickerOpen = () => {
    setSelectedYear(getYear(currentMonth));
    setSelectedMonthIndex(getMonth(currentMonth));
    setIsMonthYearPickerVisible(true);
  };

  // Generate years based on props or default to current year ± 10 years
  const currentYear = getYear(new Date());
  const defaultMinYear = currentYear - 10;
  const defaultMaxYear = currentYear + 10;
  const minYearToUse = minYear ?? defaultMinYear;
  const maxYearToUse = maxYear ?? defaultMaxYear;
  const years = Array.from({ length: maxYearToUse - minYearToUse + 1 }, (_, i) => minYearToUse + i);

  // Generate month names using date-fns format with locale support
  const currentLanguage = (i18n.language || 'en-US') as LanguageKeys;
  const locale = LOCALE_MAP[currentLanguage] || LOCALE_MAP['en-US'];
  const monthNames = Array.from({ length: 12 }, (_, i) => {
    const monthDate = setMonth(new Date(2024, 0, 1), i);
    return format(monthDate, 'MMMM', { locale });
  });

  return (
    <FullScreenModal visible={visible} onClose={onClose} title="" scrollable={false}>
      <View className="flex-1">
        {/* Title Section */}
        <View className="px-6 pb-6 pt-2">
          <Text className="mb-1 text-sm font-semibold uppercase tracking-wider text-accent-primary">
            {t('datePicker.selectDate')}
          </Text>
          <Text
            className="font-bold leading-tight tracking-tight text-text-primary"
            style={{ fontSize: theme.typography.fontSize['4xl'] }}
          >
            {formatSelectedDate(tempSelectedDate)}
          </Text>
        </View>

        {/* Calendar */}
        <View className="flex-1 px-4">
          <View
            className="rounded-2xl border bg-bg-cardDark p-5"
            style={{ borderColor: theme.colors.background.white5 }}
          >
            {/* Month Navigation */}
            <View className="mb-6 flex-row items-center justify-between px-1">
              <Pressable
                className="flex-row items-center gap-1 rounded-lg px-2 py-1"
                onPress={handleMonthYearPickerOpen}
              >
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
                    className="h-10 items-center justify-center"
                    style={{ width: '14.28%' }}
                    onPress={() => handleDateSelect(day)}
                  >
                    {isSelected ? (
                      <View className="relative h-10 w-10 items-center justify-center">
                        <View
                          className="absolute inset-0 rounded-full"
                          style={{
                            backgroundColor: theme.colors.accent.primary,
                            shadowColor: theme.colors.accent.primary,
                            shadowOffset: theme.shadowOffset.lg,
                            shadowOpacity: theme.shadowOpacity.medium,
                            shadowRadius: theme.shadowRadius.md,
                            elevation: theme.elevation.xl,
                          }}
                        />
                        <Text
                          className="relative z-10 text-sm font-bold"
                          style={{ color: theme.colors.text.black }}
                        >
                          {format(day, 'd')}
                        </Text>
                      </View>
                    ) : (
                      <View
                        className={`h-10 w-10 items-center justify-center rounded-full ${
                          isToday ? 'border border-accent-primary' : ''
                        }`}
                      >
                        <Text
                          className={`text-sm font-medium ${
                            isOtherMonth ? 'text-text-secondary' : 'text-text-primary'
                          }`}
                        >
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
            contentContainerStyle={{ gap: theme.spacing.gap.md }}
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
          <View
            className="mb-6 h-px"
            style={{
              backgroundColor: theme.colors.background.white10,
            }}
          />
          <View className="flex-row items-center gap-4">
            <Button
              label={t('datePicker.cancel')}
              variant="outline"
              size="sm"
              width="flex-1"
              onPress={onClose}
            />
            <Button
              label={t('datePicker.confirm')}
              variant="gradientCta"
              size="sm"
              width="flex-1"
              onPress={handleConfirm}
            />
          </View>
        </View>
      </View>

      {/* Month/Year Picker Modal */}
      <Modal
        visible={isMonthYearPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMonthYearPickerVisible(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center p-4"
          style={{ backgroundColor: theme.colors.overlay.black60 }}
          onPress={() => setIsMonthYearPickerVisible(false)}
        >
          <Pressable
            className="w-full max-w-sm rounded-2xl border bg-bg-cardDark p-6"
            style={{ borderColor: theme.colors.background.white10 }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="mb-4 text-lg font-bold text-text-primary">
              {t('datePicker.selectMonthYear')}
            </Text>

            {/* Month Grid */}
            <View className="mb-6">
              <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-secondary">
                {t('datePicker.month')}
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: theme.spacing.gap.sm }}>
                {monthNames.map((month, index) => (
                  <Pressable
                    key={index}
                    className={`flex-1 rounded-lg border px-3 py-2 ${
                      selectedMonthIndex === index
                        ? 'border-accent-primary bg-accent-primary/10'
                        : ''
                    }`}
                    style={{
                      borderColor:
                        selectedMonthIndex === index
                          ? theme.colors.accent.primary
                          : theme.colors.background.white10,
                      backgroundColor:
                        selectedMonthIndex === index
                          ? theme.colors.accent.primary10
                          : theme.colors.background.white5,
                      minWidth: '30%',
                      maxWidth: '30%',
                    }}
                    onPress={() => setSelectedMonthIndex(index)}
                  >
                    <Text
                      className={`text-center text-sm font-medium ${
                        selectedMonthIndex === index ? 'text-accent-primary' : 'text-text-primary'
                      }`}
                    >
                      {month.substring(0, 3)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Year List */}
            <View>
              <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-secondary">
                {t('datePicker.year')}
              </Text>
              <ScrollView
                className="max-h-48 rounded-lg border"
                style={{
                  borderColor: theme.colors.background.white10,
                  backgroundColor: theme.colors.background.white5,
                }}
                showsVerticalScrollIndicator={false}
              >
                {years.map((year) => (
                  <Pressable
                    key={year}
                    className={`border-b px-4 py-3 ${
                      selectedYear === year ? 'bg-accent-primary/10' : ''
                    }`}
                    style={{
                      borderBottomColor: theme.colors.background.white5,
                    }}
                    onPress={() => setSelectedYear(year)}
                  >
                    <Text
                      className={`text-base font-medium ${
                        selectedYear === year ? 'text-accent-primary' : 'text-text-primary'
                      }`}
                    >
                      {year}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Footer Buttons */}
            <View className="mt-6 flex-row items-stretch gap-3">
              <Button
                label={t('datePicker.cancel')}
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={() => setIsMonthYearPickerVisible(false)}
              />
              <Button
                label={t('datePicker.confirm')}
                variant="gradientCta"
                size="sm"
                width="flex-1"
                onPress={handleMonthYearSelect}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </FullScreenModal>
  );
}
