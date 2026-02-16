import { format, isThisWeek, isToday, isYesterday } from 'date-fns';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import UserMetric, { type UserMetricType } from '../database/models/UserMetric';
import { UserMetricService } from '../database/services';

export type UserMetricDataDisplayItem = {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  iconBgColor: string;
  metricValue: number;
  metricUnit?: string;
};

export type UserMetricDataDayGroup = {
  date: string;
  dateTimestamp: number;
  items: UserMetricDataDisplayItem[];
};

const BATCH_SIZE = 20;

const ICON_BY_TYPE: Partial<Record<UserMetricType, string>> = {
  weight: 'monitor-weight',
  body_fat: 'percent',
  height: 'straighten',
  bmi: 'trending-up',
  mood: 'mood',
  chest: 'straighten',
  waist: 'straighten',
  hips: 'straighten',
  arms: 'fitness-center',
  thighs: 'fitness-center',
  calves: 'fitness-center',
  neck: 'straighten',
  shoulders: 'fitness-center',
  muscle_mass: 'fitness-center',
  lean_body_mass: 'fitness-center',
  basal_metabolic_rate: 'local-fire-department',
  total_calories_burned: 'local-fire-department',
  active_calories_burned: 'local-fire-department',
  ffmi: 'trending-up',
};

const ICON_COLORS: Record<string, { color: string; bg: string }> = {
  'monitor-weight': { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  percent: { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  straighten: { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
  'trending-up': { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  mood: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  'fitness-center': { color: '#29e08e', bg: 'rgba(41, 224, 142, 0.1)' },
  'local-fire-department': { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
};

function formatRelativeDate(timestamp: number, t: TFunction): string {
  const date = new Date(timestamp);
  if (isToday(date)) {
    return t('common.today');
  }
  if (isYesterday(date)) {
    return t('common.yesterday');
  }
  if (isThisWeek(date)) {
    return format(date, 'EEEE');
  }
  return format(date, 'MMM d');
}

function getMetricTypeLabel(type: string, t: TFunction): string {
  const key = `bodyMetrics.metrics.${type}`;
  const translated = t(key);
  if (translated === key) {
    return type.replace(/_/g, ' ');
  }
  return translated;
}

function metricToDisplayItemWithT(metric: UserMetric, t: TFunction): UserMetricDataDisplayItem {
  const icon = ICON_BY_TYPE[metric.type as UserMetricType] ?? 'monitor-weight';
  const colors = ICON_COLORS[icon] ?? ICON_COLORS['monitor-weight'];

  return {
    id: metric.id,
    name: getMetricTypeLabel(metric.type, t),
    icon,
    iconColor: colors.color,
    iconBgColor: colors.bg,
    metricValue: metric.value,
    metricUnit: metric.unit,
  };
}

function groupMetricsByDate(
  items: { item: UserMetricDataDisplayItem; dateTimestamp: number }[],
  t: TFunction
): UserMetricDataDayGroup[] {
  const groupMap = new Map<number, UserMetricDataDisplayItem[]>();

  items.forEach(({ item, dateTimestamp }) => {
    if (!groupMap.has(dateTimestamp)) {
      groupMap.set(dateTimestamp, []);
    }
    groupMap.get(dateTimestamp)!.push(item);
  });

  return Array.from(groupMap.entries())
    .map(([dateTimestamp, items]) => ({
      date: formatRelativeDate(dateTimestamp, t),
      dateTimestamp,
      items,
    }))
    .sort((a, b) => b.dateTimestamp - a.dateTimestamp);
}

function mergeIntoDayGroups(
  existing: UserMetricDataDayGroup[],
  newItemsWithDates: { item: UserMetricDataDisplayItem; dateTimestamp: number }[],
  t: TFunction
): UserMetricDataDayGroup[] {
  const groupMap = new Map<number, UserMetricDataDisplayItem[]>();
  const existingIds = new Set<string>();

  existing.forEach((g) => {
    groupMap.set(g.dateTimestamp, [...g.items]);
    g.items.forEach((i) => existingIds.add(i.id));
  });

  newItemsWithDates.forEach(({ item, dateTimestamp }) => {
    if (existingIds.has(item.id)) return;
    existingIds.add(item.id);

    if (!groupMap.has(dateTimestamp)) {
      groupMap.set(dateTimestamp, []);
    }
    groupMap.get(dateTimestamp)!.push(item);
  });

  return Array.from(groupMap.entries())
    .map(([dateTimestamp, items]) => ({
      date: formatRelativeDate(dateTimestamp, t),
      dateTimestamp,
      items: items.sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => b.dateTimestamp - a.dateTimestamp);
}

function filterDayGroupsBySearch(
  groups: UserMetricDataDayGroup[],
  searchQuery: string
): UserMetricDataDayGroup[] {
  if (!searchQuery.trim()) return groups;

  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
      ),
    }))
    .filter((g) => g.items.length > 0);
}

export interface UseUserMetricDataLogsParams {
  visible?: boolean;
  batchSize?: number;
  searchQuery?: string;
}

export interface UseUserMetricDataLogsResult {
  dayGroups: UserMetricDataDayGroup[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useUserMetricDataLogs({
  visible = true,
  batchSize = BATCH_SIZE,
  searchQuery = '',
}: UseUserMetricDataLogsParams = {}): UseUserMetricDataLogsResult {
  const { t } = useTranslation();
  const [dayGroups, setDayGroups] = useState<UserMetricDataDayGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const loadInitial = useCallback(async () => {
    if (!visible) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setOffset(0);

    try {
      const metrics = await UserMetricService.getMetricsHistory(undefined, undefined, batchSize, 0);
      const results = metrics.map((metric) => ({
        item: metricToDisplayItemWithT(metric, t),
        dateTimestamp: metric.date,
      }));
      const groups = groupMetricsByDate(results, t);
      setDayGroups(groups);
      setHasMore(metrics.length === batchSize);
      setOffset(metrics.length);
    } catch (err) {
      console.error('Error loading user metric data logs:', err);
      setDayGroups([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [visible, batchSize, t]);

  const loadMore = useCallback(async () => {
    if (!visible || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);

    try {
      const metrics = await UserMetricService.getMetricsHistory(
        undefined,
        undefined,
        batchSize,
        offset
      );
      if (metrics.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const results = metrics.map((metric) => ({
        item: metricToDisplayItemWithT(metric, t),
        dateTimestamp: metric.date,
      }));

      setDayGroups((prev) => mergeIntoDayGroups(prev, results, t));
      setHasMore(metrics.length === batchSize);
      setOffset((prev) => prev + metrics.length);
    } catch (err) {
      console.error('Error loading more user metric data logs:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [visible, isLoadingMore, hasMore, offset, batchSize, t]);

  const refresh = useCallback(async () => {
    if (isLoading) return;
    await loadInitial();
  }, [loadInitial, isLoading]);

  useEffect(() => {
    if (!visible) return;
    loadInitial();
  }, [visible, loadInitial]);

  const filteredGroups = useMemo(
    () => filterDayGroupsBySearch(dayGroups, searchQuery),
    [dayGroups, searchQuery]
  );

  return {
    dayGroups: filteredGroups,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh,
  };
}
