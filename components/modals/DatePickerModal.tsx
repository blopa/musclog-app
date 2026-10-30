import {
  addDays,
  addMonths,
  format,
  getMonth,
  getYear,
  isSameDay,
  isSameMonth,
  setMonth,
  setYear,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';

import { Button } from '@/components/theme/Button';
import { Modal } from '@/components/theme/Modal';
import { useTheme } from '@/hooks/useTheme';
import i18n, { DEFAULT_LANG, LanguageKeys, LOCALE_MAP } from '@/lang/lang';
import { localCalendarDayDate, utcDayKeyFromLocalDate } from '@/utils/calendarDate';
import { monthGridDays } from '@/utils/monthGrid';
import { useWebModalLayerStyle } from '@/utils/webPhoneFrame';

import { FullScreenModal } from './FullScreenModal';

type QuickDateOption = {
  label: string;
  date: Date;
};

/** How a day is marked in the grid: `tracked` is a filled circle, `fasted` a dashed ring. */
export type DatePickerDayStatus = 'tracked' | 'fasted';

type DatePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void | Promise<void>;
  minDate?: Date;
  maxDate?: Date;
  minYear?: number;
  maxYear?: number;
  quickDates?: QuickDateOption[];
  /**
   * Marks days in the grid. Called with the first and last day on screen (including the
   * neighbouring months' days) each time the modal opens or the month changes; the result is
   * keyed by `utcDayKeyFromLocalDate(day)`, and days absent from it are left unmarked.
   */
  loadDayStatuses?: (
    gridStart: Date,
    gridEnd: Date
  ) => Promise<ReadonlyMap<number, DatePickerDayStatus>>;
};

