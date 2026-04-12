import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { StackedBarLineChart } from '@/components/charts/StackedBarLineChart';
import { MoodMacrosPoint, TimeAggregation } from '@/database/services/ProgressService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { formatLocalCalendarMonthDayNumericIntl } from '@/utils/calendarDate';
import { getXAxisLabels } from '@/utils/chartUtils';

import { ProgressChartSection } from './ProgressChartSection';

interface MoodMacrosChartProps {
  allData: Record<TimeAggregation, MoodMacrosPoint[]>;
}

export function MoodMacrosChart({ allData }: MoodMacrosChartProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { formatDecimal, formatInteger } = useFormatAppNumber();
  const moodLabels = [
    t('progress.mood.poor'),
    t('progress.mood.low'),
    t('progress.mood.okay'),
    t('progress.mood.good'),
    t('progress.mood.great'),
  ];
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
      <ProgressChartSection title={t('progress.correlationView.moodMacros')}>
        {aggregationToggle}
        <View className="items-center justify-center py-10">
          <Text className="text-sm text-text-tertiary">{t('progress.noDataAvailable')}</Text>
        </View>
      </ProgressChartSection>
    );
  }

  const maxTotal = Math.max(...data.map((d) => d.protein + d.carbs + d.fat), 1);

  const chartData = data.map((d, i) => ({
    x: i,
    segments: [d.protein, d.carbs, d.fat] as [number, number, number],
    lineValue: d.mood,
  }));

  const xAxisLabels = getXAxisLabels(
    data.map((d) => ({ x: d.date })),
    (x) => formatLocalCalendarMonthDayNumericIntl(x, i18n.language)
  );

  return (
    <ProgressChartSection title={t('progress.correlationView.moodMacros')}>
      {aggregationToggle}
      <StackedBarLineChart
        data={chartData}
        height={250}
        barSeriesLabel={`${t('nutrition.protein')} + ${t('nutrition.carbs')} + ${t('nutrition.fat')}`}
        lineSeriesLabel={t('progress.mood.moodScore')}
        stackedDomain={[0, maxTotal * 1.1]}
        lineDomain={[0, 4]}
        stackColors={[
          theme.colors.macros.protein.bg,
          theme.colors.macros.carbs.bg,
          theme.colors.macros.fat.bg,
        ]}
        lineColor={theme.colors.status.indigo}
        leftAxisLabels={[
          formatInteger(0),
          formatInteger(Math.round(maxTotal / 2)),
          formatInteger(Math.round(maxTotal)),
        ]}
        rightAxisLabels={[
          t('progress.mood.poor'),
          t('progress.mood.okay'),
          t('progress.mood.great'),
        ]}
        xAxisLabels={xAxisLabels}
        // TODO: use i18n
        totalFormatter={(total) => `${formatInteger(Math.round(total))}g`}
        lineFormatter={(v) => moodLabels[Math.round(v)] ?? formatDecimal(v, 1)}
      />
    </ProgressChartSection>
  );
}
