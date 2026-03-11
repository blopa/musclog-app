import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { MenstrualPhasePoint, TimeAggregation } from '../../database/services/ProgressService';
import { useTheme } from '../../hooks/useTheme';
import { MultipleLinesChart } from '../charts/MultipleLinesChart';
import { ProgressChartSection } from './ProgressChartSection';

interface MenstrualPerformanceChartProps {
  data: MenstrualPhasePoint[];
  aggregation: TimeAggregation;
  onAggregationChange: (agg: TimeAggregation) => void;
}

const MAX_X_LABELS = 8;
const formatDate = (timestamp: number): string => {
  const d = new Date(timestamp);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getXAxisLabels = (dates: number[]): string[] => {
  if (dates.length === 0) return [];
  if (dates.length <= MAX_X_LABELS) return dates.map(formatDate);
  const indices = Array.from({ length: MAX_X_LABELS }, (_, i) =>
    Math.round((i / (MAX_X_LABELS - 1)) * (dates.length - 1))
  );
  return indices.map((i) => formatDate(dates[i]));
};

export function MenstrualPerformanceChart({ data, aggregation, onAggregationChange }: MenstrualPerformanceChartProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (data.length === 0) {
    return (
      <ProgressChartSection title={t('progress.correlationView.menstrualPerformance')}>
         <View className="py-10 items-center justify-center">
            <Text className="text-text-tertiary text-sm">{t('progress.noDataAvailable')}</Text>
          </View>
      </ProgressChartSection>
    );
  }

  const xAxisLabels = getXAxisLabels(data.map((d) => d.date));
  const series = [
    {
      key: 'workoutScore',
      label: t('progress.workoutScore'),
      color: theme.colors.accent.primary,
    },
    { key: 'energyLevel', label: t('progress.energyLevel'), color: theme.colors.macros.fat.bg },
    { key: 'weight', label: t('progress.weight'), color: theme.colors.macros.protein.bg },
  ];

  return (
    <ProgressChartSection title={t('progress.correlationView.menstrualPerformance')}>
      <View className="mb-4 flex-row items-center gap-2">
        {(['daily', 'weekly', 'monthly'] as TimeAggregation[]).map((agg) => (
          <TouchableOpacity
            key={agg}
            onPress={() => onAggregationChange(agg)}
            className={`rounded-full px-3 py-1.5 ${
              aggregation === agg ? 'bg-accent-primary' : 'bg-background-tertiary'
            }`}
          >
            <Text className={`text-xs font-bold ${aggregation === agg ? 'text-white' : 'text-text-tertiary'}`}>
              {t(`common.time.${agg}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View>
        <MultipleLinesChart
          data={data.map((d) => ({
            x: d.date,
            workoutScore: d.workoutScore * 10,
            energyLevel: d.energyLevel * 10,
            weight: d.weight,
          }))}
          series={series}
          height={250}
          xAxisLabels={xAxisLabels}
          yDomain={[0, 100]}
        />
        <View className="mt-4 flex-row justify-around px-2">
          {['menstrual', 'follicular', 'ovulatory', 'luteal'].map((p) => {
            const hasPoints = data.some((dp) => dp.phase === p);
            if (!hasPoints) return null;
            return (
              <View key={p} className="items-center">
                <Text className="text-[8px] uppercase tracking-tighter text-text-tertiary">
                  {t(`cycle.phase.${p}`)}
                </Text>
                <View
                  style={{
                    width: 20,
                    height: 4,
                    backgroundColor:
                      p === 'menstrual'
                        ? theme.colors.accent.primary
                        : p === 'follicular'
                        ? theme.colors.accent.secondary
                        : p === 'ovulatory'
                        ? theme.colors.accent.tertiary
                        : theme.colors.text.tertiary,
                    borderRadius: 2,
                    marginTop: 2,
                  }}
                />
              </View>
            );
          })}
        </View>
      </View>
    </ProgressChartSection>
  );
}
