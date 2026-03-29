import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { MoodVolumePoint, TimeAggregation } from '../../database/services/ProgressService';
import { useFormatAppNumber } from '../../hooks/useFormatAppNumber';
import { useTheme } from '../../hooks/useTheme';
import { getXAxisLabels } from '../../utils/chartUtils';
import { BarLineChart } from '../charts/BarLineChart';
import { ProgressChartSection } from './ProgressChartSection';

interface MoodVolumeChartProps {
  allData: Record<TimeAggregation, MoodVolumePoint[]>;
  units: string;
}

const formatDate = (timestamp: number): string => {
  const d = new Date(timestamp);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const MOOD_KEYS: ('poor' | 'low' | 'okay' | 'good' | 'great')[] = [
  'poor',
  'low',
  'okay',
  'good',
  'great',
];

export function MoodVolumeChart({ allData, units }: MoodVolumeChartProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatDecimal, formatInteger } = useFormatAppNumber();
  const [aggregation, setAggregation] = useState<TimeAggregation>('daily');
  const data = (allData && allData[aggregation]) || [];
  const weightLabel = units === 'imperial' ? 'lbs' : 'kg';

  const aggregationToggle = (
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
  );

  if (!data || data.length === 0) {
    return (
      <ProgressChartSection title={t('progress.correlationView.moodVolume')}>
        {aggregationToggle}
        <View className="items-center justify-center py-10">
          <Text className="text-sm text-text-tertiary">{t('progress.noDataAvailable')}</Text>
        </View>
      </ProgressChartSection>
    );
  }

  const maxVol = Math.max(...data.map((d) => d.volume), 1);

  const xAxisLabels = getXAxisLabels(
    data.map((d) => ({ x: d.date })),
    formatDate
  );

  return (
    <ProgressChartSection title={t('progress.correlationView.moodVolume')}>
      {aggregationToggle}
      <BarLineChart
        data={data.map((d, i) => ({
          x: i,
          steps: d.volume,
          heartRate: d.mood,
        }))}
        height={250}
        barSeriesLabel={t('progress.workoutVolume')}
        lineSeriesLabel={t('progress.mood.moodScore')}
        stepsDomain={[0, maxVol * 1.1]}
        heartRateDomain={[0, 4]}
        leftAxisLabels={['0', `${Math.round(maxVol / 2)}`, `${Math.round(maxVol)}`]}
        rightAxisLabels={[
          t('progress.mood.poor'),
          t('progress.mood.okay'),
          t('progress.mood.great'),
        ]}
        stepsFormatter={(v) => `${formatInteger(Math.round(v))} ${weightLabel}`}
        heartRateFormatter={(v) => {
          const key = MOOD_KEYS[Math.round(v)];
          return key ? t(`progress.mood.${key}`) : formatDecimal(v, 1);
        }}
        lineColor={theme.colors.status.indigo}
        xAxisLabels={xAxisLabels}
      />
    </ProgressChartSection>
  );
}
