import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { LineChart } from '@/components/charts/LineChart';
import { MoodPoint, TimeAggregation } from '@/database/services/ProgressService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { formatLocalCalendarMonthDayNumericIntl } from '@/utils/calendarDate';
import { getXAxisLabels } from '@/utils/chartUtils';

import { ProgressChartSection } from './ProgressChartSection';

interface MoodHistoryChartProps {
  allData: Record<TimeAggregation, MoodPoint[]>;
}

const MOOD_KEYS: ('poor' | 'low' | 'okay' | 'good' | 'great')[] = [
  'poor',
  'low',
  'okay',
  'good',
  'great',
];

export function MoodHistoryChart({ allData }: MoodHistoryChartProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { formatDecimal } = useFormatAppNumber();
  const [aggregation, setAggregation] = useState<TimeAggregation>('daily');
  const data = (allData && allData[aggregation]) || [];

  const emptyState = (
    <ProgressChartSection title={t('progress.correlationView.moodHistory')}>
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
        <Text className="text-text-tertiary text-sm">{t('progress.noDataAvailable')}</Text>
      </View>
    </ProgressChartSection>
  );

  if (!data || data.length === 0) {
    return emptyState;
  }

  const chartData = data.map((d) => ({ x: d.date, y: d.mood }));
  const xAxisLabels = getXAxisLabels(
    data.map((d) => ({ x: d.date })),
    (x) => formatLocalCalendarMonthDayNumericIntl(x, i18n.language)
  );

  const yAxisLabels = [
    { label: t('progress.mood.great'), yDomainValue: 4 },
    { label: t('progress.mood.okay'), yDomainValue: 2 },
    { label: t('progress.mood.poor'), yDomainValue: 0 },
  ];

  return (
    <ProgressChartSection
      title={t('progress.correlationView.moodHistory')}
      subtitle={t('progress.mood.avgMood')}
    >
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
      <LineChart
        data={chartData}
        height={200}
        yDomain={[0, 4]}
        xDomain={[data[0].date, data[data.length - 1].date]}
        lineColor={theme.colors.status.indigo}
        areaColor={theme.colors.status.indigo10}
        xAxisLabels={xAxisLabels}
        yAxisLabels={yAxisLabels}
        interactive
        tooltipFormatter={(p) => {
          const key = MOOD_KEYS[Math.round(p.y)];
          return key ? t(`progress.mood.${key}`) : formatDecimal(p.y, 1);
        }}
      />
    </ProgressChartSection>
  );
}
