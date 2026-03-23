import { format, isThisWeek, isToday, isYesterday } from 'date-fns';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type NutritionCheckin from '../database/models/NutritionCheckin';
import { NutritionCheckinService } from '../database/services';
import { useTheme } from './useTheme';

export type NutritionCheckinDisplayItem = {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  iconBgColor: string;
  checkinTargetWeight: number;
  checkinTargetBodyFat: number;
  status: string;
};

export type NutritionCheckinDayGroup = {
  date: string;
  dateTimestamp: number;
  items: NutritionCheckinDisplayItem[];
};

const BATCH_SIZE = 20;

const ICON = 'event-note';

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
  return format(date, 'MMM d, yyyy');
}

function checkinToDisplayItem(
  checkin: NutritionCheckin,
  iconColors: { color: string; bg: string }
): NutritionCheckinDisplayItem {
  const dateLabel = format(new Date(checkin.checkinDate), 'MMM d, yyyy');
  return {
    id: checkin.id,
    name: `Check-in • ${dateLabel}`,
    icon: ICON,
    iconColor: iconColors.color,
    iconBgColor: iconColors.bg,
    checkinTargetWeight: checkin.targetWeight,
    checkinTargetBodyFat: checkin.targetBodyFat,
    status: checkin.status ?? 'pending',
  };
}

function groupCheckinsByDate(
  items: { item: NutritionCheckinDisplayItem; dateTimestamp: number }[],
  t: TFunction
): NutritionCheckinDayGroup[] {
  const groupMap = new Map<number, NutritionCheckinDisplayItem[]>();

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
  existing: NutritionCheckinDayGroup[],
  newItemsWithDates: { item: NutritionCheckinDisplayItem; dateTimestamp: number }[],
  t: TFunction
): NutritionCheckinDayGroup[] {
  const groupMap = new Map<number, NutritionCheckinDisplayItem[]>();
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
      items: items.sort((a, b) => b.id.localeCompare(a.id)),
    }))
    .sort((a, b) => b.dateTimestamp - a.dateTimestamp);
}

function filterDayGroupsBySearch(
  groups: NutritionCheckinDayGroup[],
  searchQuery: string
): NutritionCheckinDayGroup[] {
  if (!searchQuery.trim()) {
    return groups;
  }

  const q = searchQuery.toLowerCase().trim();
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => item.name.toLowerCase().includes(q)),
    }))
    .filter((g) => g.items.length > 0);
}

export interface UseNutritionCheckinDataLogsParams {
  visible?: boolean;
  batchSize?: number;
  searchQuery?: string;
}

export interface UseNutritionCheckinDataLogsResult {
  dayGroups: NutritionCheckinDayGroup[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNutritionCheckinDataLogs({
  visible = true,
  batchSize = BATCH_SIZE,
  searchQuery = '',
}: UseNutritionCheckinDataLogsParams = {}): UseNutritionCheckinDataLogsResult {
  const theme = useTheme();
  const { t } = useTranslation();
  const iconColors = useMemo(
    () => ({ color: theme.colors.status.info, bg: theme.colors.status.info10 }),
    [theme]
  );
  const [dayGroups, setDayGroups] = useState<NutritionCheckinDayGroup[]>([]);
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
      const checkins = await NutritionCheckinService.getHistory(batchSize, 0);
      const results = checkins.map((checkin) => ({
        item: checkinToDisplayItem(checkin, iconColors),
        dateTimestamp: checkin.checkinDate,
      }));
      const groups = groupCheckinsByDate(results, t);
      setDayGroups(groups);
      setHasMore(checkins.length === batchSize);
      setOffset(checkins.length);
    } catch (err) {
      console.error('Error loading nutrition check-in data logs:', err);
      setDayGroups([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [visible, batchSize, t, iconColors]);

  const loadMore = useCallback(async () => {
    if (!visible || isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const checkins = await NutritionCheckinService.getHistory(batchSize, offset);
      if (checkins.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const results = checkins.map((checkin) => ({
        item: checkinToDisplayItem(checkin, iconColors),
        dateTimestamp: checkin.checkinDate,
      }));

      setDayGroups((prev) => mergeIntoDayGroups(prev, results, t));
      setHasMore(checkins.length === batchSize);
      setOffset((prev) => prev + checkins.length);
    } catch (err) {
      console.error('Error loading more nutrition check-in data logs:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [visible, isLoadingMore, hasMore, offset, batchSize, t, iconColors]);

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
