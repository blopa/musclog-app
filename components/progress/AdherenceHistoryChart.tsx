import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { LineChart } from '@/components/charts/LineChart';
import { AdherencePoint, TimeAggregation } from '@/database/services/ProgressService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { formatLocalCalendarMonthDayNumericIntl } from '@/utils/calendarDate';
import { getXAxisLabels } from '@/utils/chartUtils';

import { ProgressChartSection } from './ProgressChartSection';

interface AdherenceHistoryChartProps {
  allData: Record<TimeAggregation, AdherencePoint[]>;
  title: string;
  subtitle?: string;
  positiveLabel: string;
  negativeLabel: string;
  lineColor?: string;
  areaColor?: string;
}

export function AdherenceHistoryChart({
  allData,
  title,
  subtitle,
  positiveLabel,
  negativeLabel,
  lineColor,
  areaColor,
}: AdherenceHistoryChartProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
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
      <ProgressChartSection title={title} subtitle={subtitle}>
        {aggregationToggle}
        <View className="items-center justify-center py-10">
          <Text className="text-sm text-text-tertiary">{t('progress.noDataAvailable')}</Text>
        </View>
      </ProgressChartSection>
    );
  }

  const chartData = data.map((d) => ({ x: d.date, y: d.adherence }));
  const xAxisLabels = getXAxisLabels(
    data.map((d) => ({ x: d.date })),
    (x) => formatLocalCalendarMonthDayNumericIntl(x, i18n.language)
  );

  return (
    <ProgressChartSection title={title} subtitle={subtitle}>
      {aggregationToggle}
      <LineChart
        data={chartData}
        height={200}
        yDomain={[0, 1]}
        xDomain={[data[0].date, data[data.length - 1].date]}
        lineColor={lineColor ?? theme.colors.status.info}
        areaColor={areaColor ?? theme.colors.status.info10}
        xAxisLabels={xAxisLabels}
        yAxisLabels={[
          { label: positiveLabel, yDomainValue: 1 },
          { label: negativeLabel, yDomainValue: 0 },
        ]}
        interactive
        tooltipFormatter={(point) => {
          if (point.y >= 0.999) {
            return positiveLabel;
          }
          if (point.y <= 0.001) {
            return negativeLabel;
          }
          return `${formatInteger(Math.round(point.y * 100))}%`;
        }}
      />
    </ProgressChartSection>
  );
}
