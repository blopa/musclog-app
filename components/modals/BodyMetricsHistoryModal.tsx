import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SlidersHorizontal, Calendar, Clock, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { theme } from '../../theme';
import { LineChart } from '../LineChart';
import { SegmentedControl } from '../theme/SegmentedControl';
import { GenericCard } from '../cards/GenericCard';
import { HistoryBodyMetricCard } from '../cards/HistoryBodyMetricCard';
import { FullScreenModal } from './FullScreenModal';
import { Button } from '../theme/Button';
import { database } from '../../database';
import { Q } from '@nozbe/watermelondb';
import UserMetric from '../../database/models/UserMetric';
import { SkeletonLoader } from '../theme/SkeletonLoader';
import { useSettings } from '../../hooks/useSettings';

type MetricType = 'weight' | 'bodyFat' | 'bmi' | 'ffmi';
type TimePeriod = '30D' | '3M' | '1Y';

type HistoryEntry = {
  id: string;
  date: string;
  value: string;
  change: string | null;
  changeType: 'up' | 'down' | null;
  note: string;
  icon: typeof Calendar | typeof Clock;
  iconColor: string;
  iconBg: string;
  opacity?: number;
};

type MetricData = {
  current: string;
  unit: string;
  label: string;
};

// Helper function to format relative date
function formatRelativeDate(timestamp: number, t: (key: string) => string): string {
  const date = new Date(timestamp);
  const timeStr = format(date, 'hh:mm a');

  if (isToday(date)) {
    return `${t('bodyMetrics.dateFormats.today')}, ${timeStr}`;
  }
  if (isYesterday(date)) {
    return `${t('bodyMetrics.dateFormats.yesterday')}, ${timeStr}`;
  }
  if (isThisWeek(date)) {
    return `${format(date, 'EEE')}, ${timeStr}`;
  }
  return format(date, 'MMM d, hh:mm a');
}

const BATCH_SIZE = 5;

type BodyMetricsHistoryModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function BodyMetricsHistoryModal({
  visible,
  onClose,
}: BodyMetricsHistoryModalProps) {
  const { t } = useTranslation();
  const { units } = useSettings();
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('weight');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('30D');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentMetric, setCurrentMetric] = useState<MetricData | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [chartData, setChartData] = useState<{ x: number; y: number }[]>([]);
  // Pagination state for each metric type
  const [pageOffsets, setPageOffsets] = useState<Record<MetricType, number>>({
    weight: 0,
    bodyFat: 0,
    bmi: 0,
    ffmi: 0,
  });
  const [hasMore, setHasMore] = useState<Record<MetricType, boolean>>({
    weight: true,
    bodyFat: true,
    bmi: true,
    ffmi: true,
  });

  const metricOptions = [
    { label: t('bodyMetrics.metrics.weight'), value: 'weight' },
    { label: t('bodyMetrics.metrics.bodyFat'), value: 'bodyFat' },
    { label: t('bodyMetrics.metrics.bmi'), value: 'bmi' },
    { label: t('bodyMetrics.metrics.ffmi'), value: 'ffmi' },
  ];

  // Helper to get unit for metric type (uses settings for weight)
  const getMetricUnit = useCallback(
    (type: MetricType): string => {
      switch (type) {
        case 'weight':
          return units === 'imperial' ? 'lbs' : 'kg';
        case 'bodyFat':
          return '%';
        case 'bmi':
        case 'ffmi':
          return '';
        default:
          return '';
      }
    },
    [units]
  );

  // Helper to get label for metric type
  const getMetricLabel = useCallback(
    (type: MetricType): string => {
      return t(`bodyMetrics.metrics.${type}`);
    },
    [t]
  );

  // Helper to process metrics into history entries
  const processMetricsToEntries = useCallback(
    (metrics: UserMetric[], unit: string): HistoryEntry[] => {
      return metrics.map((metric, index) => {
        const previous = index < metrics.length - 1 ? metrics[index + 1] : null;
        let change: string | null = null;
        let changeType: 'up' | 'down' | null = null;

        if (previous) {
          const diff = metric.value - previous.value;
          const absDiff = Math.abs(diff);
          if (absDiff > 0.01) {
            changeType = diff > 0 ? 'up' : 'down';
            const sign = diff > 0 ? '+' : '';
            change = `${sign}${absDiff.toFixed(selectedMetric === 'weight' || selectedMetric === 'bodyFat' ? 1 : 2)} ${unit}`;
          }
        }

        // Format value with unit
        const valueStr = `${metric.value.toFixed(selectedMetric === 'weight' || selectedMetric === 'bodyFat' ? 1 : 2)}${unit ? ` ${unit}` : ''}`;

        // Determine note based on context
        let note = '';
        if (index === metrics.length - 1) {
          note = t('bodyMetrics.history.notes.baseline');
        } else if (!change) {
          note = t('bodyMetrics.history.notes.noChange');
        } else {
          note =
            changeType === 'down'
              ? t('bodyMetrics.history.notes.decreased')
              : t('bodyMetrics.history.notes.increased');
        }

        return {
          id: metric.id,
          date: formatRelativeDate(metric.date, t),
          value: valueStr,
          change,
          changeType,
          note,
          icon: index === 0 ? Calendar : Calendar,
          iconColor: index === 0 ? theme.colors.text.primary : theme.colors.text.secondary,
          iconBg: index === 0 ? theme.colors.status.indigo600 : theme.colors.border.light,
          opacity: index === metrics.length - 1 ? 0.7 : 1,
        };
      });
    },
    [selectedMetric, t, getMetricUnit]
  );

  // Load metrics data (initial load - only 5 entries)
  const loadMetricsData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Calculate date range based on selected period
      const now = Date.now();
      let startDate = now;
      if (selectedPeriod === '30D') {
        startDate = now - 30 * 24 * 60 * 60 * 1000;
      } else if (selectedPeriod === '3M') {
        startDate = now - 90 * 24 * 60 * 60 * 1000;
      } else if (selectedPeriod === '1Y') {
        startDate = now - 365 * 24 * 60 * 60 * 1000;
      }

      // Reset pagination for this metric type
      setPageOffsets((prev) => ({ ...prev, [selectedMetric]: 0 }));
      setHasMore((prev) => ({ ...prev, [selectedMetric]: true }));

      // Fetch initial batch (5 metrics) for selected type within date range
      let query = database
        .get<UserMetric>('user_metrics')
        .query(
          Q.where('type', selectedMetric),
          Q.where('date', Q.gte(startDate)),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('date', Q.desc)
        );

      // Apply pagination
      query = query.extend(Q.take(BATCH_SIZE));

      const metrics = await query.fetch();

      if (metrics.length === 0) {
        setCurrentMetric(null);
        setHistoryEntries([]);
        setChartData([]);
        setHasMore((prev) => ({ ...prev, [selectedMetric]: false }));
        return;
      }

      // Get current (latest) metric
      const latest = metrics[0];
      const unit = latest.unit || getMetricUnit(selectedMetric);
      setCurrentMetric({
        current: latest.value.toFixed(
          selectedMetric === 'weight' || selectedMetric === 'bodyFat' ? 1 : 2
        ),
        unit,
        label: getMetricLabel(selectedMetric),
      });

      // Create history entries with changes
      const entries = processMetricsToEntries(metrics, unit);
      setHistoryEntries(entries);

      // Update pagination state
      setPageOffsets((prev) => ({ ...prev, [selectedMetric]: metrics.length }));

      // Check if there are more metrics
      if (metrics.length < BATCH_SIZE) {
        setHasMore((prev) => ({ ...prev, [selectedMetric]: false }));
      } else {
        // Check if there's at least one more metric
        const nextBatch = await database
          .get<UserMetric>('user_metrics')
          .query(
            Q.where('type', selectedMetric),
            Q.where('date', Q.gte(startDate)),
            Q.where('deleted_at', Q.eq(null)),
            Q.sortBy('date', Q.desc),
            Q.skip(metrics.length),
            Q.take(1)
          )
          .fetch();
        setHasMore((prev) => ({ ...prev, [selectedMetric]: nextBatch.length > 0 }));
      }

      // For chart, we need ALL metrics for the selected period (not paginated)
      // This ensures the chart shows the complete trend over time
      const chartMetrics = await database
        .get<UserMetric>('user_metrics')
        .query(
          Q.where('type', selectedMetric),
          Q.where('date', Q.gte(startDate)),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('date', Q.asc) // Sort ascending (oldest to newest) for chart
        )
        .fetch();

      // Generate chart data (already in chronological order from oldest to newest)
      if (chartMetrics.length > 0) {
        const minValue = Math.min(...chartMetrics.map((m) => m.value));
        const maxValue = Math.max(...chartMetrics.map((m) => m.value));
        const range = maxValue - minValue || 1; // Avoid division by zero
        const padding = range * 0.1; // 10% padding

        const normalizedData = chartMetrics.map((metric, index) => {
          // Normalize y to 0-150 range for chart (matching original design)
          const normalizedY = ((metric.value - minValue + padding) / (range + padding * 2)) * 150;
          // X-axis: distribute evenly across 400 width
          // Handle single data point case
          const normalizedX =
            chartMetrics.length === 1 ? 200 : (index / (chartMetrics.length - 1)) * 400;
          return { x: normalizedX, y: Math.max(0, Math.min(150, 150 - normalizedY)) }; // Invert Y for chart
        });

        setChartData(normalizedData);
      } else {
        setChartData([]);
      }
    } catch (error) {
      console.error('Error loading metrics data:', error);
      setCurrentMetric(null);
      setHistoryEntries([]);
      setChartData([]);
      setHasMore((prev) => ({ ...prev, [selectedMetric]: false }));
    } finally {
      setIsLoading(false);
    }
  }, [getMetricLabel, selectedMetric, selectedPeriod, t, processMetricsToEntries]);

  // Load more history entries
  const loadMoreHistory = useCallback(async () => {
    if (isLoadingMore || !hasMore[selectedMetric]) {
      return;
    }

    setIsLoadingMore(true);

    // Small delay to ensure React processes the state update
    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    try {
      // Calculate date range based on selected period
      const now = Date.now();
      let startDate = now;
      if (selectedPeriod === '30D') {
        startDate = now - 30 * 24 * 60 * 60 * 1000;
      } else if (selectedPeriod === '3M') {
        startDate = now - 90 * 24 * 60 * 60 * 1000;
      } else if (selectedPeriod === '1Y') {
        startDate = now - 365 * 24 * 60 * 60 * 1000;
      }

      const currentOffset = pageOffsets[selectedMetric];

      // Fetch next batch
      const metrics = await database
        .get<UserMetric>('user_metrics')
        .query(
          Q.where('type', selectedMetric),
          Q.where('date', Q.gte(startDate)),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('date', Q.desc),
          Q.skip(currentOffset),
          Q.take(BATCH_SIZE)
        )
        .fetch();

      if (metrics.length === 0) {
        setHasMore((prev) => ({ ...prev, [selectedMetric]: false }));
        setIsLoadingMore(false);
        return;
      }

      // Process new entries
      const unit = getMetricUnit(selectedMetric);
      const newEntries = processMetricsToEntries(metrics, unit);

      // Append to existing entries
      setHistoryEntries((prev) => [...prev, ...newEntries]);

      // Update pagination state
      const newOffset = currentOffset + metrics.length;
      setPageOffsets((prev) => ({ ...prev, [selectedMetric]: newOffset }));

      // Check if there are more metrics
      if (metrics.length < BATCH_SIZE) {
        setHasMore((prev) => ({ ...prev, [selectedMetric]: false }));
      } else {
        // Check if there's at least one more metric
        const nextBatch = await database
          .get<UserMetric>('user_metrics')
          .query(
            Q.where('type', selectedMetric),
            Q.where('date', Q.gte(startDate)),
            Q.where('deleted_at', Q.eq(null)),
            Q.sortBy('date', Q.desc),
            Q.skip(newOffset),
            Q.take(1)
          )
          .fetch();
        setHasMore((prev) => ({ ...prev, [selectedMetric]: nextBatch.length > 0 }));
      }
    } catch (error) {
      console.error('Error loading more history:', error);
      setHasMore((prev) => ({ ...prev, [selectedMetric]: false }));
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    isLoadingMore,
    hasMore,
    selectedMetric,
    selectedPeriod,
    pageOffsets,
    getMetricUnit,
    processMetricsToEntries,
  ]);

  // Load data when modal opens or metric/period changes
  useEffect(() => {
    if (visible) {
      // Reset loading state immediately when modal opens for instant feedback
      setIsLoading(true);
      setCurrentMetric(null);
      setHistoryEntries([]);
      setChartData([]);
      // Use setTimeout to defer data loading slightly, allowing modal to render first
      // This makes the modal feel instant and snappy
      const timeoutId = setTimeout(() => {
        loadMetricsData();
      }, 0);

      return () => {
        clearTimeout(timeoutId);
      };
    } else {
      // Reset state when modal closes
      setIsLoading(false);
      setCurrentMetric(null);
      setHistoryEntries([]);
      setChartData([]);
      setIsLoadingMore(false);
    }
  }, [visible, selectedMetric, selectedPeriod, loadMetricsData]);

  const handleNewMetric = () => {
    // TODO: Open add new metric modal or form
    console.log('New metric pressed');
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('bodyMetrics.header.title')}
      headerRight={
        <Button
          label={t('bodyMetrics.header.newMetric')}
          icon={Plus}
          iconPosition="left"
          variant="gradientCta"
          size="sm"
          onPress={handleNewMetric}
        />
      }
      scrollable={false}
    >
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: theme.colors.background.primary }}
        contentContainerStyle={{ backgroundColor: theme.colors.background.primary }}
      >
        <View className="mt-2 space-y-6 px-4">
          {/* Metric Selector */}
          <SegmentedControl
            options={metricOptions}
            value={selectedMetric}
            onValueChange={(value) => setSelectedMetric(value as MetricType)}
            variant="gradient"
          />

          {/* Current Metric Card */}
          {isLoading ? (
            <GenericCard variant="card" size="default">
              <View className="p-5">
                <View className="mb-6 flex-row items-center justify-between">
                  <View className="flex-1 gap-2">
                    <SkeletonLoader width={theme.size['24']} height={theme.size['3']} />
                    <View className="flex-row items-baseline gap-2">
                      <SkeletonLoader width={theme.size['20']} height={theme.size['8']} />
                      <SkeletonLoader width={theme.size['8']} height={theme.size['5']} />
                    </View>
                  </View>
                  <View
                    className="flex-row gap-1 rounded-lg p-1"
                    style={{ backgroundColor: theme.colors.background.gray800Opacity50 }}
                  >
                    <SkeletonLoader
                      width={theme.size['12']}
                      height={theme.size['6']}
                      borderRadius={theme.borderRadius.md}
                    />
                    <SkeletonLoader
                      width={theme.size['12']}
                      height={theme.size['6']}
                      borderRadius={theme.borderRadius.md}
                    />
                    <SkeletonLoader
                      width={theme.size['12']}
                      height={theme.size['6']}
                      borderRadius={theme.borderRadius.md}
                    />
                  </View>
                </View>
                {/* Chart skeleton */}
                <SkeletonLoader
                  width="100%"
                  height={theme.size['40']}
                  borderRadius={theme.borderRadius.lg}
                />
              </View>
            </GenericCard>
          ) : currentMetric ? (
            <GenericCard variant="card" size="default">
              <View className="p-5">
                <View className="mb-6 flex-row items-center justify-between">
                  <View>
                    <Text className="mb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
                      {`${t('bodyMetrics.current.label')} ${currentMetric.label}`}
                    </Text>
                    <View className="flex-row items-baseline gap-1">
                      <Text className="text-3xl font-extrabold text-text-primary">
                        {currentMetric.current}
                      </Text>
                      {currentMetric.unit && currentMetric.unit.length > 0 ? (
                        <Text className="ml-1 text-lg font-medium text-text-tertiary">
                          {currentMetric.unit}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View
                    className="flex-row rounded-lg p-1"
                    style={{ backgroundColor: theme.colors.background.gray800Opacity50 }}
                  >
                    <Pressable
                      onPress={() => setSelectedPeriod('30D')}
                      className={`rounded-md px-3 py-1 ${selectedPeriod === '30D' ? '' : ''}`}
                      style={
                        selectedPeriod === '30D'
                          ? {
                              backgroundColor: theme.colors.accent.primary10,
                            }
                          : {}
                      }
                    >
                      <Text
                        className={`text-[10px] font-bold ${
                          selectedPeriod === '30D' ? 'text-accent-primary' : 'text-text-tertiary'
                        }`}
                      >
                        30D
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setSelectedPeriod('3M')}
                      className={`rounded-md px-3 py-1 ${selectedPeriod === '3M' ? '' : ''}`}
                      style={
                        selectedPeriod === '3M'
                          ? {
                              backgroundColor: theme.colors.accent.primary10,
                            }
                          : {}
                      }
                    >
                      <Text
                        className={`text-[10px] font-bold ${
                          selectedPeriod === '3M' ? 'text-accent-primary' : 'text-text-tertiary'
                        }`}
                      >
                        3M
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setSelectedPeriod('1Y')}
                      className={`rounded-md px-3 py-1 ${selectedPeriod === '1Y' ? '' : ''}`}
                      style={
                        selectedPeriod === '1Y'
                          ? {
                              backgroundColor: theme.colors.accent.primary10,
                            }
                          : {}
                      }
                    >
                      <Text
                        className={`text-[10px] font-bold ${
                          selectedPeriod === '1Y' ? 'text-accent-primary' : 'text-text-tertiary'
                        }`}
                      >
                        1Y
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Chart */}
                <LineChart
                  data={chartData}
                  xAxisLabels={['May 12', 'May 26', 'Jun 11']} // TODO: Make these dynamic based on actual dates
                />
              </View>
            </GenericCard>
          ) : (
            <GenericCard variant="card" size="default">
              <View className="p-5">
                <Text className="text-center text-text-secondary">
                  {t('bodyMetrics.noDataAvailable')}
                </Text>
              </View>
            </GenericCard>
          )}

          {/* History Section */}
          <View className="space-y-4">
            <View className="flex-row items-center justify-between px-1">
              <Text className="text-lg font-bold text-text-primary">
                {t('bodyMetrics.history.title')}
              </Text>
              <Pressable className="flex-row items-center gap-1">
                <SlidersHorizontal size={theme.iconSize.sm} color={theme.colors.text.muted} />
                <Text className="text-xs font-semibold text-text-tertiary">
                  {t('bodyMetrics.history.filter')}
                </Text>
              </Pressable>
            </View>

            {isLoading ? (
              <View className="space-y-3">
                {/* Skeleton loaders for history entries */}
                {[1, 2, 3, 4, 5].map((i) => (
                  <GenericCard key={i} variant="card" size="default">
                    <View className="flex-row items-center justify-between p-5">
                      <View className="flex-1 flex-row items-center gap-4">
                        <SkeletonLoader
                          width={theme.size['10']}
                          height={theme.size['10']}
                          borderRadius={theme.borderRadius.full}
                        />
                        <View className="flex-1 gap-2">
                          <SkeletonLoader width="60%" height={theme.size['3']} />
                          <SkeletonLoader width="40%" height={theme.size['5']} />
                        </View>
                      </View>
                      <SkeletonLoader
                        width={theme.size['16']}
                        height={theme.size['6']}
                        borderRadius={theme.borderRadius.full}
                      />
                    </View>
                  </GenericCard>
                ))}
              </View>
            ) : historyEntries.length > 0 ? (
              <View className="space-y-3">
                {historyEntries.map((entry) => (
                  <HistoryBodyMetricCard key={entry.id} entry={entry} />
                ))}

                {/* Load More Button */}
                {hasMore[selectedMetric] && (
                  <View className="py-4">
                    <Button
                      label={
                        isLoadingMore
                          ? t('bodyMetrics.history.loadingMore')
                          : t('bodyMetrics.history.loadMore')
                      }
                      onPress={loadMoreHistory}
                      size="sm"
                      variant="outline"
                      disabled={isLoadingMore}
                      loading={isLoadingMore}
                      width="full"
                      iconPosition="left"
                    />
                  </View>
                )}
              </View>
            ) : (
              <Text className="py-4 text-center text-text-secondary">
                {t('bodyMetrics.noHistoryDataAvailable')}
              </Text>
            )}
          </View>

          {/* Bottom spacing for navigation */}
          <View className="h-24" />
        </View>
      </ScrollView>
    </FullScreenModal>
  );
}
