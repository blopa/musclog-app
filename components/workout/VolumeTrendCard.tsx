import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { LineChart, type LineChartDataPoint } from '@/components/charts/LineChart';
import { useTheme } from '@/hooks/useTheme';
import type { XAxisLabel } from '@/utils/chartUtils';

type VolumeTrendCardProps = {
  percentage: number;
  data: LineChartDataPoint[];
  labels: XAxisLabel[];
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
};

export function VolumeTrendCard({
  percentage,
  data,
  labels,
  onInteractionStart,
  onInteractionEnd,
}: VolumeTrendCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <GenericCard variant="flat">
      <View style={{ padding: theme.spacing.padding.base }}>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-text-primary">
            {t('workoutDetail.volumeTrend')}
          </Text>
          <View
            className="rounded-tag px-2 py-0.5"
            style={{ backgroundColor: theme.colors.accent.primary10 }}
          >
            <Text className="text-xs font-semibold text-accent-primary">
              {t('workoutDetail.volumeTrendPercentage', { percentage })}
            </Text>
          </View>
        </View>
        <LineChart
          data={data}
          height={128}
          chartWidth={400}
          chartHeight={100}
          // The points are indexed 0..n-1, not pixels, so the domain has to match or they pile up on the left.
          xDomain={[0, Math.max(data.length - 1, 1)]}
          lineColor={theme.colors.accent.primary}
          areaColor={theme.colors.accent.primary30}
          xAxisLabels={labels}
          marginTop={8}
          marginBottom={8}
          onInteractionStart={onInteractionStart}
          onInteractionEnd={onInteractionEnd}
        />
      </View>
    </GenericCard>
  );
}
