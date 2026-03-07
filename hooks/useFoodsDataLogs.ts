import { format, isThisWeek, isToday, isYesterday } from 'date-fns';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Food from '../database/models/Food';
import { FoodService } from '../database/services';
import { useTheme } from './useTheme';

export type FoodLibraryDisplayItem = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  icon: string;
  iconColor: string;
  iconBgColor: string;
  isFavorite: boolean;
};

export type FoodLibraryDayGroup = {
  date: string;
  dateTimestamp: number;
  items: FoodLibraryDisplayItem[];
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

function pickIconForFoodName(name: string): string {
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

function foodToDisplayItem(
  food: Food,
  t: TFunction,
  iconColors: Record<string, { color: string; bg: string }>
): FoodLibraryDisplayItem {
  const icon = pickIconForFoodName(food.name);
  const colors = iconColors[icon] ?? iconColors.restaurant;

  return {
    id: food.id,
    name: food.name || t('food.manageFoodLibrary.unknownFood'),
    calories: Math.round(food.calories),
    protein: Math.round(food.protein),
    carbs: Math.round(food.carbs),
    fat: Math.round(food.fat),
    icon,
    iconColor: colors.color,
    iconBgColor: colors.bg,
    isFavorite: food.isFavorite,
  };
}

function groupFoodsByDate(
  items: { item: FoodLibraryDisplayItem; dateTimestamp: number }[],
  t: TFunction
): FoodLibraryDayGroup[] {
  const groupMap = new Map<number, FoodLibraryDisplayItem[]>();

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
  existing: FoodLibraryDayGroup[],
  newItemsWithDates: { item: FoodLibraryDisplayItem; dateTimestamp: number }[],
  t: TFunction
): FoodLibraryDayGroup[] {
  const groupMap = new Map<number, FoodLibraryDisplayItem[]>();
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
  groups: FoodLibraryDayGroup[],
  searchQuery: string
): FoodLibraryDayGroup[] {
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

export interface UseFoodsDataLogsParams {
  visible?: boolean;
  batchSize?: number;
  searchQuery?: string;
}

export interface UseFoodsDataLogsResult {
  dayGroups: FoodLibraryDayGroup[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useFoodsDataLogs({
  visible = true,
  batchSize = BATCH_SIZE,
  searchQuery = '',
}: UseFoodsDataLogsParams = {}): UseFoodsDataLogsResult {
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
  const [dayGroups, setDayGroups] = useState<FoodLibraryDayGroup[]>([]);
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
      const foods = await FoodService.getFoodsPaginated(batchSize, 0);
      const results = foods.map((food) => ({
        item: foodToDisplayItem(food, t, iconColors),
        dateTimestamp: food.createdAt,
      }));
      const groups = groupFoodsByDate(results, t);
      setDayGroups(groups);
      setHasMore(foods.length === batchSize);
      setOffset(foods.length);
    } catch (err) {
      console.error('Error loading foods data logs:', err);
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
      const foods = await FoodService.getFoodsPaginated(batchSize, offset);
      if (foods.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const results = foods.map((food) => ({
        item: foodToDisplayItem(food, t, iconColors),
        dateTimestamp: food.createdAt,
      }));

      setDayGroups((prev) => mergeIntoDayGroups(prev, results, t));
      setHasMore(foods.length === batchSize);
      setOffset((prev) => prev + foods.length);
    } catch (err) {
      console.error('Error loading more foods data logs:', err);
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
