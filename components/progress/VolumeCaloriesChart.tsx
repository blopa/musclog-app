import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { CorrelationPoint, TimeAggregation } from '../../database/services/ProgressService';
import { useFormatAppNumber } from '../../hooks/useFormatAppNumber';
import { formatLocalCalendarMonthDayNumericIntl } from '../../utils/calendarDate';
import { getXAxisLabels } from '../../utils/chartUtils';
import { BarLineChart } from '../charts/BarLineChart';
import { ProgressChartSection } from './ProgressChartSection';

interface VolumeCaloriesChartProps {
  allData: Record<TimeAggregation, CorrelationPoint[]>;
  units: string;
}

export function VolumeCaloriesChart({ allData, units }: VolumeCaloriesChartProps) {
  const { t, i18n } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
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
  const xAxisLabels = getXAxisLabels(
    data.map((d) => ({ x: d.date })),
    (x) => formatLocalCalendarMonthDayNumericIntl(x, i18n.language)
  );

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
        leftAxisLabels={[
          '0',
          formatInteger(Math.round(maxVol / 2)),
          formatInteger(Math.round(maxVol)),
        ]}
        rightAxisLabels={[
          '0',
          formatInteger(Math.round(maxCal / 2)),
          formatInteger(Math.round(maxCal)),
        ]}
        stepsFormatter={(v) => `${formatInteger(Math.round(v))} ${weightLabel}`}
        heartRateFormatter={(v) => `${formatInteger(Math.round(v))} ${t('progress.kcal')}`}
        xAxisLabels={xAxisLabels}
      />
    </ProgressChartSection>
  );
}
