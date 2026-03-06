import { format, isThisWeek, isToday, isYesterday } from 'date-fns';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import NutritionLog from '../database/models/NutritionLog';
import { NutritionService } from '../database/services';
import { useTheme } from './useTheme';

export type FoodDataDisplayItem = {
  id: string;
  logId: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  icon: 'restaurant' | 'egg' | 'local-pizza' | 'fitness-center' | 'restaurant-menu';
  iconColor: string;
  iconBgColor: string;
};

export type FoodDataDayGroup = {
  date: string;
  dateTimestamp: number;
  items: FoodDataDisplayItem[];
};

const BATCH_SIZE = 20;

const ICON_OPTIONS: FoodDataDisplayItem['icon'][] = [
  'restaurant',
  'egg',
  'local-pizza',
  'fitness-center',
  'restaurant-menu',
];

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

function pickIconForFood(name: string): FoodDataDisplayItem['icon'] {
  const lower = name.toLowerCase();
  if (lower.includes('egg')) {
    return 'egg';
  }
  if (lower.includes('pizza')) {
    return 'local-pizza';
  }
  if (lower.includes('protein') || lower.includes('shake') || lower.includes('whey')) {
    return 'fitness-center';
  }
  if (lower.includes('yogurt') || lower.includes('berry')) {
    return 'restaurant-menu';
  }
  return 'restaurant';
}

async function logToDisplayItemWithT(
  log: NutritionLog,
  t: TFunction,
  iconColors: Record<string, { color: string; bg: string }>
): Promise<FoodDataDisplayItem | null> {
  try {
    const [nutrients, displayName, food] = await Promise.all([
      log.getNutrients(),
      log.getDisplayName(),
      log.food,
    ]);
    const icon = pickIconForFood(displayName || food?.name);
    const colors = iconColors[icon] ?? iconColors.restaurant;

    return {
      id: log.id,
      logId: log.id,
      name: displayName || food?.name || t('food.manageFoodData.unknownFood', 'Unknown'),
      calories: Math.round(nutrients.calories),
      protein: Math.round(nutrients.protein),
      carbs: Math.round(nutrients.carbs),
      fat: Math.round(nutrients.fat),
      icon,
      iconColor: colors.color,
      iconBgColor: colors.bg,
    };
  } catch (error) {
    console.error('Error converting log to display item:', error);
    return null;
  }
}

function groupLogsByDate(
  items: { item: FoodDataDisplayItem; dateTimestamp: number }[],
  t: TFunction
): FoodDataDayGroup[] {
  const groupMap = new Map<number, FoodDataDisplayItem[]>();

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
  existing: FoodDataDayGroup[],
  newItemsWithDates: { item: FoodDataDisplayItem; dateTimestamp: number }[],
  t: TFunction
): FoodDataDayGroup[] {
  const groupMap = new Map<number, FoodDataDisplayItem[]>();
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
      items: items.sort((a, b) => a.id.localeCompare(b.id)), // stable order within day
    }))
    .sort((a, b) => b.dateTimestamp - a.dateTimestamp);
}

function filterDayGroupsBySearch(
  groups: FoodDataDayGroup[],
  searchQuery: string
): FoodDataDayGroup[] {
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

export interface UseFoodDataLogsParams {
  visible?: boolean;
  batchSize?: number;
  searchQuery?: string;
}

export interface UseFoodDataLogsResult {
  dayGroups: FoodDataDayGroup[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useFoodDataLogs({
  visible = true,
  batchSize = BATCH_SIZE,
  searchQuery = '',
}: UseFoodDataLogsParams = {}): UseFoodDataLogsResult {
  const theme = useTheme();
  const { t } = useTranslation();
  const iconColors = useMemo(
    () => ({
      restaurant: {
        color: theme.colors.status.emeraldLight,
        bg: theme.colors.status.emerald400_10,
      },
      egg: { color: theme.colors.status.indigo, bg: theme.colors.status.indigo10 },
      'local-pizza': { color: theme.colors.status.warning, bg: theme.colors.status.warning10 },
      'fitness-center': {
        color: theme.colors.status.emeraldLight,
        bg: theme.colors.status.emerald400_10,
      },
      'restaurant-menu': { color: theme.colors.status.info, bg: theme.colors.status.info10 },
    }),
    [theme]
  );
  const [dayGroups, setDayGroups] = useState<FoodDataDayGroup[]>([]);
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
      const logs = await NutritionService.getNutritionLogsPaginated(batchSize, 0);
      const results = await Promise.all(
        logs.map(async (log) => {
          const item = await logToDisplayItemWithT(log, t, iconColors);
          return item ? { item, dateTimestamp: log.date } : null;
        })
      );

      const validResults = results.filter(
        (r): r is { item: FoodDataDisplayItem; dateTimestamp: number } => r !== null
      );
      const groups = groupLogsByDate(validResults, t);
      setDayGroups(groups);
      setHasMore(logs.length === batchSize);
      setOffset(logs.length);
    } catch (err) {
      console.error('Error loading food data logs:', err);
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

    // Small delay to ensure React processes the state update and shows loading state
    await new Promise<void>((resolve) => setTimeout(resolve, 1));

    try {
      const logs = await NutritionService.getNutritionLogsPaginated(batchSize, offset);
      if (logs.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const results = await Promise.all(
        logs.map(async (log) => {
          const item = await logToDisplayItemWithT(log, t, iconColors);
          return item ? { item, dateTimestamp: log.date } : null;
        })
      );

      const validResults = results.filter(
        (r): r is { item: FoodDataDisplayItem; dateTimestamp: number } => r !== null
      );

      setDayGroups((prev) => mergeIntoDayGroups(prev, validResults, t));
      setHasMore(logs.length === batchSize);
      setOffset((prev) => prev + logs.length);
    } catch (err) {
      console.error('Error loading more food data logs:', err);
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
