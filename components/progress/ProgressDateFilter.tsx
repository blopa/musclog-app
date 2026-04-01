import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DateRangePreset } from '../../hooks/useProgressData';
import { localCalendarDayDate } from '../../utils/calendarDate';
import { FilterTabs } from '../FilterTabs';
import { DatePickerInput } from '../modals/DatePickerInput';
import { DatePickerModal } from '../modals/DatePickerModal';
import { Button } from '../theme/Button';
import { ToggleInput } from '../theme/ToggleInput';

interface ProgressDateFilterProps {
  activePreset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
  appliedRange: { startDate: Date; endDate: Date } | null;
  onApplyCustomRange: (start: Date, end: Date) => void;
  useWeeklyAverages: boolean;
  onToggleWeeklyAverages: (value: boolean) => void;
}

export function ProgressDateFilter({
  activePreset,
  appliedRange,
  onPresetChange,
  onApplyCustomRange,
  useWeeklyAverages,
  onToggleWeeklyAverages,
}: ProgressDateFilterProps) {
  const { t } = useTranslation();

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const [tempStartDate, setTempStartDate] = useState(() =>
    localCalendarDayDate(appliedRange?.startDate || new Date())
  );
  const [tempEndDate, setTempEndDate] = useState(() =>
    localCalendarDayDate(appliedRange?.endDate || new Date())
  );
  const [showCustomUI, setShowCustomUI] = useState(activePreset === 'custom');

  const presets = [
    { label: '7D', id: '7d' },
    { label: '30D', id: '30d' },
    { label: '90D', id: '90d' },
    { label: '6M', id: '6m' },
    { label: '1Y', id: '1y' },
    { label: 'ALL', id: 'all' },
    { label: t('progress.custom'), id: 'custom' },
  ];

  const handleStartDateSelect = (date: Date) => {
    const d = localCalendarDayDate(date);
    setTempStartDate(d);
    if (d > tempEndDate) {
      setTempEndDate(d);
    }
  };

  const handleEndDateSelect = (date: Date) => {
    const d = localCalendarDayDate(date);
    setTempEndDate(d);
    if (d < tempStartDate) {
      setTempStartDate(d);
    }
  };

  const handleApply = () => {
    onApplyCustomRange(tempStartDate, tempEndDate);
    setShowCustomUI(true);
  };

  return (
    <View className="mb-4 px-4">
      <FilterTabs
        tabs={presets}
        activeTab={showCustomUI ? 'custom' : activePreset}
        onTabChange={(id) => {
          if (id === 'custom') {
            setShowCustomUI(true);
          } else {
            setShowCustomUI(false);
            onPresetChange(id as DateRangePreset);
          }
        }}
        containerClassName="mb-4"
        showContainer={true}
        scrollViewContentContainerStyle={{ paddingHorizontal: 0 }}
      />

      {showCustomUI ? (
        <View className="mb-4">
          <View className="mb-3 flex-row items-stretch gap-3">
            <View className="min-w-0 flex-1">
              <DatePickerInput
                className="flex-1"
                label={t('progress.startDate')}
                selectedDate={tempStartDate}
                onPress={() => setShowStartDatePicker(true)}
                variant="compact"
              />
            </View>
            <View className="min-w-0 flex-1">
              <DatePickerInput
                className="flex-1"
                label={t('progress.endDate')}
                selectedDate={tempEndDate}
                onPress={() => setShowEndDatePicker(true)}
                variant="compact"
              />
            </View>
          </View>
          <Button
            label={t('progress.apply')}
            onPress={handleApply}
            size="xs"
            variant="gradientCta"
            width="full"
          />
        </View>
      ) : null}

      <ToggleInput
        items={[
          {
            key: 'weeklyAverages',
            label: t('progress.weeklyAverages'),
            value: useWeeklyAverages,
            onValueChange: onToggleWeeklyAverages,
          },
        ]}
      />

      <DatePickerModal
        visible={showStartDatePicker}
        onClose={() => setShowStartDatePicker(false)}
        selectedDate={tempStartDate}
        onDateSelect={handleStartDateSelect}
      />

      <DatePickerModal
        visible={showEndDatePicker}
        onClose={() => setShowEndDatePicker(false)}
        selectedDate={tempEndDate}
        onDateSelect={handleEndDateSelect}
      />
    </View>
  );
}
