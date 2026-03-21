import { format, isThisWeek, isToday, isYesterday } from 'date-fns';
import type { TFunction } from 'i18next';
import { Calendar, Clock, Plus, SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { UserMetricService } from '../../database/services';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import type { UserMetricWithDecrypted } from '../../hooks/useUserMetrics';
import { useUserMetrics } from '../../hooks/useUserMetrics';
import { MetricType as AppMetricType } from '../../services/healthDataTransform';
import { getXAxisLabels } from '../../utils/chartUtils';
import { kgToDisplay, storedHeightToCm, storedWeightToKg } from '../../utils/unitConversion';
import { GenericCard } from '../cards/GenericCard';
import { HistoryBodyMetricCard } from '../cards/HistoryBodyMetricCard';
import { LineChart } from '../charts/LineChart';
import { Button } from '../theme/Button';
import { SegmentedControl } from '../theme/SegmentedControl';
import { SkeletonLoader } from '../theme/SkeletonLoader';
import AddUserMetricEntryModal from './AddUserMetricEntryModal';
import type { BodyMetricsHistoryFilters } from './BodyMetricsHistoryFilterMenu';
import { BodyMetricsHistoryFilterMenu, DEFAULT_FILTERS } from './BodyMetricsHistoryFilterMenu';
import { FullScreenModal } from './FullScreenModal';

// UI-facing metric keys
type UiMetricType = 'weight' | 'bodyFat' | 'bmi' | 'ffmi';
type TimePeriod = '30D' | '3M' | '1Y'; // TODO: add 6M

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
function formatRelativeDate(timestamp: number, t: TFunction): string {
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

type BodyMetricsHistoryModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function BodyMetricsHistoryModal({
  visible,
  onClose,
}: BodyMetricsHistoryModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { units } = useSettings();
  const [selectedMetric, setSelectedMetric] = useState<UiMetricType>('weight');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('30D');
  const [isAddMetricVisible, setIsAddMetricVisible] = useState(false);
  const [isFilterMenuVisible, setIsFilterMenuVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<BodyMetricsHistoryFilters>(DEFAULT_FILTERS);
  const scrollViewRef = useRef<ScrollView>(null);

  const isFilterActive =
    activeFilters.sortOrder !== DEFAULT_FILTERS.sortOrder ||
    activeFilters.trend !== DEFAULT_FILTERS.trend;

  const metricOptions = [
    { label: t('bodyMetrics.metrics.weight'), value: 'weight' },
    { label: t('bodyMetrics.metrics.bodyFat'), value: 'bodyFat' },
    { label: t('bodyMetrics.metrics.bmi'), value: 'bmi' },
    { label: t('bodyMetrics.metrics.ffmi'), value: 'ffmi' },
  ];

  // BMI and FFMI are derived from weight history + latest height (+ body fat for FFMI)
  const [latestHeightCm, setLatestHeightCm] = useState<number | null>(null);
  const [latestBodyFatPct, setLatestBodyFatPct] = useState<number | null>(null);

  useEffect(() => {
    if (selectedMetric !== 'bmi' && selectedMetric !== 'ffmi') {
      return;
    }

    UserMetricService.getLatest('height').then(async (m) => {
      if (!m) {
        setLatestHeightCm(null);
        return;
      }

      const dec = await m.getDecrypted();
      setLatestHeightCm(storedHeightToCm(dec.value, dec.unit));
    });

    if (selectedMetric === 'ffmi') {
      UserMetricService.getLatest('body_fat').then(async (m) => {
        if (!m) {
          setLatestBodyFatPct(null);
          return;
        }

        const dec = await m.getDecrypted();
        setLatestBodyFatPct(dec.value);
      });
    }
  }, [selectedMetric]);

  // Map UI metric keys to the DB type to fetch.
  // BMI and FFMI are computed from weight entries using the latest height (and body fat for FFMI).
  const mapUiMetricToAppMetric = (m: UiMetricType): AppMetricType => {
    switch (m) {
      case 'weight':
        return AppMetricType.WEIGHT;
      case 'bodyFat':
        return AppMetricType.BODY_FAT;
      case 'bmi':
      case 'ffmi':
        return AppMetricType.WEIGHT;
    }
  };

  // Calculate date range based on selected period
  const dateRange = useMemo(() => {
    const now = Date.now();
    let startDate = now;
    if (selectedPeriod === '30D') {
      startDate = now - 30 * 24 * 60 * 60 * 1000;
    } else if (selectedPeriod === '3M') {
      startDate = now - 90 * 24 * 60 * 60 * 1000;
    } else if (selectedPeriod === '1Y') {
      startDate = now - 365 * 24 * 60 * 60 * 1000;
    }
    return { startDate, endDate: now };
  }, [selectedPeriod]);

  // Use hook for paginated history (for list display)
  const {
    metrics: paginatedMetrics,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useUserMetrics({
    mode: 'history',
    metricType: mapUiMetricToAppMetric(selectedMetric),
    dateRange,
    initialLimit: 5,
    batchSize: 5,
    enableReactivity: true,
    visible,
  });

  // Use hook for all metrics (for chart display)
  const { metrics: allMetricsForChart } = useUserMetrics({
    mode: 'history',
    metricType: mapUiMetricToAppMetric(selectedMetric),
    dateRange,
    getAll: true,
    enableReactivity: false, // Chart doesn't need reactivity
    visible,
  });

  // Helper to get unit for metric type (uses settings for weight)
  const getMetricUnit = useCallback(
    (type: UiMetricType): string => {
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
    (type: UiMetricType): string => {
      return t(`bodyMetrics.metrics.${type}`);
    },
    [t]
  );

  // Helper to get display value. Returns null when a derived metric cannot be computed
  // (BMI: no height data; FFMI: no height or no body fat data).
  const getDisplayValue = useCallback(
    (value: number, storedUnit?: string | null): number | null => {
      if (selectedMetric === 'weight') {
        return kgToDisplay(storedWeightToKg(value, storedUnit), units);
      }

      if (selectedMetric === 'bmi' || selectedMetric === 'ffmi') {
        if (!latestHeightCm || latestHeightCm <= 0) {
          return null;
        }

        const weightKg = storedWeightToKg(value, storedUnit);
        const heightM = latestHeightCm / 100;

        if (selectedMetric === 'bmi') {
          return weightKg / (heightM * heightM);
        }

        // FFMI requires body fat — can't compute without it
        if (latestBodyFatPct === null) {
          return null;
        }

        const fatFreeMassKg = weightKg * (1 - latestBodyFatPct / 100);
        return fatFreeMassKg / (heightM * heightM);
      }
      return value;
    },
    [selectedMetric, units, latestHeightCm, latestBodyFatPct]
  );

  // Helper to process metrics into history entries
  const processMetricsToEntries = useCallback(
    (metrics: UserMetricWithDecrypted[], unit: string): HistoryEntry[] => {
      const entries: HistoryEntry[] = [];
      metrics.forEach((item, index) => {
        const metric = item.metric;
        const d = item.decrypted;
        const displayValue = getDisplayValue(d.value, d.unit);
        if (displayValue === null) {
          return;
        }

        const previous = index < metrics.length - 1 ? metrics[index + 1] : null;
        let change: string | null = null;
        let changeType: 'up' | 'down' | null = null;

        if (previous) {
          const prevDisplay = getDisplayValue(previous.decrypted.value, previous.decrypted.unit);
          if (prevDisplay !== null) {
            const diff = displayValue - prevDisplay;
            const absDiff = Math.abs(diff);
            if (absDiff > 0.01) {
              changeType = diff > 0 ? 'up' : 'down';
              const sign = diff > 0 ? '+' : '';
              change = `${sign}${absDiff.toFixed(selectedMetric === 'weight' || selectedMetric === 'bodyFat' ? 1 : 2)}${unit ? ` ${unit}` : ''}`;
            }
          }
        }

        const valueStr = `${displayValue % 1 === 0 ? displayValue : displayValue.toFixed(selectedMetric === 'weight' || selectedMetric === 'bodyFat' ? 1 : 2)}${unit ? ` ${unit}` : ''}`;

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

        entries.push({
          id: metric.id,
          date: formatRelativeDate(d.date, t),
          value: valueStr,
          change,
          changeType,
          note,
          icon: index === 0 ? Calendar : Calendar,
          iconColor: index === 0 ? theme.colors.text.primary : theme.colors.text.secondary,
          iconBg: index === 0 ? theme.colors.status.indigo600 : theme.colors.border.light,
          opacity: index === metrics.length - 1 ? 0.7 : 1,
        });
      });

      return entries;
    },
    [
      selectedMetric,
      t,
      theme.colors.border.light,
      theme.colors.status.indigo600,
      theme.colors.text.primary,
      theme.colors.text.secondary,
      getDisplayValue,
    ]
  );

  // Process paginated metrics into history entries
  const historyEntries = useMemo(() => {
    if (!paginatedMetrics || paginatedMetrics.length === 0) {
      return [];
    }
    const unit = getMetricUnit(selectedMetric);
    const entries = processMetricsToEntries(paginatedMetrics, unit);

    // Apply trend filter
    const trendFiltered =
      activeFilters.trend === 'all'
        ? entries
        : entries.filter((e) => {
            if (activeFilters.trend === 'increased') {
              return e.changeType === 'up';
            }
            if (activeFilters.trend === 'decreased') {
              return e.changeType === 'down';
            }
            // noChange
            return e.changeType === null;
          });

    // Apply sort order
    if (activeFilters.sortOrder === 'oldestFirst') {
      return [...trendFiltered].reverse();
    }
    return trendFiltered;
  }, [paginatedMetrics, selectedMetric, getMetricUnit, processMetricsToEntries, activeFilters]);

  // Get current metric data from latest entry (weight in display unit)
  const currentMetric = useMemo<MetricData | null>(() => {
    if (!paginatedMetrics || paginatedMetrics.length === 0) {
      return null;
    }
    const latest = paginatedMetrics[0];
    const d = latest.decrypted;
    const displayVal = getDisplayValue(d.value, d.unit);
    if (displayVal === null) {
      return null;
    }

    const unit = getMetricUnit(selectedMetric);

    return {
      current:
        displayVal % 1 === 0
          ? String(displayVal)
          : displayVal.toFixed(selectedMetric === 'weight' || selectedMetric === 'bodyFat' ? 1 : 2),
      unit,
      label: getMetricLabel(selectedMetric),
    };
  }, [paginatedMetrics, selectedMetric, getMetricUnit, getMetricLabel, getDisplayValue]);

  // Generate chart data from all metrics
  const chartData = useMemo(() => {
    if (!allMetricsForChart || allMetricsForChart.length === 0) {
      return [];
    }

    const sortedMetrics = [...allMetricsForChart].sort(
      (a, b) => a.decrypted.date - b.decrypted.date
    );

    const minValue = Math.min(...sortedMetrics.map((m) => m.decrypted.value));
    const maxValue = Math.max(...sortedMetrics.map((m) => m.decrypted.value));
    const range = maxValue - minValue || 1;
    const padding = range * 0.1;

    return sortedMetrics.map((metric, index) => {
      const normalizedY =
        ((metric.decrypted.value - minValue + padding) / (range + padding * 2)) * 150;
      // X-axis: distribute evenly across 400 width
      // Handle single data point case
      const normalizedX =
        sortedMetrics.length === 1 ? 200 : (index / (sortedMetrics.length - 1)) * 400;
      return { x: normalizedX, y: Math.max(0, Math.min(150, normalizedY)) };
    });
  }, [allMetricsForChart]);

  // Y-axis labels (min, mid, max) with display values
  const yAxisLabels = useMemo(() => {
    if (!allMetricsForChart || allMetricsForChart.length === 0) {
      return [];
    }

    const storedValues = allMetricsForChart.map((m) => m.decrypted.value);
    const minStored = Math.min(...storedValues);
    const maxStored = Math.max(...storedValues);
    const range = maxStored - minStored || 1;
    const padding = range * 0.1;

    const toDomainY = (v: number) =>
      Math.max(0, Math.min(150, ((v - minStored + padding) / (range + padding * 2)) * 150));

    const minMetric = allMetricsForChart.find((m) => m.decrypted.value === minStored);
    const maxMetric = allMetricsForChart.find((m) => m.decrypted.value === maxStored);
    const minDisplay = getDisplayValue(minStored, minMetric?.decrypted.unit);
    const maxDisplay = getDisplayValue(maxStored, maxMetric?.decrypted.unit);
    if (minDisplay === null || maxDisplay === null) {
      return [];
    }

    const midDisplay = (minDisplay + maxDisplay) / 2;

    const unit = getMetricUnit(selectedMetric);
    const fmt = (v: number) => {
      const decimals = selectedMetric === 'weight' || selectedMetric === 'bodyFat' ? 1 : 1;
      return unit ? `${v.toFixed(decimals)} ${unit}` : v.toFixed(decimals);
    };

    if (range < 0.01) {
      return [{ label: fmt(maxDisplay), yDomainValue: toDomainY(maxStored) }];
    }

    return [
      { label: fmt(maxDisplay), yDomainValue: toDomainY(maxStored) },
      { label: fmt(midDisplay), yDomainValue: toDomainY((minStored + maxStored) / 2) },
      { label: fmt(minDisplay), yDomainValue: toDomainY(minStored) },
    ];
  }, [allMetricsForChart, selectedMetric, getDisplayValue, getMetricUnit]);

  // X-axis labels from actual date range
  const xAxisLabels = useMemo(() => {
    if (!allMetricsForChart || allMetricsForChart.length === 0) {
      return [];
    }
    const sorted = [...allMetricsForChart].sort((a, b) => a.decrypted.date - b.decrypted.date);
    return getXAxisLabels(
      sorted.map((m) => ({ x: m.decrypted.date })),
      (x) => format(x, 'MMM d')
    );
  }, [allMetricsForChart]);

  const handleNewMetric = () => {
    setIsAddMetricVisible(true);
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
        ref={scrollViewRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: theme.colors.background.primary }}
        contentContainerStyle={{ backgroundColor: theme.colors.background.primary }}
      >
        <View className="mt-2 px-4">
          {/* Metric Selector */}
          <View className="mb-6">
            <SegmentedControl
              options={metricOptions}
              value={selectedMetric}
              onValueChange={(value) => setSelectedMetric(value as UiMetricType)}
              variant="elevated"
            />
          </View>

          {/* Current Metric Card */}
          <View className="mb-6">
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
                    xAxisLabels={xAxisLabels}
                    yAxisLabels={yAxisLabels}
                    onInteractionStart={() =>
                      scrollViewRef.current?.setNativeProps({ scrollEnabled: false })
                    }
                    onInteractionEnd={() =>
                      scrollViewRef.current?.setNativeProps({ scrollEnabled: true })
                    }
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
          </View>

          {/* History Section */}
          <View className="mb-6">
            <View className="mb-4 flex-row items-center justify-between px-1">
              <Text className="text-lg font-bold text-text-primary">
                {t('bodyMetrics.history.title')}
              </Text>
              <Pressable
                className="flex-row items-center gap-1"
                onPress={() => setIsFilterMenuVisible(true)}
              >
                <SlidersHorizontal
                  size={theme.iconSize.sm}
                  color={isFilterActive ? theme.colors.accent.primary : theme.colors.text.muted}
                />
                <Text
                  className="text-xs font-semibold"
                  style={{
                    color: isFilterActive
                      ? theme.colors.accent.primary
                      : theme.colors.text.tertiary,
                  }}
                >
                  {t('bodyMetrics.history.filter')}
                </Text>
                {isFilterActive ? (
                  <View
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: theme.colors.accent.primary }}
                  />
                ) : null}
              </Pressable>
            </View>

            {isLoading ? (
              <View className="mb-3">
                {/* Skeleton loaders for history entries */}
                {[1, 2, 3, 4, 5].map((i) => (
                  <View key={i} className="mb-3">
                    <GenericCard variant="card" size="default">
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
                  </View>
                ))}
              </View>
            ) : historyEntries.length > 0 ? (
              <View className="mb-3">
                {historyEntries.map((entry) => (
                  <View key={entry.id} className="mb-3">
                    <HistoryBodyMetricCard entry={entry} />
                  </View>
                ))}

                {/* Load More Button */}
                {hasMore ? (
                  <View className="py-4">
                    <Button
                      label={
                        isLoadingMore
                          ? t('bodyMetrics.history.loadingMore')
                          : t('bodyMetrics.history.loadMore')
                      }
                      onPress={loadMore}
                      size="sm"
                      variant="outline"
                      disabled={isLoadingMore}
                      loading={isLoadingMore}
                      width="full"
                      iconPosition="left"
                    />
                  </View>
                ) : null}
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
      <AddUserMetricEntryModal
        visible={isAddMetricVisible}
        onClose={() => setIsAddMetricVisible(false)}
      />
      <BodyMetricsHistoryFilterMenu
        visible={isFilterMenuVisible}
        onClose={() => setIsFilterMenuVisible(false)}
        onApplyFilters={setActiveFilters}
        onClearFilters={() => setActiveFilters(DEFAULT_FILTERS)}
        initialFilters={activeFilters}
      />
    </FullScreenModal>
  );
}
