import type { Locale } from 'date-fns';
import { format, isThisWeek, isToday, isYesterday } from 'date-fns';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import FoodPortion from '../database/models/FoodPortion';
import { FoodPortionService } from '../database/services';
import { useDateFnsLocale } from './useDateFnsLocale';
import { useTheme } from './useTheme';

export type FoodPortionDisplayItem = {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  iconBgColor: string;
  portionGramWeight: number;
};

export type FoodPortionDayGroup = {
  date: string;
  dateTimestamp: number;
  items: FoodPortionDisplayItem[];
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

function mapPortionIconToMaterial(icon?: string): string {
  if (!icon) {
    return 'scale';
  }
  const m: Record<string, string> = {
    scale: 'scale',
    egg: 'egg',
    cup: 'local-cafe',
    droplet: 'water-drop',
  };
  return m[icon] ?? 'scale';
}

function portionToDisplayItem(
  portion: FoodPortion,
  iconColors: Record<string, { color: string; bg: string }>
): FoodPortionDisplayItem {
  const icon = mapPortionIconToMaterial(portion.icon);
  const colors = iconColors[icon] ?? iconColors.scale;

  return {
    id: portion.id,
    name: portion.name,
    icon,
    iconColor: colors.color,
    iconBgColor: colors.bg,
    portionGramWeight: portion.gramWeight,
  };
}

function groupPortionsByDate(
  items: { item: FoodPortionDisplayItem; dateTimestamp: number }[],
  t: TFunction,
  locale: Locale
): FoodPortionDayGroup[] {
  const groupMap = new Map<number, FoodPortionDisplayItem[]>();

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
  existing: FoodPortionDayGroup[],
  newItemsWithDates: { item: FoodPortionDisplayItem; dateTimestamp: number }[],
  t: TFunction,
  locale: Locale
): FoodPortionDayGroup[] {
  const groupMap = new Map<number, FoodPortionDisplayItem[]>();
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
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.dateTimestamp - a.dateTimestamp);
}

function filterDayGroupsBySearch(
  groups: FoodPortionDayGroup[],
  searchQuery: string
): FoodPortionDayGroup[] {
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

export interface UseFoodPortionDataLogsParams {
  visible?: boolean;
  batchSize?: number;
  searchQuery?: string;
}

export interface UseFoodPortionDataLogsResult {
  dayGroups: FoodPortionDayGroup[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useFoodPortionDataLogs({
  visible = true,
  batchSize = BATCH_SIZE,
  searchQuery = '',
}: UseFoodPortionDataLogsParams = {}): UseFoodPortionDataLogsResult {
  const theme = useTheme();
  const { t } = useTranslation();
  const dateFnsLocale = useDateFnsLocale();
  const iconColors = useMemo(
    () => ({
      scale: { color: theme.colors.text.secondary, bg: theme.colors.status.gray10 },
      egg: { color: theme.colors.status.indigo, bg: theme.colors.status.indigo10 },
      'local-cafe': { color: theme.colors.text.muted, bg: theme.colors.status.gray10 },
      'water-drop': { color: theme.colors.status.info, bg: theme.colors.status.info10 },
      restaurant: {
        color: theme.colors.status.emeraldLight,
        bg: theme.colors.status.emerald400_10,
      },
    }),
    [theme]
  );
  const [dayGroups, setDayGroups] = useState<FoodPortionDayGroup[]>([]);
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
      const portions = await FoodPortionService.getPortionsPaginated(batchSize, 0);
      const results = portions.map((portion) => ({
        item: portionToDisplayItem(portion, iconColors),
        dateTimestamp: portion.createdAt,
      }));
      const groups = groupPortionsByDate(results, t, dateFnsLocale);
      setDayGroups(groups);
      setHasMore(portions.length === batchSize);
      setOffset(portions.length);
    } catch (err) {
      console.error('Error loading food portion data logs:', err);
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
      const portions = await FoodPortionService.getPortionsPaginated(batchSize, offset);
      if (portions.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const results = portions.map((portion) => ({
        item: portionToDisplayItem(portion, iconColors),
        dateTimestamp: portion.createdAt,
      }));

      setDayGroups((prev) => mergeIntoDayGroups(prev, results, t, dateFnsLocale));
      setHasMore(portions.length === batchSize);
      setOffset((prev) => prev + portions.length);
    } catch (err) {
      console.error('Error loading more food portion data logs:', err);
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
