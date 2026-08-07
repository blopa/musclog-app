import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { LineChart } from '@/components/charts/LineChart';
import type { MetricPoint } from '@/database/services/ProgressService';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { formatUtcNormalizedDayIntl } from '@/utils/calendarDate';
import { getXAxisLabels, getYAxisLabels } from '@/utils/chartUtils';

import { ProgressChartSection } from './ProgressChartSection';
import {
  averageScaleWeightsByDay,
  selectWeightTrendPoint,
  trailingSevenDayTrendChange,
} from './weightTrendChartModel';

export interface WeightTrendChartProps {
  weightHistory: MetricPoint[];
  weightTrendHistory: MetricPoint[];
  units: string;
}

export function WeightTrendChartContent({
  weightHistory,
  weightTrendHistory,
  units,
}: WeightTrendChartProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const dateFnsLocale = useDateFnsLocale();
  const { formatRoundedDecimal } = useFormatAppNumber();

  if (weightHistory.length === 0) {
    return null;
  }

  const unit = units === 'imperial' ? 'lbs' : 'kg';
  const hasTrend = weightHistory.length >= 2 && weightTrendHistory.length >= 2;
  const latest = hasTrend
    ? weightTrendHistory[weightTrendHistory.length - 1]
    : weightHistory[weightHistory.length - 1];
  const sevenDayChange = hasTrend
    ? trailingSevenDayTrendChange(weightTrendHistory, weightHistory)
    : null;
  const scaleWeightsByDay = averageScaleWeightsByDay(weightHistory);
  const allValues = [...weightHistory, ...weightTrendHistory].map((point) => point.value);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const padding = Math.max((max - min) * 0.15, units === 'imperial' ? 1 : 0.5);
  const yDomain: [number, number] = [min - padding, max + padding];
  const chartSummary = t('progress.weightTrend.accessibilitySummary', {
    current: formatRoundedDecimal(latest.value, 1),
    unit,
    change:
      sevenDayChange === null
        ? t('progress.weightTrend.changeUnavailable')
        : `${sevenDayChange > 0 ? '+' : ''}${formatRoundedDecimal(sevenDayChange, 1)} ${unit}`,
  });

  return (
    <ProgressChartSection
      title={t('progress.weightTrend.title')}
      subtitle={t('progress.weightTrend.explanation')}
    >
      <View className="mb-2 flex-row items-baseline justify-between">
        <Text className="text-3xl font-black text-text-primary">
          {formatRoundedDecimal(latest.value, 1)}{' '}
          <Text className="text-base text-text-tertiary">{unit}</Text>
        </Text>
        {sevenDayChange !== null ? (
          <Text className="text-sm font-bold text-text-secondary">
            {t('progress.weightTrend.sevenDayChange')}: {sevenDayChange > 0 ? '+' : ''}
            {formatRoundedDecimal(sevenDayChange, 1)} {unit}
          </Text>
        ) : null}
      </View>

      {!hasTrend ? (
        <Text className="py-6 text-center text-sm text-text-tertiary">
          {t('progress.weightTrend.addAnother')}
        </Text>
      ) : (
        <LineChart
          data={weightTrendHistory.map((point) => ({ x: point.date, y: point.value }))}
          scatterData={scaleWeightsByDay.map((point) => ({ x: point.date, y: point.value }))}
          scatterColor={theme.colors.text.secondary}
          scatterRadius={3.5}
          height={200}
          lineColor={theme.colors.status.info}
          areaColor={theme.colors.status.info10}
          showLastPoint={false}
          xDomain={[
            weightTrendHistory[0].date,
            weightTrendHistory[weightTrendHistory.length - 1].date,
          ]}
          yDomain={yDomain}
          yAxisLabels={getYAxisLabels(
            yDomain[0],
            yDomain[1],
            3,
            (value) => `${formatRoundedDecimal(value, 0)} ${unit}`
          )}
          xAxisLabels={getXAxisLabels(
            weightTrendHistory.map((point) => ({ x: point.date })),
            (date) => formatUtcNormalizedDayIntl(date, i18n.resolvedLanguage ?? i18n.language),
            dateFnsLocale
          )}
          tooltipFormatter={(point) => {
            const selection = selectWeightTrendPoint(weightTrendHistory, weightHistory, point.x);
            if (!selection) {
              return '';
            }
            const date = formatUtcNormalizedDayIntl(
              selection.date,
              i18n.resolvedLanguage ?? i18n.language
            );
            const trendLabel = `${t('progress.weightTrend.trend')}: ${formatRoundedDecimal(selection.trendWeight, 1)} ${unit}`;
            const scaleLabel =
              selection.scaleWeight === null
                ? ''
                : `\n${t('progress.weightTrend.scaleWeight')}: ${formatRoundedDecimal(selection.scaleWeight, 1)} ${unit}`;
            return `${date}\n${trendLabel}${scaleLabel}`;
          }}
          accessibilityLabel={chartSummary}
        />
      )}

      <View className="mt-3 flex-row items-center gap-5">
        <View className="flex-row items-center gap-2">
          <View
            className="h-1 w-5 rounded-full"
            style={{ backgroundColor: theme.colors.status.info }}
          />
          <Text className="text-xs text-text-secondary">{t('progress.weightTrend.trend')}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: theme.colors.text.secondary }}
          />
          <Text className="text-xs text-text-secondary">
            {t('progress.weightTrend.scaleWeight')}
          </Text>
        </View>
      </View>
    </ProgressChartSection>
  );
}