export function DatePickerModal({
  visible,
  onClose,
  selectedDate,
  onDateSelect,
  minDate,
  maxDate,
  minYear,
  maxYear,
  quickDates,
  loadDayStatuses,
}: DatePickerModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const webMonthYearLayerStyle = useWebModalLayerStyle({ variant: 'centered' });
  const [currentMonth, setCurrentMonth] = useState(selectedDate);
  const [tempSelectedDate, setTempSelectedDate] = useState(selectedDate);
  const [isMonthYearPickerVisible, setIsMonthYearPickerVisible] = useState(false);
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(getYear(currentMonth));
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(getMonth(currentMonth));

  const [dayStatuses, setDayStatuses] = useState<ReadonlyMap<number, DatePickerDayStatus>>(
    () => new Map()
  );

  const syncPickerState = () => {
    setCurrentMonth(selectedDate);
    setTempSelectedDate(selectedDate);
    setSelectedYear(getYear(selectedDate));
    setSelectedMonthIndex(getMonth(selectedDate));
  };

  const today = new Date();
  const currentLanguage = (i18n.language || DEFAULT_LANG) as LanguageKeys;
  const locale = LOCALE_MAP[currentLanguage] || LOCALE_MAP[DEFAULT_LANG];

  const days = monthGridDays(currentMonth).map((day) => day.date);
  const gridStartMs = days[0].getTime();
  const gridEndMs = days[days.length - 1].getTime();

  // Statuses are fetched per visible grid and kept while the next month loads, so the marks do
  // not flicker away on every month change. A failed read just leaves the grid unmarked.
  useEffect(() => {
    if (!visible || !loadDayStatuses) {
      return;
    }

    let cancelled = false;
    loadDayStatuses(new Date(gridStartMs), new Date(gridEndMs))
      .then((statuses) => {
        if (!cancelled) {
          setDayStatuses(statuses);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDayStatuses(new Map());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible, loadDayStatuses, gridStartMs, gridEndMs]);

  const dayMarkStyle = (status: DatePickerDayStatus): ViewStyle =>
    status === 'tracked'
      ? { backgroundColor: theme.colors.accent.primary10 }
      : { borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.colors.accent.primary };

  const statusLabels: Record<DatePickerDayStatus, string> = {
    tracked: t('datePicker.status.tracked'),
    fasted: t('datePicker.status.fasted'),
  };
  const statusOf = (day: Date): DatePickerDayStatus | undefined =>
    dayStatuses.get(utcDayKeyFromLocalDate(day));
  const legendStatuses = (['tracked', 'fasted'] as const).filter((status) =>
    days.some((day) => statusOf(day) === status)
  );
  const weekRefStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekDayLetters = Array.from({ length: 7 }, (_, i) =>
    format(addDays(weekRefStart, i), 'EEEEE', { locale })
  );

  const monthNames = Array.from({ length: 12 }, (_, i) => {
    const monthDate = setMonth(new Date(2024, 0, 1), i);
    return format(monthDate, 'MMMM', { locale });
  });

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDateSelect = (date: Date) => {
    if (!isDateSelectable(date)) {
      return;
    }

    setTempSelectedDate(date);
  };

  const handleConfirm = () => {
    setIsConfirmLoading(true);
    setTimeout(async () => {
      try {
        await onDateSelect(tempSelectedDate);
      } finally {
        setIsConfirmLoading(false);
        onClose();
      }
    }, 0);
  };

  const formatSelectedDate = (date: Date) => {
    const dayName = format(date, 'EEEE', { locale });
    const monthDay = format(date, 'MMM d', { locale });
    return `${dayName},\n${monthDay}`;
  };

  const isDateSelectable = (date: Date) => {
    if (minDate && date < localCalendarDayDate(minDate)) {
      return false;
    }

    if (maxDate && date > localCalendarDayDate(maxDate)) {
      return false;
    }

    return true;
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
  const years = Array.from({ length: maxYearToUse - minYearToUse + 1 }, (_, i) => maxYearToUse - i);

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      onShow={syncPickerState}
      title=""
      scrollable={false}
    >
      <View className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}
        >
          {/* Title Section */}
          <View className="px-4 pb-6 pt-2">
            <Text className="mb-1 text-sm font-semibold text-accent-primary">
              {t('datePicker.selectDate')}
            </Text>
            <Text
              className="font-bold leading-tight text-text-primary"
              style={{ fontSize: theme.typography.fontSize['4xl'] }}
            >
              {formatSelectedDate(tempSelectedDate)}
            </Text>
          </View>

          {/* Calendar */}
          <View className="px-4">
            <View
              className="rounded-card border bg-bg-cardDark p-5"
              style={{ borderColor: theme.colors.background.ink5 }}
            >
              {/* Month Navigation */}
              <View className="mb-6 flex-row items-center justify-between px-1">
                <Pressable
                  className="flex-row items-center gap-1 rounded-control px-2 py-1"
                  onPress={handleMonthYearPickerOpen}
                >
                  <Text className="text-base font-semibold text-text-primary">
                    {format(currentMonth, 'MMMM yyyy', { locale })}
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
                {weekDayLetters.map((day, index) => (
                  <View key={index} className="flex-1">
                    <Text className="text-center text-xs font-semibold text-text-secondary">
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
                  const isDisabled = !isDateSelectable(day);
                  const status = statusOf(day);

                  return (
                    <Pressable
                      key={index}
                      className="h-10 items-center justify-center"
                      style={{ width: '14.28%' }}
                      disabled={isDisabled}
                      accessibilityLabel={
                        status
                          ? `${format(day, 'PPPP', { locale })}, ${statusLabels[status]}`
                          : undefined
                      }
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
                            className="relative z-10 text-sm font-semibold"
                            style={{
                              color: isDisabled
                                ? theme.colors.text.secondary
                                : theme.colors.text.onAccent,
                            }}
                          >
                            {format(day, 'd')}
                          </Text>
                        </View>
                      ) : (
                        <View
                          className={`h-10 w-10 items-center justify-center rounded-full ${
                            isToday && !status ? 'border border-accent-primary' : ''
                          }`}
                          style={status ? dayMarkStyle(status) : undefined}
                        >
                          <Text
                            className={`text-sm ${
                              status || isToday ? 'font-semibold' : 'font-medium'
                            } ${
                              isOtherMonth || isDisabled
                                ? 'text-text-secondary'
                                : 'text-text-primary'
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

              {/* Legend: only the marks that actually appear on screen */}
              {legendStatuses.length > 0 ? (
                <View
                  className="mt-4 flex-row flex-wrap items-center justify-center"
                  style={{ gap: theme.spacing.gap.lg }}
                >
                  {legendStatuses.map((status) => (
                    <View key={status} className="flex-row items-center gap-2">
                      <View className="h-4 w-4 rounded-full" style={dayMarkStyle(status)} />
                      <Text className="text-xs font-medium text-text-secondary">
                        {statusLabels[status]}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Quick Date Buttons */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-6 pb-2"
              contentContainerStyle={{ gap: theme.spacing.gap.md }}
            >
              {(
                quickDates ?? [
                  {
                    label: t('datePicker.yesterday'),
                    date: localCalendarDayDate(subDays(new Date(), 1)),
                  },
                  { label: t('datePicker.today'), date: localCalendarDayDate(new Date()) },
                  {
                    label: t('datePicker.tomorrow'),
                    date: localCalendarDayDate(addDays(new Date(), 1)),
                  },
                ]
              ).map((option, index) => {
                const isQuickPickActive = isSameDay(tempSelectedDate, option.date);
                const isDisabled = !isDateSelectable(option.date);
                return (
                  <Button
                    key={index}
                    label={option.label}
                    variant={isQuickPickActive ? 'accent' : 'secondary'}
                    size="sm"
                    width="auto"
                    disabled={isDisabled}
                    onPress={() => {
                      if (isDisabled) {
                        return;
                      }

                      setTempSelectedDate(option.date);
                      setCurrentMonth(startOfMonth(option.date));
                    }}
                  />
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>

        {/* Footer */}
        <View className="p-6 pt-4" pointerEvents="auto">
          <View
            className="mb-6 h-px"
            style={{
              backgroundColor: theme.colors.background.ink10,
            }}
          />
          <View className="flex-row items-center gap-4" pointerEvents="auto">
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
              loading={isConfirmLoading}
              disabled={isConfirmLoading || !isDateSelectable(tempSelectedDate)}
              onPress={handleConfirm}
            />
          </View>
        </View>
      </View>

      {/* Month/Year Picker Modal */}
      {isMonthYearPickerVisible ? (
        <Modal
          visible={isMonthYearPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsMonthYearPickerVisible(false)}
          statusBarTranslucent={Platform.OS !== 'web'}
        >
          <Pressable
            className="flex-1 items-center justify-center p-4"
            style={[{ backgroundColor: theme.colors.overlay.scrim60 }, webMonthYearLayerStyle]}
            onPress={() => setIsMonthYearPickerVisible(false)}
          >
            <Pressable
              className="w-full max-w-sm rounded-card border bg-bg-cardDark p-6"
              style={{ borderColor: theme.colors.background.ink10 }}
              onPress={(e) => e.stopPropagation()}
            >
              <Text className="mb-4 text-lg font-semibold text-text-primary">
                {t('datePicker.selectMonthYear')}
              </Text>

              {/* Month Grid */}
              <View className="mb-6">
                <Text className="mb-3 text-sm font-semibold text-text-secondary">
                  {t('datePicker.month')}
                </Text>
                <View className="flex-row flex-wrap" style={{ gap: theme.spacing.gap.sm }}>
                  {monthNames.map((month, index) => (
                    <Pressable
                      key={index}
                      className={`flex-1 rounded-control border px-3 py-2 ${
                        selectedMonthIndex === index
                          ? 'border-accent-primary bg-accent-primary/10'
                          : ''
                      }`}
                      style={{
                        borderColor:
                          selectedMonthIndex === index
                            ? theme.colors.accent.primary
                            : theme.colors.background.ink10,
                        backgroundColor:
                          selectedMonthIndex === index
                            ? theme.colors.accent.primary10
                            : theme.colors.background.ink5,
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
                <Text className="mb-3 text-sm font-semibold text-text-secondary">
                  {t('datePicker.year')}
                </Text>
                <ScrollView
                  className="max-h-48 rounded-control border"
                  style={{
                    borderColor: theme.colors.background.ink10,
                    backgroundColor: theme.colors.background.ink5,
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
                        borderBottomColor: theme.colors.background.ink5,
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
      ) : null}
    </FullScreenModal>
  );
}
