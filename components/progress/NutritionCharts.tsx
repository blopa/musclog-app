import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { BarChart } from '../charts/BarChart';
import { StackedBarChart } from '../charts/StackedBarChart';
import { LineChart } from '../charts/LineChart';
import { ProgressChartSection } from './ProgressChartSection';
import { DailyNutrition, MetricPoint } from '../../database/services/ProgressService';

interface NutritionChartsProps {
  nutritionHistory: DailyNutrition[];
  weightHistory: MetricPoint[];
}

type NutritionView = 'calories' | 'macros' | 'combined';

export function NutritionCharts({ nutritionHistory, weightHistory }: NutritionChartsProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<NutritionView>('calories');

  if (nutritionHistory.length === 0) return null;

  const renderViewSelector = () => (
    <View className="flex-row items-center gap-1">
      {(['calories', 'macros', 'combined'] as NutritionView[]).map((v) => (
        <TouchableOpacity
          key={v}
          onPress={() => setView(v)}
          className={`rounded-full px-2 py-1 ${
            view === v ? 'bg-accent-primary' : 'bg-background-tertiary'
          }`}
        >
          <Text
            className={`text-[10px] font-bold ${view === v ? 'text-white' : 'text-text-tertiary'}`}
          >
            {t(`progress.nutritionView.${v}`)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderChart = () => {
    switch (view) {
      case 'calories':
        return (
          <BarChart
            data={nutritionHistory.map((d) => ({ x: d.date, y: d.calories }))}
            height={200}
            barColor="#3b82f6"
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
        // This would ideally use BarLineChart but BarLineChart has hardcoded steps/heartRate
        // For now, let's show calories and overlay weight if possible or just show calories
        return (
          <BarChart
            data={nutritionHistory.map((d) => ({ x: d.date, y: d.calories }))}
            height={200}
            barColor="#3b82f6"
            tooltipFormatter={(p) => `${Math.round(p.y)} kcal`}
          />
        );
    }
  };

  return (
    <ProgressChartSection title={t('progress.nutrition')} rightElement={renderViewSelector()}>
      {renderChart()}
    </ProgressChartSection>
  );
}
