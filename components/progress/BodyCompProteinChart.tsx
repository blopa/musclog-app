import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { CartesianChart, Line, Scatter } from 'victory-native';

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

  // Trend Line calculation (Linear Regression)
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
              className={`text-xs font-bold ${aggregation === agg ? 'text-white' : 'text-text-tertiary'}`}
            >
              {t(`common.time.${agg}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ height: 250 }}>
        <Text className="mb-2 text-center text-xs text-text-tertiary">
          {t('progress.proteinVsWeightChange', { unit: weightLabel })}
        </Text>
        <CartesianChart
          data={scatterData}
          xKey="x"
          yKeys={['y']}
          domain={{ x: [xMin * 0.9, xMax * 1.1], y: [yMin - 0.5, yMax + 0.5] }}
        >
          {({ points }) => (
            <>
              <Scatter points={points.y} radius={4} color={theme.colors.accent.primary} />
              <Line
                points={
                  [
                    {
                      x: ((trendLineData[0].x - xMin * 0.9) / (xMax * 1.1 - xMin * 0.9)) * 300,
                      y: ((yMax + 0.5 - trendLineData[0].y) / (yMax - yMin + 1)) * 250,
                    },
                    {
                      x: ((trendLineData[1].x - xMin * 0.9) / (xMax * 1.1 - xMin * 0.9)) * 300,
                      y: ((yMax + 0.5 - trendLineData[1].y) / (yMax - yMin + 1)) * 250,
                    },
                  ] as any
                }
                color={theme.colors.text.tertiary}
                strokeWidth={1}
              />
            </>
          )}
        </CartesianChart>
        <View className="mt-2 flex-row justify-between px-8">
          <Text className="text-[10px] text-text-tertiary">{xMin.toFixed(0)}g</Text>
          <Text className="text-[10px] text-text-tertiary">{t('progress.proteinIntake')}</Text>
          <Text className="text-[10px] text-text-tertiary">{xMax.toFixed(0)}g</Text>
        </View>
      </View>
    </ProgressChartSection>
  );
}
