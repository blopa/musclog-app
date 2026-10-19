import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { MultipleLinesChart } from '@/components/charts/MultipleLinesChart';
import { useAppLock } from '@/context/AppLockContext';
import { CycleBandPoint, TimeAggregation } from '@/database/services/ProgressService';
import { useTheme } from '@/hooks/useTheme';
import { formatUtcNormalizedDayIntl } from '@/utils/calendarDate';
import { getXAxisLabels } from '@/utils/chartUtils';
import { type PeriodBand } from '@/utils/cycle/periodBands';

import { ProgressChartSection } from './ProgressChartSection';

interface MenstrualPerformanceChartProps {
  allData: Record<TimeAggregation, CycleBandPoint[]>;
}

export function MenstrualPerformanceChart({ allData }: MenstrualPerformanceChartProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [aggregation, setAggregation] = useState<TimeAggregation>('daily');
  const { isLocked } = useAppLock();
  const data = (allData && allData[aggregation]) || [];
  const getBandColor = (band: PeriodBand) => {
    if (band === 'period') {
      return theme.colors.accent.primary;
    }

    if (band === 'before') {
      return theme.colors.accent.tertiary;
    }

    return theme.colors.text.tertiary;
  };

  if (!data || data.length === 0) {
    return (
      <ProgressChartSection title={t('progress.correlationView.menstrualPerformance')}>
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
                className={`text-xs font-bold ${aggregation === agg ? 'text-text-on-accent' : 'text-text-tertiary'}`}
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

  const xAxisLabels = getXAxisLabels(
    data.map((d) => ({ x: d.date })),
    (x) => formatUtcNormalizedDayIntl(x, i18n.language)
  );
  const series = [
    {
      key: 'workoutScore',
      label: t('progress.workoutScore'),
      color: theme.colors.accent.primary,
    },
    { key: 'energyLevel', label: t('progress.energyLevel'), color: theme.colors.macros.fat.bg },
    { key: 'weight', label: t('progress.weight'), color: theme.colors.macros.protein.bg },
  ];

  // The bands are logged periods: behind the cycle lock like every other cycle surface.
  if (isLocked('cycle')) {
    return null;
  }

  return (
    <ProgressChartSection title={t('progress.correlationView.menstrualPerformance')}>
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
              className={`text-xs font-bold ${aggregation === agg ? 'text-text-on-accent' : 'text-text-tertiary'}`}
            >
              {t(`common.time.${agg}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View>
        <MultipleLinesChart
          data={data.map((d) => ({
            x: d.date,
            workoutScore: d.workoutScore * 10,
            energyLevel: d.energyLevel * 10,
            weight: d.weight,
          }))}
          series={series}
          height={250}
          xAxisLabels={xAxisLabels}
          yDomain={[0, 100]}
        />
        <View className="mt-4 flex-row justify-around px-2">
          {(['period', 'before', 'other'] as PeriodBand[]).map((band) => {
            if (!data.some((dp) => dp.band === band)) {
              return null;
            }

            return (
              <View key={band} className="items-center">
                <Text className="text-xs text-text-tertiary">
                  {t(`progress.cycleBand.${band}`)}
                </Text>
                <View
                  style={{
                    width: 20,
                    height: 4,
                    backgroundColor: getBandColor(band),
                    borderRadius: 2,
                    marginTop: 2,
                  }}
                />
              </View>
            );
          })}
        </View>
      </View>
    </ProgressChartSection>
  );
}
