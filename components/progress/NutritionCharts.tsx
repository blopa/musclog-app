import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { BarLineChart } from '@/components/charts/BarLineChart';
import { StackedBarChart } from '@/components/charts/StackedBarChart';
import { StackedBarLineChart } from '@/components/charts/StackedBarLineChart';
import { DailyNutrition, MetricPoint } from '@/database/services/ProgressService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { formatLocalCalendarMonthDayNumericIntl } from '@/utils/calendarDate';
import { getXAxisLabels } from '@/utils/chartUtils';

import { ProgressChartSection } from './ProgressChartSection';

interface NutritionChartsProps {
  nutritionHistory: DailyNutrition[];
  weightHistory: MetricPoint[];
  units: string;
}

type NutritionView = 'calories' | 'macros' | 'combined' | 'macrosCombined';

export function NutritionCharts({ nutritionHistory, weightHistory, units }: NutritionChartsProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { formatDecimal, formatInteger } = useFormatAppNumber();

  const computeLeftAxisLabels = useCallback(
    (maxVal: number): string[] => {
      if (maxVal <= 0) {
        return [formatInteger(0)];
      }
      const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
      const niceStep = Math.ceil(maxVal / 4 / magnitude) * magnitude;
      const labels: string[] = [];
      for (let i = 0; i <= 5; i++) {
        const v = i * niceStep;
        if (v > maxVal * 1.2) {
          break;
        }
        if (v >= 1000) {
          const kCompact = Math.round(v / 100) / 10;
          labels.push(`${formatDecimal(kCompact, 1)}k`);
        } else {
          labels.push(formatInteger(Math.round(v)));
        }
      }
      return labels;
    },
    [formatDecimal, formatInteger]
  );
  const [view, setView] = useState<NutritionView>('calories');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const frameRef = useRef<number | null>(null);

  // Reset transitioning state after the view has changed and rendered
  useEffect(() => {
    if (!isTransitioning) {
      return;
    }

    // Wait for the next frame to ensure the chart has rendered
    frameRef.current = requestAnimationFrame(() => {
      // Wait one more frame to ensure layout is complete
      frameRef.current = requestAnimationFrame(() => {
        setIsTransitioning(false);
        frameRef.current = null;
      });
    });

    // Cleanup on unmount or when view changes before transition completes
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [view, isTransitioning]); // When view changes and we're transitioning, wait for render

  const handleViewChange = (newView: NutritionView) => {
    // Prevent rapid clicks during transition
    if (isTransitioning || newView === view) {
      return;
    }

    setIsTransitioning(true);
    setView(newView);
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

  const xAxisLabels = useMemo(
    () =>
      getXAxisLabels(
        nutritionHistory.map((d) => ({ x: d.date })),
        (x) => formatLocalCalendarMonthDayNumericIntl(x, i18n.language)
      ),
    [nutritionHistory, i18n.language]
  );

  const macroColors = useMemo(
    () =>
      [
        theme.colors.macros.protein.bg,
        theme.colors.macros.carbs.bg,
        theme.colors.macros.fat.bg,
        theme.colors.macros.fiber.bg,
      ] as [string, string, string, string],
    [theme]
  );

  if (nutritionHistory.length === 0) {
    return null;
  }

  const weightLabel = units === 'imperial' ? 'lbs' : 'kg';

  const renderViewSelector = () => (
    <View className="flex-row flex-wrap items-center gap-1">
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
      case 'calories': {
        return (
          <BarChart
            data={nutritionHistory.map((d) => ({ x: d.date, y: d.calories }))}
            height={200}
            barColor={theme.colors.accent.primary}
            tooltipFormatter={(p) => `${formatInteger(Math.round(p.y))} ${t('progress.kcal')}`}
            xAxisLabels={xAxisLabels}
          />
        );
      }
      case 'macros': {
        return (
          <StackedBarChart
            data={nutritionHistory.map((d) => ({
              x: d.date,
              segments: [d.protein * 4, d.carbs * 4, d.fat * 9, d.fiber * 2],
            }))}
            height={200}
            stackColors={macroColors}
            xAxisLabels={xAxisLabels}
          />
        );
      }
      case 'combined': {
        const maxCal = Math.max(...combinedData.map((d) => d.calories));
        const calDomain: [number, number] = [0, maxCal * 1.2];

        return (
          <BarLineChart
            data={combinedData.map((d, i) => ({
              x: i,
              steps: d.calories,
              heartRate: d.weight,
            }))}
            height={200}
            barSeriesLabel={t('progress.nutritionView.calories')}
            lineSeriesLabel={`${t('progress.weight')} (${weightLabel})`}
            stepsDomain={calDomain}
            heartRateDomain={[
              Math.min(...combinedData.map((d) => d.weight)) * 0.95,
              Math.max(...combinedData.map((d) => d.weight)) * 1.05,
            ]}
            leftAxisLabels={computeLeftAxisLabels(maxCal)}
            rightAxisLabels={[
              formatDecimal(Math.min(...combinedData.map((d) => d.weight)), 0),
              formatDecimal(Math.max(...combinedData.map((d) => d.weight)), 0),
            ]}
            stepsFormatter={(v) => `${formatDecimal(Math.round(v), 0)} ${t('progress.kcal')}`}
            heartRateFormatter={(v) => `${formatDecimal(v, 1)} ${weightLabel}`}
            xAxisLabels={xAxisLabels}
          />
        );
      }
      case 'macrosCombined': {
        return (
          <StackedBarLineChart
            data={combinedData.map((d, i) => ({
              x: i,
              segments: [d.protein * 4, d.carbs * 4, d.fat * 9, d.fiber * 2],
              lineValue: d.weight,
            }))}
            height={200}
            barSeriesLabel={`${t('progress.nutritionView.macros')} (${t('progress.kcal')})`}
            lineSeriesLabel={`${t('progress.weight')} (${weightLabel})`}
            stackColors={macroColors}
            lineDomain={[
              Math.min(...combinedData.map((d) => d.weight)) * 0.95,
              Math.max(...combinedData.map((d) => d.weight)) * 1.05,
            ]}
            lineFormatter={(v) => `${formatDecimal(v, 1)} ${weightLabel}`}
            xAxisLabels={xAxisLabels}
          />
        );
      }
    }
  };

  return (
    <ProgressChartSection title={t('progress.nutrition')}>
      <View className="mb-3">{renderViewSelector()}</View>
      {renderChart()}
    </ProgressChartSection>
  );
}
