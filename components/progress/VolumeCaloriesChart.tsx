import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { CorrelationPoint, TimeAggregation } from '../../database/services/ProgressService';
import { BarLineChart } from '../charts/BarLineChart';
import { ProgressChartSection } from './ProgressChartSection';

interface VolumeCaloriesChartProps {
  allData: Record<TimeAggregation, CorrelationPoint[]>;
  units: string;
}

const MAX_X_LABELS = 8;
const formatDate = (timestamp: number): string => {
  const d = new Date(timestamp);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getXAxisLabels = (dates: number[]): string[] => {
  if (dates.length === 0) {
    return [];
  }
  if (dates.length <= MAX_X_LABELS) {
    return dates.map(formatDate);
  }
  const indices = Array.from({ length: MAX_X_LABELS }, (_, i) =>
    Math.round((i / (MAX_X_LABELS - 1)) * (dates.length - 1))
  );
  return indices.map((i) => formatDate(dates[i]));
};

export function VolumeCaloriesChart({ allData, units }: VolumeCaloriesChartProps) {
  const { t } = useTranslation();
  const [aggregation, setAggregation] = useState<TimeAggregation>('daily');
  const data = (allData && allData[aggregation]) || [];
  const weightLabel = units === 'imperial' ? 'lbs' : 'kg';

  if (!data || data.length === 0) {
    return (
      <ProgressChartSection title={t('progress.correlationView.volumeCalories')}>
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

  const maxVol = Math.max(...data.map((d) => d.weeklyVolume), 1);
  const maxCal = Math.max(...data.map((d) => d.dailyCalories), 1);
  const xAxisLabels = getXAxisLabels(data.map((d) => d.date));

  return (
    <ProgressChartSection title={t('progress.correlationView.volumeCalories')}>
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
      <BarLineChart
        data={data.map((d, i) => ({
          x: i,
          steps: d.weeklyVolume,
          heartRate: d.dailyCalories,
        }))}
        height={250}
        barSeriesLabel={t('progress.weeklyVolume')}
        lineSeriesLabel={t('progress.dailyCalories')}
        stepsDomain={[0, maxVol * 1.1]}
        heartRateDomain={[0, maxCal * 1.1]}
        leftAxisLabels={['0', `${Math.round(maxVol / 2)}`, `${Math.round(maxVol)}`]}
        rightAxisLabels={['0', `${Math.round(maxCal / 2)}`, `${Math.round(maxCal)}`]}
        stepsFormatter={(v) => `${Math.round(v)} ${weightLabel}`}
        heartRateFormatter={(v) => `${Math.round(v)} ${t('progress.kcal')}`}
        xAxisLabels={xAxisLabels}
      />
    </ProgressChartSection>
  );
}
