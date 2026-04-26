import type { Locale } from 'date-fns';
import { format, isThisWeek, isToday, isYesterday } from 'date-fns';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Units } from '@/constants/settings';
import UserMetric, { type UserMetricType } from '@/database/models/UserMetric';
import { UserMetricService } from '@/database/services';
import { metricDisplayUnit, metricValueToDisplay, storedWeightToKg } from '@/utils/unitConversion';

import { useDateFnsLocale } from './useDateFnsLocale';
import { useSettings } from './useSettings';
import { useTheme } from './useTheme';

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
  water: 'water-drop',
  supplement: 'medication',
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

function formatRelativeDate(timestamp: number, t: TFunction, locale: Locale): string {
  const date = new Date(timestamp);
  if (isToday(date)) {
    return t('common.today');
  }
  if (isYesterday(date)) {
    return t('common.yesterday');
  }
  if (isThisWeek(date)) {
    return format(date, 'EEEE', { locale });
  }
  return format(date, 'MMM d', { locale });
}

function getMetricTypeLabel(type: string, t: TFunction): string {
  const key = `bodyMetrics.metrics.${type}`;
  const translated = t(key);
  if (translated === key) {
    return type.replace(/_/g, ' ');
  }
  return translated;
}

function metricToDisplayItem(
  metric: UserMetric,
  decrypted: { value: number; unit?: string },
  t: TFunction,
  iconColors: Record<string, { color: string; bg: string }>,
  units: Units
): UserMetricDataDisplayItem {
  const icon = ICON_BY_TYPE[metric.type as UserMetricType] ?? 'monitor-weight';
  const colors = iconColors[icon] ?? iconColors['monitor-weight'];

  // Normalize legacy stored units then convert to the user's display system
  const type = metric.type;
  let valueInMetric = decrypted.value;
  if (type === 'weight') {
    valueInMetric = storedWeightToKg(decrypted.value, decrypted.unit);
  }
  const displayValue = metricValueToDisplay(valueInMetric, type, units);
  const displayUnit = metricDisplayUnit(type, units, decrypted.unit);

  return {
    id: metric.id,
    name: getMetricTypeLabel(metric.type, t),
    icon,
    iconColor: colors.color,
    iconBgColor: colors.bg,
    metricValue: displayValue,
    metricUnit: displayUnit,
  };
}

function groupMetricsByDate(
  items: { item: UserMetricDataDisplayItem; dateTimestamp: number }[],
  t: TFunction,
  locale: Locale
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
      date: formatRelativeDate(dateTimestamp, t, locale),
      dateTimestamp,
      items,
    }))
    .sort((a, b) => b.dateTimestamp - a.dateTimestamp);
}

function mergeIntoDayGroups(
  existing: UserMetricDataDayGroup[],
  newItemsWithDates: { item: UserMetricDataDisplayItem; dateTimestamp: number }[],
  t: TFunction,
  locale: Locale
): UserMetricDataDayGroup[] {
  const groupMap = new Map<number, UserMetricDataDisplayItem[]>();
  const existingIds = new Set<string>();

  existing.forEach((g) => {
    groupMap.set(g.dateTimestamp, [...g.items]);
    g.items.forEach((i) => existingIds.add(i.id));
  });

  newItemsWithDates.forEach(({ item, dateTimestamp }) => {
    if (existingIds.has(item.id)) {
      return;
    }
    existingIds.add(item.id);

    if (!groupMap.has(dateTimestamp)) {
      groupMap.set(dateTimestamp, []);
    }
    groupMap.get(dateTimestamp)!.push(item);
  });

  return Array.from(groupMap.entries())
    .map(([dateTimestamp, items]) => ({
      date: formatRelativeDate(dateTimestamp, t, locale),
      dateTimestamp,
      items: items.sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => b.dateTimestamp - a.dateTimestamp);
}

function filterDayGroupsBySearch(
  groups: UserMetricDataDayGroup[],
  searchQuery: string
): UserMetricDataDayGroup[] {
  if (!searchQuery.trim()) {
    return groups;
  }

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
  const theme = useTheme();
  const { t } = useTranslation();
  const { units } = useSettings();
  const dateFnsLocale = useDateFnsLocale();
  const iconColors = useMemo(
    () => ({
      'monitor-weight': { color: theme.colors.status.info, bg: theme.colors.status.info10 },
      percent: { color: theme.colors.status.violet500, bg: theme.colors.status.purple10 },
      straighten: { color: theme.colors.accent.tertiary, bg: theme.colors.status.info10 },
      'trending-up': { color: theme.colors.accent.secondary, bg: theme.colors.status.emerald10 },
      mood: { color: theme.colors.macros.fat.text, bg: theme.colors.status.amber10 },
      'water-drop': { color: theme.colors.status.info, bg: theme.colors.status.info10 },
      'fitness-center': {
        color: theme.colors.status.emeraldLight,
        bg: theme.colors.status.emerald400_10,
      },
      'local-fire-department': {
        color: theme.colors.status.error,
        bg: theme.colors.status.error10,
      },
    }),
    [theme]
  );
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
      const decryptedList = await Promise.all(metrics.map((m) => m.getDecrypted()));
      const results = metrics.map((metric, i) => ({
        item: metricToDisplayItem(metric, decryptedList[i], t, iconColors, units),
        dateTimestamp: decryptedList[i].date,
      }));
      const groups = groupMetricsByDate(results, t, dateFnsLocale);
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
  }, [visible, batchSize, t, iconColors, dateFnsLocale, units]);

  const loadMore = useCallback(async () => {
    if (!visible || isLoadingMore || !hasMore) {
      return;
    }

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

      const decryptedList = await Promise.all(metrics.map((m) => m.getDecrypted()));
      const results = metrics.map((metric, i) => ({
        item: metricToDisplayItem(metric, decryptedList[i], t, iconColors, units),
        dateTimestamp: decryptedList[i].date,
      }));

      setDayGroups((prev) => mergeIntoDayGroups(prev, results, t, dateFnsLocale));
      setHasMore(metrics.length === batchSize);
      setOffset((prev) => prev + metrics.length);
    } catch (err) {
      console.error('Error loading more user metric data logs:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [visible, isLoadingMore, hasMore, offset, batchSize, t, iconColors, dateFnsLocale, units]);

  const refresh = useCallback(async () => {
    if (isLoading) {
      return;
    }
    await loadInitial();
  }, [loadInitial, isLoading]);

  useEffect(() => {
    if (!visible) {
      return;
    }
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
