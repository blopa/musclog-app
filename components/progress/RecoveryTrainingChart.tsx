import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { CartesianChart, Scatter } from 'victory-native';

import { RecoveryTrainingPoint, TimeAggregation } from '../../database/services/ProgressService';
import { useTheme } from '../../hooks/useTheme';
import { ProgressChartSection } from './ProgressChartSection';

interface RecoveryTrainingChartProps {
  allData: Record<TimeAggregation, RecoveryTrainingPoint[]>;
}

export function RecoveryTrainingChart({ allData }: RecoveryTrainingChartProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [aggregation, setAggregation] = useState<TimeAggregation>('daily');
  const data = (allData && allData[aggregation]) || [];

  if (!data || data.length === 0) {
    return (
      <ProgressChartSection title={t('progress.correlationView.recoveryTraining')}>
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

  const bubbleData = data
    .map((d) => ({
      x: d.volume,
      y: d.exhaustion,
      r: Math.max(2, Math.min(15, d.caloriesBurned / 100)),
    }))
    .sort((a, b) => a.x - b.x);

  const xMin = Math.min(...bubbleData.map((d) => d.x));
  const xMax = Math.max(...bubbleData.map((d) => d.x));

  return (
    <ProgressChartSection title={t('progress.correlationView.recoveryTraining')}>
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
      <View style={{ height: 250 }}>
        <Text className="mb-2 text-center text-xs text-text-tertiary">
          Volume vs Exhaustion (Bubble size = Calories)
        </Text>
        <CartesianChart
          data={bubbleData}
          xKey="x"
          yKeys={['y']}
          domain={{ x: [xMin * 0.9, xMax * 1.1], y: [0, 11] }}
        >
          {({ points }) => (
            <Scatter
              points={points.y}
              radius={(pt) => {
                // pt is { x: number, xValue: number, y: number, yValue: number }
                // We want to find the corresponding bubbleData point.
                // bubbleData is sorted by x.
                const datum = bubbleData.find((d) => d.x === (pt.xValue as number));
                return datum ? datum.r : 5;
              }}
              color={theme.colors.accent.secondary}
            />
          )}
        </CartesianChart>
        <View className="mt-2 flex-row justify-between px-8">
          <Text className="text-[10px] text-text-tertiary">{xMin.toFixed(0)}</Text>
          <Text className="text-[10px] text-text-tertiary">{t('progress.workoutVolume')}</Text>
          <Text className="text-[10px] text-text-tertiary">{xMax.toFixed(0)}</Text>
        </View>
      </View>
    </ProgressChartSection>
  );
}
