import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FilterTabs } from '../FilterTabs';
import { ToggleInput } from '../theme/ToggleInput';
import { DateRangePreset } from '../../hooks/useProgressData';

interface ProgressDateFilterProps {
  activePreset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
  useWeeklyAverages: boolean;
  onToggleWeeklyAverages: (value: boolean) => void;
}

export function ProgressDateFilter({
  activePreset,
  onPresetChange,
  useWeeklyAverages,
  onToggleWeeklyAverages,
}: ProgressDateFilterProps) {
  const { t } = useTranslation();

  const presets = [
    { label: '7D', id: '7d' },
    { label: '30D', id: '30d' },
    { label: '90D', id: '90d' },
    { label: '6M', id: '6m' },
    { label: '1Y', id: '1y' },
    { label: 'ALL', id: 'all' },
  ];

  return (
    <View className="mb-4 px-4">
      <FilterTabs
        tabs={presets}
        activeTab={activePreset}
        onTabChange={(id) => onPresetChange(id as DateRangePreset)}
        containerClassName="mb-4"
        showContainer={true}
        scrollViewContentContainerStyle={{ paddingHorizontal: 0 }}
      />

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
    </View>
  );
}
