import type { Locale } from 'date-fns';
import { format, isThisWeek, isToday, isYesterday } from 'date-fns';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import WorkoutLog from '@/database/models/WorkoutLog';
import { WorkoutService } from '@/database/services';

import { useDateFnsLocale } from './useDateFnsLocale';
import { useTheme } from './useTheme';

export type WorkoutLogDataDisplayItem = {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  iconBgColor: string;
  isCompleted: boolean;
  totalVolume?: number;
};

export type WorkoutLogDataDayGroup = {
  date: string;
  dateTimestamp: number;
  items: WorkoutLogDataDisplayItem[];
};

const BATCH_SIZE = 20;

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

function workoutLogToDisplayItem(
  log: WorkoutLog,
  t: TFunction,
  iconColors: { color: string; bg: string }
): WorkoutLogDataDisplayItem {
  return {
    id: log.id,
    name: log.workoutName || t('workoutLog.manageWorkoutLogData.unknownWorkout'),
    icon: 'fitness-center',
    iconColor: iconColors.color,
    iconBgColor: iconColors.bg,
    isCompleted: !!log.completedAt,
    totalVolume: log.totalVolume,
  };
}

function groupWorkoutLogsByDate(
  items: { item: WorkoutLogDataDisplayItem; dateTimestamp: number }[],
  t: TFunction,
  locale: Locale
): WorkoutLogDataDayGroup[] {
  const groupMap = new Map<number, WorkoutLogDataDisplayItem[]>();

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
  existing: WorkoutLogDataDayGroup[],
  newItemsWithDates: { item: WorkoutLogDataDisplayItem; dateTimestamp: number }[],
  t: TFunction,
  locale: Locale
): WorkoutLogDataDayGroup[] {
  const groupMap = new Map<number, WorkoutLogDataDisplayItem[]>();
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
  groups: WorkoutLogDataDayGroup[],
  searchQuery: string
): WorkoutLogDataDayGroup[] {
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

export interface UseWorkoutLogDataLogsParams {
  visible?: boolean;
  batchSize?: number;
  searchQuery?: string;
}

export interface UseWorkoutLogDataLogsResult {
  dayGroups: WorkoutLogDataDayGroup[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useWorkoutLogDataLogs({
  visible = true,
  batchSize = BATCH_SIZE,
  searchQuery = '',
}: UseWorkoutLogDataLogsParams = {}): UseWorkoutLogDataLogsResult {
  const theme = useTheme();
  const { t } = useTranslation();
  const dateFnsLocale = useDateFnsLocale();
  const iconColors = useMemo(
    () => ({ color: theme.colors.accent.primary, bg: theme.colors.accent.primary10 }),
    [theme]
  );
  const [dayGroups, setDayGroups] = useState<WorkoutLogDataDayGroup[]>([]);
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
      const logs = await WorkoutService.getWorkoutHistory(undefined, batchSize, 0);
      const validResults = logs.map((log) => ({
        item: workoutLogToDisplayItem(log, t, iconColors),
        dateTimestamp: log.startedAt,
      }));
      const groups = groupWorkoutLogsByDate(validResults, t, dateFnsLocale);
      setDayGroups(groups);
      setHasMore(logs.length === batchSize);
      setOffset(logs.length);
    } catch (err) {
      console.error('Error loading workout log data:', err);
      setDayGroups([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [visible, batchSize, t, iconColors, dateFnsLocale]);

  const loadMore = useCallback(async () => {
    if (!visible || isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const logs = await WorkoutService.getWorkoutHistory(undefined, batchSize, offset);
      if (logs.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const validResults = logs.map((log) => ({
        item: workoutLogToDisplayItem(log, t, iconColors),
        dateTimestamp: log.startedAt,
      }));

      setDayGroups((prev) => mergeIntoDayGroups(prev, validResults, t, dateFnsLocale));
      setHasMore(logs.length === batchSize);
      setOffset((prev) => prev + logs.length);
    } catch (err) {
      console.error('Error loading more workout log data:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [visible, isLoadingMore, hasMore, offset, batchSize, t, iconColors, dateFnsLocale]);

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
