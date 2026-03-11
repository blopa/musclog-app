import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { DailyNutrition, MetricPoint } from '../../database/services/ProgressService';
import { useTheme } from '../../hooks/useTheme';
import { BarChart } from '../charts/BarChart';
import { BarLineChart } from '../charts/BarLineChart';
import { StackedBarChart } from '../charts/StackedBarChart';
import { StackedBarLineChart } from '../charts/StackedBarLineChart';
import { ProgressChartSection } from './ProgressChartSection';

interface NutritionChartsProps {
  nutritionHistory: DailyNutrition[];
  weightHistory: MetricPoint[];
  units: string;
}

type NutritionView = 'calories' | 'macros' | 'combined' | 'macrosCombined';

// TODO: add yaxis labels with the formatted dates DD/MM
export function NutritionCharts({ nutritionHistory, weightHistory, units }: NutritionChartsProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [view, setView] = useState<NutritionView>('calories');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<number | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  const handleViewChange = (newView: NutritionView) => {
    // Prevent rapid clicks during transition
    if (isTransitioning || newView === view) {
      return;
    }

    setIsTransitioning(true);
    setView(newView);

    // Clear any existing timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    // Allow next change after a short delay to let the chart render
    transitionTimeoutRef.current = setTimeout(() => {
      setIsTransitioning(false);
      transitionTimeoutRef.current = null;
    }, 150) as unknown as number;
  };

  // Match nutrition and weight points by date - memoized to prevent unnecessary recalculations
  const combinedData = useMemo(() => {
    return nutritionHistory.map((n) => {
      const closestWeight = weightHistory.reduce(
        (prev, curr) => (Math.abs(curr.date - n.date) < Math.abs(prev.date - n.date) ? curr : prev),
        weightHistory[0]
      );

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
  }, [nutritionHistory, weightHistory]);

  if (nutritionHistory.length === 0) {
    return null;
  }

  const weightLabel = units === 'imperial' ? 'lbs' : 'kg';

  const renderViewSelector = () => (
    <View className="flex-row items-center gap-1">
      {(['calories', 'macros', 'combined', 'macrosCombined'] as NutritionView[]).map((v) => (
        <TouchableOpacity
          key={v}
          onPress={() => handleViewChange(v)}
          disabled={isTransitioning}
          className={`rounded-full px-2 py-1 ${
            view === v ? 'bg-accent-primary' : 'bg-background-tertiary'
          } ${isTransitioning ? 'opacity-50' : ''}`}
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
            // TODO: use colors from useTheme
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
            // TODO: use i18n here
            barSeriesLabel="Calories"
            lineSeriesLabel={`Weight (${weightLabel})`}
            stepsDomain={[0, Math.max(...combinedData.map((d) => d.calories)) * 1.2]}
            heartRateDomain={[
              Math.min(...combinedData.map((d) => d.weight)) * 0.95,
              Math.max(...combinedData.map((d) => d.weight)) * 1.05,
            ]}
            // TODO: calculate these dunamically, depending on the highest peak, but still starting from 0
            leftAxisLabels={['0', '1k', '2k', '3k', '4k']}
            rightAxisLabels={[
              Math.min(...combinedData.map((d) => d.weight)).toFixed(0),
              Math.max(...combinedData.map((d) => d.weight)).toFixed(0),
            ]}
            // TODO: use i18n here
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
            // TODO: use i18n here
            barSeriesLabel="Macros (kcal)"
            // TODO: use i18n here
            lineSeriesLabel={`Weight (${weightLabel})`}
            // TODO: use colors from useTheme
            stackColors={['#ef4444', '#3b82f6', '#eab308', '#10b981']}
            lineDomain={[
              Math.min(...combinedData.map((d) => d.weight)) * 0.95,
              Math.max(...combinedData.map((d) => d.weight)) * 1.05,
            ]}
            lineFormatter={(v) => `${v.toFixed(1)} ${weightLabel}`}
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
