import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { VictoryAxis, VictoryChart, VictoryLine, VictoryScatter } from 'victory';

import { BodyCompProteinPoint, TimeAggregation } from '../../database/services/ProgressService';
import { useTheme } from '../../hooks/useTheme';
import { ProgressChartSection } from './ProgressChartSection';

interface BodyCompProteinChartProps {
  allData: Record<TimeAggregation, BodyCompProteinPoint[]>;
  units: string;
}

export function BodyCompProteinChart({ allData, units }: BodyCompProteinChartProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [aggregation, setAggregation] = useState<TimeAggregation>('daily');
  const data = allData[aggregation];
  const weightLabel = units === 'imperial' ? 'lbs' : 'kg';

  if (data.length === 0) {
    return (
      <ProgressChartSection title={t('progress.correlationView.proteinBodyComp')}>
        <View className="items-center justify-center py-10">
          <Text className="text-sm text-text-tertiary">{t('progress.noDataAvailable')}</Text>
        </View>
      </ProgressChartSection>
    );
  }

  const scatterData = data
    .map((d) => ({
      x: d.protein,
      y: d.weightChange,
    }))
    .sort((a, b) => a.x - b.x);

  const xMin = Math.min(...scatterData.map((d) => d.x));
  const xMax = Math.max(...scatterData.map((d) => d.x));
  const yMin = Math.min(...scatterData.map((d) => d.y));
  const yMax = Math.max(...scatterData.map((d) => d.y));

  const n = scatterData.length;
  const sumX = scatterData.reduce((acc, d) => acc + d.x, 0);
  const sumY = scatterData.reduce((acc, d) => acc + d.y, 0);
  const sumXY = scatterData.reduce((acc, d) => acc + d.x * d.y, 0);
  const sumX2 = scatterData.reduce((acc, d) => acc + d.x * d.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
  const intercept = (sumY - slope * sumX) / n || 0;

  const trendLineData = [
    { x: xMin, y: slope * xMin + intercept },
    { x: xMax, y: slope * xMax + intercept },
  ];

  return (
    <ProgressChartSection title={t('progress.correlationView.proteinBodyComp')}>
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
          {t('progress.proteinVsWeightChange', { unit: weightLabel })}
        </Text>
        <VictoryChart
          height={250}
          padding={{ top: 20, bottom: 40, left: 50, right: 20 }}
          domain={{ x: [xMin * 0.9, xMax * 1.1], y: [yMin - 0.5, yMax + 0.5] }}
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
            label={t('progress.proteinIntake')}
          />
          <VictoryScatter
            data={scatterData}
            size={4}
            style={{ data: { fill: theme.colors.accent.primary } }}
          />
          <VictoryLine
            data={trendLineData}
            style={{ data: { stroke: theme.colors.text.tertiary, strokeWidth: 1 } }}
          />
        </VictoryChart>
      </View>
    </ProgressChartSection>
  );
}
