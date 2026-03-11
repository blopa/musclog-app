import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { VictoryAxis, VictoryChart, VictoryScatter } from 'victory';

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
                className={`text-xs font-bold ${
                  aggregation === agg ? 'text-white' : 'text-text-tertiary'
                }`}
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
              className={`text-xs font-bold ${
                aggregation === agg ? 'text-white' : 'text-text-tertiary'
              }`}
            >
              {t(`common.time.${agg}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ height: 280 }}>
        <Text className="mb-2 text-center text-xs text-text-tertiary">
          Volume vs Exhaustion (Bubble size = Calories)
        </Text>
        <VictoryChart
          height={250}
          padding={{ top: 20, bottom: 40, left: 50, right: 20 }}
          domain={{ x: [xMin * 0.9, xMax * 1.1], y: [0, 11] }}
        >
          <VictoryAxis
            dependentAxis
            style={{
              axis: { stroke: 'transparent' },
              grid: { stroke: theme.colors.border.light, strokeDasharray: '4,4' },
              tickLabels: { fill: theme.colors.text.tertiary, fontSize: 10 },
            }}
          />
          <VictoryAxis
            style={{
              axis: { stroke: theme.colors.border.light },
              tickLabels: { fill: theme.colors.text.tertiary, fontSize: 10 },
            }}
            label={t('progress.workoutVolume')}
          />
          <VictoryScatter
            data={bubbleData}
            size={({ datum }) => datum.r}
            style={{ data: { fill: theme.colors.accent.secondary, fillOpacity: 0.6 } }}
          />
        </VictoryChart>
      </View>
    </ProgressChartSection>
  );
}
