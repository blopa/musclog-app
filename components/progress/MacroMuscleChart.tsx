import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { MacroMusclePoint, TimeAggregation } from '../../database/services/ProgressService';
import { useFormatAppNumber } from '../../hooks/useFormatAppNumber';
import { useTheme } from '../../hooks/useTheme';
import { getXAxisLabels, getYAxisLabels } from '../../utils/chartUtils';
import { getMuscleGroupTranslationKey } from '../../utils/exerciseTranslation';
import { AreaChart } from '../charts/AreaChart';
import { ProgressChartSection } from './ProgressChartSection';

interface MacroMuscleChartProps {
  allData: Record<TimeAggregation, MacroMusclePoint[]>;
  units: string;
}

const formatDate = (timestamp: number): string => {
  const d = new Date(timestamp);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function MacroMuscleChart({ allData, units }: MacroMuscleChartProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  const [aggregation, setAggregation] = useState<TimeAggregation>('daily');
  const data = (allData && allData[aggregation]) || [];
  const weightLabel = units === 'imperial' ? 'lbs' : 'kg';

  if (!data || data.length === 0) {
    return (
      <ProgressChartSection title={t('progress.correlationView.macroMuscle')}>
        <View className="mb-4 flex-row items-center gap-2">
          {(['daily', 'weekly', 'monthly'] as TimeAggregation[]).map((agg) => (
            <TouchableOpacity
              key={agg}
              onPress={() => setAggregation(agg)}
              className={`rounded-full px-3 py-1.5 ${
                aggregation === agg ? 'bg-accent-primary' : 'bg-background-tertiary'
              }`}
            >
              <Text
                className={`text-xs font-bold ${aggregation === agg ? 'text-white' : 'text-text-tertiary'}`}
              >
                {t(`common.time.${agg}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View className="items-center justify-center py-10">
          <Text className="text-sm text-text-tertiary">{t('progress.noDataAvailable')}</Text>
        </View>
      </ProgressChartSection>
    );
  }

  const xAxisLabels = getXAxisLabels(
    data.map((d) => ({ x: d.date })),
    formatDate
  );

  const maxY = Math.max(...data.map((d) => d.protein + d.carbs + d.fat), 1) * 1.1;
  const yAxisLabels = getYAxisLabels(0, maxY, 3, (v) => `${formatInteger(Math.round(v))}g`);
  const macroSeries = [
    { key: 'protein', label: t('nutrition.protein'), color: theme.colors.macros.protein.bg },
    { key: 'carbs', label: t('nutrition.carbs'), color: theme.colors.macros.carbs.bg },
    { key: 'fat', label: t('nutrition.fat'), color: theme.colors.macros.fat.bg },
  ];

  const muscleGroups = Array.from(
    new Set(data.flatMap((d) => Object.keys(d.muscleGroupVolume)))
  ).slice(0, 3);

  return (
    <ProgressChartSection title={t('progress.correlationView.macroMuscle')}>
      <View className="mb-4 flex-row items-center gap-2">
        {(['daily', 'weekly', 'monthly'] as TimeAggregation[]).map((agg) => (
          <TouchableOpacity
            key={agg}
            onPress={() => setAggregation(agg)}
            className={`rounded-full px-3 py-1.5 ${
              aggregation === agg ? 'bg-accent-primary' : 'bg-background-tertiary'
            }`}
          >
            <Text
              className={`text-xs font-bold ${aggregation === agg ? 'text-white' : 'text-text-tertiary'}`}
            >
              {t(`common.time.${agg}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View>
        <AreaChart
          data={data.map((d) => ({
            x: d.date,
            protein: d.protein,
            carbs: d.carbs,
            fat: d.fat,
          }))}
          series={macroSeries}
          height={200}
          xAxisLabels={xAxisLabels}
          yAxisLabels={yAxisLabels}
          yDomain={[0, maxY]}
        />
        <View className="mt-4 px-2">
          <Text className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
            {t('progress.muscleGroupVolumeOverlay')}
          </Text>
          <View className="flex-row flex-wrap gap-4">
            {muscleGroups.map((mg, i) => {
              const maxVol = Math.max(...data.map((d) => d.muscleGroupVolume[mg] || 0));
              return (
                <View key={mg} className="flex-row items-center gap-2">
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: [
                        theme.colors.accent.primary,
                        theme.colors.accent.secondary,
                        theme.colors.accent.tertiary,
                      ][i % 3],
                    }}
                  />
                  <Text className="text-[10px] text-text-secondary">
                    {t(getMuscleGroupTranslationKey(mg))}: {Math.round(maxVol)} {weightLabel}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </ProgressChartSection>
  );
}
