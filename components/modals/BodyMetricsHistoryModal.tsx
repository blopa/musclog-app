import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SlidersHorizontal, Calendar, Clock, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { theme } from '../../theme';
import { VictoryChart, VictoryArea, VictoryLine, VictoryScatter, VictoryAxis } from 'victory';
import { SegmentedControl } from '../theme/SegmentedControl';
import { GenericCard } from '../cards/GenericCard';
import { HistoryBodyMetricCard } from '../cards/HistoryBodyMetricCard';
import { FullScreenModal } from './FullScreenModal';
import { Button } from '../theme/Button';
import { database } from '../../database';
import { Q } from '@nozbe/watermelondb';
import UserMetric from '../../database/models/UserMetric';

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

// Simple line chart component using Victory Native
type LineChartProps = {
  data: { x: number; y: number }[];
};

function LineChart({ data }: LineChartProps) {
  if (data.length === 0) {
    return null;
  }

  // Last data point for the circle marker
  const lastPoint = data[data.length - 1];

  return (
    <View className="relative mt-4 h-48 w-full">
      <VictoryChart
        height={192}
        padding={{ left: 0, right: 0, top: 0, bottom: 0 }}
        domain={{ x: [0, 400], y: [0, 150] }}
        style={{
          parent: {
            height: 192,
            width: '100%',
          },
        }}
      >
        {/* Grid lines - horizontal dashed lines */}
        <VictoryAxis
          dependentAxis
          style={{
            axis: { stroke: 'transparent' },
            grid: {
              stroke: theme.colors.border.light,
              strokeDasharray: '4,4',
              strokeWidth: 1,
            },
            ticks: { stroke: 'transparent' },
            tickLabels: { fill: 'transparent' },
          }}
          tickValues={[37.5, 75, 112.5]}
        />
        {/* Area fill with gradient */}
        <VictoryArea
          data={data}
          interpolation="monotoneX"
          style={{
            data: {
              fill: theme.colors.accent.primary30,
            },
          }}
        />
        {/* Line */}
        <VictoryLine
          data={data}
          interpolation="monotoneX"
          style={{
            data: {
              stroke: theme.colors.accent.primary,
              strokeWidth: 3,
              strokeLinecap: 'round',
            },
          }}
        />
        {/* Data point circle at the end */}
        <VictoryScatter
          data={[lastPoint]}
          size={10}
          style={{
            data: {
              fill: theme.colors.accent.primary,
              stroke: theme.colors.background.card,
              strokeWidth: 2,
            },
          }}
        />
        {/* Hidden independent axis (x-axis) */}
        <VictoryAxis
          style={{
            axis: { stroke: 'transparent' },
            grid: { stroke: 'transparent' },
            ticks: { stroke: 'transparent' },
            tickLabels: { fill: 'transparent' },
          }}
        />
      </VictoryChart>
      {/* Custom X-axis labels */}
      <View className="mt-4 flex-row justify-between px-1">
        {/* TODO: Date labels should be dynamic later on */}
        <Text className="text-[10px] font-medium text-text-tertiary">May 12</Text>
        <Text className="text-[10px] font-medium text-text-tertiary">May 26</Text>
        <Text className="text-[10px] font-medium text-text-tertiary">Jun 11</Text>
      </View>
    </View>
  );
}

type BodyMetricsHistoryModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function BodyMetricsHistoryModal({
  visible,
  onClose,
}: BodyMetricsHistoryModalProps) {
  const { t } = useTranslation();
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('weight');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('30D');
  const [isLoading, setIsLoading] = useState(false);
  const [currentMetric, setCurrentMetric] = useState<MetricData | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [chartData, setChartData] = useState<{ x: number; y: number }[]>([]);

  const metricOptions = [
    { label: t('bodyMetrics.metrics.weight'), value: 'weight' },
    { label: t('bodyMetrics.metrics.bodyFat'), value: 'bodyFat' },
    { label: t('bodyMetrics.metrics.bmi'), value: 'bmi' },
    { label: t('bodyMetrics.metrics.ffmi'), value: 'ffmi' },
  ];

  // Helper to get unit for metric type
  const getMetricUnit = (type: MetricType): string => {
    switch (type) {
      case 'weight':
        return 'kg';
      case 'bodyFat':
        return '%';
      case 'bmi':
      case 'ffmi':
        return '';
      default:
        return '';
    }
  };

  // Helper to get label for metric type
  const getMetricLabel = useCallback(
    (type: MetricType): string => {
      return t(`bodyMetrics.metrics.${type}`);
    },
    [t]
  );

  // Load metrics data
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

      // Fetch metrics for selected type within date range
      const metrics = await database
        .get<UserMetric>('user_metrics')
        .query(
          Q.where('type', selectedMetric),
          Q.where('date', Q.gte(startDate)),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('date', Q.desc)
        )
        .fetch();

      if (metrics.length === 0) {
        setCurrentMetric(null);
        setHistoryEntries([]);
        setChartData([]);
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
      const entries: HistoryEntry[] = metrics.map((metric, index) => {
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

      setHistoryEntries(entries);

      // Generate chart data (reverse for chronological order, normalize for chart)
      const sortedMetrics = [...metrics].reverse(); // Oldest to newest
      if (sortedMetrics.length > 0) {
        const minValue = Math.min(...sortedMetrics.map((m) => m.value));
        const maxValue = Math.max(...sortedMetrics.map((m) => m.value));
        const range = maxValue - minValue || 1; // Avoid division by zero
        const padding = range * 0.1; // 10% padding

        const normalizedData = sortedMetrics.map((metric, index) => {
          // Normalize y to 0-150 range for chart (matching original design)
          const normalizedY = ((metric.value - minValue + padding) / (range + padding * 2)) * 150;
          // X-axis: distribute evenly across 400 width
          const normalizedX = (index / (sortedMetrics.length - 1 || 1)) * 400;
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
    } finally {
      setIsLoading(false);
    }
  }, [getMetricLabel, selectedMetric, selectedPeriod, t]);

  // Load data when modal opens or metric/period changes
  useEffect(() => {
    if (visible) {
      loadMetricsData();
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
                <View className="mb-6 flex-row items-center justify-center">
                  <ActivityIndicator size="large" color={theme.colors.accent.primary} />
                </View>
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
                <LineChart data={chartData} />
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
                <ActivityIndicator size="small" color={theme.colors.accent.primary} />
              </View>
            ) : historyEntries.length > 0 ? (
              <View className="space-y-3">
                {historyEntries.map((entry) => (
                  <HistoryBodyMetricCard key={entry.id} entry={entry} />
                ))}
              </View>
            ) : (
              <Text className="py-4 text-center text-text-secondary">
                {t('bodyMetrics.noHistoryDataAvailable')}
              </Text>
            )}

            <Pressable className="w-full py-4">
              <Text className="text-center text-sm font-bold text-text-tertiary">
                {t('bodyMetrics.history.viewAll')}
              </Text>
            </Pressable>
          </View>

          {/* Bottom spacing for navigation */}
          <View className="h-24" />
        </View>
      </ScrollView>
    </FullScreenModal>
  );
}
