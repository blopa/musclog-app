import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { BarChart } from '../charts/BarChart';
import { StackedBarChart } from '../charts/StackedBarChart';
import { BarLineChart } from '../charts/BarLineChart';
import { StackedBarLineChart } from '../charts/StackedBarLineChart';
import { ProgressChartSection } from './ProgressChartSection';
import { DailyNutrition, MetricPoint } from '../../database/services/ProgressService';
import { useTheme } from '../../hooks/useTheme';

interface NutritionChartsProps {
  nutritionHistory: DailyNutrition[];
  weightHistory: MetricPoint[];
  units: string;
}

type NutritionView = 'calories' | 'macros' | 'combined' | 'macrosCombined';

export function NutritionCharts({
  nutritionHistory,
  weightHistory,
  units,
}: NutritionChartsProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [view, setView] = useState<NutritionView>('calories');

  if (nutritionHistory.length === 0) return null;

  const weightLabel = units === 'imperial' ? 'lbs' : 'kg';

  const renderViewSelector = () => (
    <View className="flex-row items-center gap-1">
      {(['calories', 'macros', 'combined', 'macrosCombined'] as NutritionView[]).map((v) => (
        <TouchableOpacity
          key={v}
          onPress={() => setView(v)}
          className={`rounded-full px-2 py-1 ${
            view === v ? 'bg-accent-primary' : 'bg-background-tertiary'
          }`}
        >
          <Text
            className={`text-[10px] font-bold ${
              view === v ? 'text-white' : 'text-text-tertiary'
            }`}
          >
            {t(`progress.nutritionView.${v}`)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Match nutrition and weight points by date
  const getCombinedData = () => {
    return nutritionHistory.map((n) => {
      const closestWeight = weightHistory.reduce((prev, curr) =>
        Math.abs(curr.date - n.date) < Math.abs(prev.date - n.date) ? curr : prev
      , weightHistory[0]);

      return {
        x: n.date,
        calories: n.calories,
        weight: closestWeight?.value || 0,
        protein: n.protein,
        carbs: n.carbs,
        fat: n.fat,
        fiber: n.fiber,
      };
    });
  };

  const renderChart = () => {
    const combinedData = getCombinedData();

    switch (view) {
      case 'calories':
        return (
          <BarChart
            data={nutritionHistory.map((d) => ({ x: d.date, y: d.calories }))}
            height={200}
            barColor={theme.colors.accent.primary}
            tooltipFormatter={(p) => `${Math.round(p.y)} kcal`}
          />
        );
      case 'macros':
        return (
          <StackedBarChart
            data={nutritionHistory.map((d) => ({
              x: d.date,
              segments: [d.protein * 4, d.carbs * 4, d.fat * 9, d.fiber * 2],
            }))}
            height={200}
            stackColors={['#ef4444', '#3b82f6', '#eab308', '#10b981']}
          />
        );
      case 'combined':
        return (
          <BarLineChart
            data={combinedData.map((d, i) => ({
              x: i,
              steps: d.calories,
              heartRate: d.weight,
            }))}
            height={200}
            barSeriesLabel="Calories"
            lineSeriesLabel={`Weight (${weightLabel})`}
            stepsDomain={[0, Math.max(...combinedData.map(d => d.calories)) * 1.2]}
            heartRateDomain={[
              Math.min(...combinedData.map(d => d.weight)) * 0.95,
              Math.max(...combinedData.map(d => d.weight)) * 1.05
            ]}
            leftAxisLabels={['0', '1k', '2k', '3k', '4k']}
            rightAxisLabels={[
              Math.min(...combinedData.map(d => d.weight)).toFixed(0),
              Math.max(...combinedData.map(d => d.weight)).toFixed(0)
            ]}
            stepsFormatter={(v) => `${Math.round(v)} kcal`}
            heartRateFormatter={(v) => `${v.toFixed(1)} ${weightLabel}`}
          />
        );
      case 'macrosCombined':
        return (
          <StackedBarLineChart
            data={combinedData.map((d, i) => ({
              x: i,
              segments: [d.protein * 4, d.carbs * 4, d.fat * 9, d.fiber * 2],
              lineValue: d.weight,
            }))}
            height={200}
            barSeriesLabel="Macros (kcal)"
            lineSeriesLabel={`Weight (${weightLabel})`}
            stackColors={['#ef4444', '#3b82f6', '#eab308', '#10b981']}
            lineDomain={[
              Math.min(...combinedData.map(d => d.weight)) * 0.95,
              Math.max(...combinedData.map(d => d.weight)) * 1.05
            ]}
            lineFormatter={(v) => `${v.toFixed(1)} ${weightLabel}`}
          />
        );
    }
  };

  return (
    <ProgressChartSection
      title={t('progress.nutrition')}
      rightElement={renderViewSelector()}
    >
      {renderChart()}
    </ProgressChartSection>
  );
}
