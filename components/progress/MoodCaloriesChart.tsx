import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { MoodCaloriesPoint, TimeAggregation } from '../../database/services/ProgressService';
import { useTheme } from '../../hooks/useTheme';
import { getXAxisLabels } from '../../utils/chartUtils';
import { BarLineChart } from '../charts/BarLineChart';
import { ProgressChartSection } from './ProgressChartSection';

interface MoodCaloriesChartProps {
  allData: Record<TimeAggregation, MoodCaloriesPoint[]>;
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

export function MoodCaloriesChart({ allData }: MoodCaloriesChartProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [aggregation, setAggregation] = useState<TimeAggregation>('daily');
  const data = (allData && allData[aggregation]) || [];

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
      <ProgressChartSection title={t('progress.correlationView.moodCalories')}>
        {aggregationToggle}
        <View className="items-center justify-center py-10">
          <Text className="text-sm text-text-tertiary">{t('progress.noDataAvailable')}</Text>
        </View>
      </ProgressChartSection>
    );
  }

  const maxCal = Math.max(...data.map((d) => d.calories), 1);

  const xAxisLabels = getXAxisLabels(
    data.map((d) => ({ x: d.date })),
    formatDate
  );

  return (
    <ProgressChartSection title={t('progress.correlationView.moodCalories')}>
      {aggregationToggle}
      <BarLineChart
        data={data.map((d, i) => ({
          x: i,
          steps: d.calories,
          heartRate: d.mood,
        }))}
        height={250}
        barSeriesLabel={t('progress.dailyCalories')}
        lineSeriesLabel={t('progress.mood.moodScore')}
        stepsDomain={[0, maxCal * 1.1]}
        heartRateDomain={[0, 4]}
        leftAxisLabels={['0', `${Math.round(maxCal / 2)}`, `${Math.round(maxCal)}`]}
        rightAxisLabels={[
          t('progress.mood.poor'),
          t('progress.mood.okay'),
          t('progress.mood.great'),
        ]}
        stepsFormatter={(v) => `${Math.round(v)} ${t('progress.kcal')}`}
        heartRateFormatter={(v) => {
          const key = MOOD_KEYS[Math.round(v)];
          return key ? t(`progress.mood.${key}`) : v.toFixed(1);
        }}
        lineColor={theme.colors.status.indigo}
        xAxisLabels={xAxisLabels}
      />
    </ProgressChartSection>
  );
}
