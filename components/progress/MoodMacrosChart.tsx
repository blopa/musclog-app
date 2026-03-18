import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { MoodMacrosPoint, TimeAggregation } from '../../database/services/ProgressService';
import { useTheme } from '../../hooks/useTheme';
import { getXAxisLabels, getYAxisLabels } from '../../utils/chartUtils';
import { MultipleLinesChart } from '../charts/MultipleLinesChart';
import { ProgressChartSection } from './ProgressChartSection';

interface MoodMacrosChartProps {
  allData: Record<TimeAggregation, MoodMacrosPoint[]>;
}

const formatDate = (timestamp: number): string => {
  const d = new Date(timestamp);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function MoodMacrosChart({ allData }: MoodMacrosChartProps) {
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
      <ProgressChartSection title={t('progress.correlationView.moodMacros')}>
        {aggregationToggle}
        <View className="items-center justify-center py-10">
          <Text className="text-sm text-text-tertiary">{t('progress.noDataAvailable')}</Text>
        </View>
      </ProgressChartSection>
    );
  }

  const maxMacro = Math.max(...data.map((d) => Math.max(d.protein, d.carbs, d.fat)), 1);
  const maxY = maxMacro * 1.15;

  const chartData = data.map((d) => ({
    x: d.date,
    mood: d.mood * (maxY / 4), // scale mood (0-4) to the macro range for visual overlay
    protein: d.protein,
    carbs: d.carbs,
    fat: d.fat,
  }));

  const series = [
    {
      key: 'mood',
      label: t('progress.mood.moodScore'),
      color: theme.colors.status.indigo,
      dashed: true,
    },
    {
      key: 'protein',
      label: t('nutrition.protein'),
      color: theme.colors.macros.protein.bg,
    },
    {
      key: 'carbs',
      label: t('nutrition.carbs'),
      color: theme.colors.macros.carbs.bg,
    },
    {
      key: 'fat',
      label: t('nutrition.fat'),
      color: theme.colors.macros.fat.bg,
    },
  ];

  const xAxisLabels = getXAxisLabels(
    data.map((d) => ({ x: d.date })),
    formatDate
  );

  const yAxisLabels = getYAxisLabels(0, maxY, 4, (v) => `${Math.round(v)}g`);

  return (
    <ProgressChartSection title={t('progress.correlationView.moodMacros')}>
      {aggregationToggle}
      <MultipleLinesChart
        data={chartData}
        series={series}
        height={220}
        yDomain={[0, maxY]}
        xDomain={[data[0].date, data[data.length - 1].date]}
        xAxisLabels={xAxisLabels}
        yAxisLabels={yAxisLabels}
        interactive
        tooltipFormatter={(p) =>
          // TODO: have one translation i18n that will cover this whole sentence
          `${t('progress.mood.moodScore')}: ${(((p.mood as number) / maxY) * 4).toFixed(1)}\n${t('nutrition.protein')}: ${Math.round(p.protein as number)}g\n${t('nutrition.carbs')}: ${Math.round(p.carbs as number)}g\n${t('nutrition.fat')}: ${Math.round(p.fat as number)}g`
        }
      />
    </ProgressChartSection>
  );
}
