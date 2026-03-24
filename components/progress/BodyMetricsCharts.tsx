import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { MetricPoint } from '../../database/services/ProgressService';
import { useTheme } from '../../hooks/useTheme';
import { getXAxisLabels, getYAxisLabels } from '../../utils/chartUtils';
import { LineChart } from '../charts/LineChart';
import { ProgressChartSection } from './ProgressChartSection';

interface BodyMetricsChartsProps {
  weightHistory: MetricPoint[];
  fatHistory: MetricPoint[];
  ffmiHistory: MetricPoint[];
  units: string;
}

export function BodyMetricsCharts({
  weightHistory,
  fatHistory,
  ffmiHistory,
  units,
}: BodyMetricsChartsProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const weightLabel = units === 'imperial' ? 'lbs' : 'kg';

  return (
    <View>
      {weightHistory.length >= 2 ? (
        <ProgressChartSection
          title={t('progress.weight')}
          subtitle={t('progress.weightTrendSubtitle')}
        >
          <LineChart
            data={weightHistory.map((p) => ({ x: p.date, y: p.value }))}
            height={200}
            lineColor={theme.colors.status.info}
            areaColor={theme.colors.status.info10}
            xDomain={[weightHistory[0].date, weightHistory[weightHistory.length - 1].date]}
            yDomain={[
              Math.min(...weightHistory.map((p) => p.value)) * 0.95,
              Math.max(...weightHistory.map((p) => p.value)) * 1.05,
            ]}
            yAxisLabels={getYAxisLabels(
              Math.min(...weightHistory.map((p) => p.value)) * 0.95,
              Math.max(...weightHistory.map((p) => p.value)) * 1.05,
              3,
              (v) => `${Math.round(v)} ${weightLabel}`
            )}
            tooltipFormatter={(p) => `${Math.round(p.y * 10) / 10} ${weightLabel}`}
            xAxisLabels={getXAxisLabels(weightHistory.map((p) => ({ x: p.date })))}
          />
        </ProgressChartSection>
      ) : null}

      {fatHistory.length >= 2 ? (
        <ProgressChartSection
          title={t('progress.bodyFat')}
          subtitle={t('progress.bodyFatSubtitle')}
        >
          <LineChart
            data={fatHistory.map((p) => ({ x: p.date, y: p.value }))}
            height={200}
            lineColor={theme.colors.status.error}
            areaColor={theme.colors.status.error10}
            xDomain={[fatHistory[0].date, fatHistory[fatHistory.length - 1].date]}
            yDomain={[
              Math.min(...fatHistory.map((p) => p.value)) * 0.9,
              Math.max(...fatHistory.map((p) => p.value)) * 1.1,
            ]}
            yAxisLabels={getYAxisLabels(
              Math.min(...fatHistory.map((p) => p.value)) * 0.9,
              Math.max(...fatHistory.map((p) => p.value)) * 1.1,
              3,
              (v) => `${Math.round(v)}%`
            )}
            tooltipFormatter={(p) => `${Math.round(p.y * 10) / 10}%`}
            xAxisLabels={getXAxisLabels(fatHistory.map((p) => ({ x: p.date })))}
          />
        </ProgressChartSection>
      ) : null}

      {ffmiHistory.length >= 2 ? (
        <ProgressChartSection title={t('progress.ffmi')} subtitle={t('progress.ffmiSubtitle')}>
          <LineChart
            data={ffmiHistory.map((p) => ({ x: p.date, y: p.value }))}
            height={200}
            lineColor={theme.colors.accent.secondary}
            areaColor={theme.colors.accent.secondary10}
            xDomain={[ffmiHistory[0].date, ffmiHistory[ffmiHistory.length - 1].date]}
            yDomain={[
              Math.min(...ffmiHistory.map((p) => p.value)) * 0.95,
              Math.max(...ffmiHistory.map((p) => p.value)) * 1.05,
            ]}
            yAxisLabels={getYAxisLabels(
              Math.min(...ffmiHistory.map((p) => p.value)) * 0.95,
              Math.max(...ffmiHistory.map((p) => p.value)) * 1.05,
              3
            )}
            tooltipFormatter={(p) => `${Math.round(p.y * 10) / 10}`}
            xAxisLabels={getXAxisLabels(ffmiHistory.map((p) => ({ x: p.date })))}
          />
        </ProgressChartSection>
      ) : null}
    </View>
  );
}
