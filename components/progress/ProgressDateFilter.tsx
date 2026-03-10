import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../hooks/useTheme';
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
  const theme = useTheme();

  const presets: { label: string; value: DateRangePreset }[] = [
    { label: '7D', value: '7d' },
    { label: '30D', value: '30d' },
    { label: '90D', value: '90d' },
    { label: '6M', value: '6m' },
    { label: '1Y', value: '1y' },
    { label: 'ALL', value: 'all' },
  ];

  return (
    <View className="mb-4">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        className="mb-4"
      >
        <View className="flex-row items-center gap-2">
          {presets.map((preset) => (
            <TouchableOpacity
              key={preset.value}
              onPress={() => onPresetChange(preset.value)}
              className={`rounded-full px-4 py-2 ${
                activePreset === preset.value ? 'bg-accent-primary' : 'bg-background-card'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  activePreset === preset.value ? 'text-white' : 'text-text-secondary'
                }`}
              >
                {preset.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View className="flex-row items-center justify-between px-4">
        <Text className="text-sm font-medium text-text-primary">
          {t('progress.weeklyAverages')}
        </Text>
        <TouchableOpacity
          onPress={() => onToggleWeeklyAverages(!useWeeklyAverages)}
          className={`h-6 w-12 rounded-full p-1 ${
            useWeeklyAverages ? 'bg-accent-primary' : 'bg-background-tertiary'
          }`}
        >
          <View
            className={`h-4 w-4 rounded-full bg-white ${
              useWeeklyAverages ? 'self-end' : 'self-start'
            }`}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
