import { format } from 'date-fns';
import { Calendar } from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { DateRangePreset } from '../../hooks/useProgressData';
import { useTheme } from '../../hooks/useTheme';
import { FilterTabs } from '../FilterTabs';
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
  const theme = useTheme();

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const [tempStartDate, setTempStartDate] = useState(appliedRange?.startDate || new Date());
  const [tempEndDate, setTempEndDate] = useState(appliedRange?.endDate || new Date());
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
    setTempStartDate(date);
    if (date > tempEndDate) {
      setTempEndDate(date);
    }
  };

  const handleEndDateSelect = (date: Date) => {
    setTempEndDate(date);
    if (date < tempStartDate) {
      setTempStartDate(date);
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

      {showCustomUI && (
        <View className="mb-4">
          <View className="mb-3 flex-row items-center gap-3">
            <Pressable
              onPress={() => setShowStartDatePicker(true)}
              className="flex-1 flex-row items-center justify-between rounded-xl border border-border-light bg-bg-cardDark px-4 py-3"
            >
              <View>
                <Text className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                  {t('progress.startDate')}
                </Text>
                <Text className="text-sm font-semibold text-text-primary">
                  {format(tempStartDate, 'MMM d, yyyy')}
                </Text>
              </View>
              <Calendar size={16} color={theme.colors.text.tertiary} />
            </Pressable>

            <Pressable
              onPress={() => setShowEndDatePicker(true)}
              className="flex-1 flex-row items-center justify-between rounded-xl border border-border-light bg-bg-cardDark px-4 py-3"
            >
              <View>
                <Text className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                  {t('progress.endDate')}
                </Text>
                <Text className="text-sm font-semibold text-text-primary">
                  {format(tempEndDate, 'MMM d, yyyy')}
                </Text>
              </View>
              <Calendar size={16} color={theme.colors.text.tertiary} />
            </Pressable>
          </View>
          <Button
            label={t('progress.apply')}
            onPress={handleApply}
            size="sm"
            variant="gradientCta"
            width="full"
          />
        </View>
      )}

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
