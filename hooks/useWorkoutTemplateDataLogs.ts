import { format, isThisWeek, isToday, isYesterday } from 'date-fns';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import WorkoutTemplate from '../database/models/WorkoutTemplate';
import { WorkoutTemplateService } from '../database/services';
import { useTheme } from './useTheme';

export type WorkoutTemplateDataDisplayItem = {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  iconBgColor: string;
  description?: string;
};

export type WorkoutTemplateDataDayGroup = {
  date: string;
  dateTimestamp: number;
  items: WorkoutTemplateDataDisplayItem[];
};

const BATCH_SIZE = 20;

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

function templateToDisplayItem(
  template: WorkoutTemplate,
  t: TFunction,
  iconColor: { color: string; bg: string }
): WorkoutTemplateDataDisplayItem {
  return {
    id: template.id,
    name:
      template.name || t('workouts.manageWorkoutTemplateData.unknownTemplate', 'Unknown Template'),
    icon: 'fitness-center',
    iconColor: iconColor.color,
    iconBgColor: iconColor.bg,
    description: template.description || undefined,
  };
}

function groupTemplatesByDate(
  items: { item: WorkoutTemplateDataDisplayItem; dateTimestamp: number }[],
  t: TFunction
): WorkoutTemplateDataDayGroup[] {
  const groupMap = new Map<number, WorkoutTemplateDataDisplayItem[]>();

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
  existing: WorkoutTemplateDataDayGroup[],
  newItemsWithDates: { item: WorkoutTemplateDataDisplayItem; dateTimestamp: number }[],
  t: TFunction
): WorkoutTemplateDataDayGroup[] {
  const groupMap = new Map<number, WorkoutTemplateDataDisplayItem[]>();
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
      date: formatRelativeDate(dateTimestamp, t),
      dateTimestamp,
      items: items.sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => b.dateTimestamp - a.dateTimestamp);
}

function filterDayGroupsBySearch(
  groups: WorkoutTemplateDataDayGroup[],
  searchQuery: string
): WorkoutTemplateDataDayGroup[] {
  if (!searchQuery.trim()) {
    return groups;
  }

  const lower = searchQuery.toLowerCase().trim();
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (item) =>
          item.name.toLowerCase().includes(lower) ||
          (item.description?.toLowerCase().includes(lower) ?? false)
      ),
    }))
    .filter((g) => g.items.length > 0);
}

export interface UseWorkoutTemplateDataLogsParams {
  visible?: boolean;
  batchSize?: number;
  searchQuery?: string;
}

export interface UseWorkoutTemplateDataLogsResult {
  dayGroups: WorkoutTemplateDataDayGroup[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useWorkoutTemplateDataLogs({
  visible = true,
  batchSize = BATCH_SIZE,
  searchQuery = '',
}: UseWorkoutTemplateDataLogsParams = {}): UseWorkoutTemplateDataLogsResult {
  const theme = useTheme();
  const { t } = useTranslation();
  const iconColor = useMemo(
    () => ({ color: theme.colors.status.indigo, bg: theme.colors.status.indigo10 }),
    [theme]
  );
  const [dayGroups, setDayGroups] = useState<WorkoutTemplateDataDayGroup[]>([]);
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
      const templates = await WorkoutTemplateService.getWorkoutTemplatesPaginated(batchSize, 0);
      const validResults = templates.map((template) => ({
        item: templateToDisplayItem(template, t, iconColor),
        dateTimestamp: template.createdAt,
      }));
      const groups = groupTemplatesByDate(validResults, t);
      setDayGroups(groups);
      setHasMore(templates.length === batchSize);
      setOffset(templates.length);
    } catch (err) {
      console.error('Error loading workout template data logs:', err);
      setDayGroups([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [visible, batchSize, t, iconColor]);

  const loadMore = useCallback(async () => {
    if (!visible || isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const templates = await WorkoutTemplateService.getWorkoutTemplatesPaginated(
        batchSize,
        offset
      );
      if (templates.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const validResults = templates.map((template) => ({
        item: templateToDisplayItem(template, t, iconColor),
        dateTimestamp: template.createdAt,
      }));

      setDayGroups((prev) => mergeIntoDayGroups(prev, validResults, t));
      setHasMore(templates.length === batchSize);
      setOffset((prev) => prev + templates.length);
    } catch (err) {
      console.error('Error loading more workout template data logs:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [visible, isLoadingMore, hasMore, offset, batchSize, t, iconColor]);

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
