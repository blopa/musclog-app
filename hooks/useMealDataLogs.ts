import { format, isThisWeek, isToday, isYesterday } from 'date-fns';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Meal from '../database/models/Meal';
import { MealService } from '../database/services';

export type MealDataDisplayItem = {
  id: string;
  mealId: string;
  name: string;
  description?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  icon: 'restaurant' | 'local-dining' | 'fastfood' | 'lunch-dining' | 'dinner-dining';
  iconColor: string;
  iconBgColor: string;
  isFavorite: boolean;
  isAiGenerated: boolean;
};

export type MealDataDayGroup = {
  date: string;
  dateTimestamp: number;
  items: MealDataDisplayItem[];
};

const BATCH_SIZE = 20;

const ICON_COLORS: Record<string, { color: string; bg: string }> = {
  restaurant: { color: '#29e08e', bg: 'rgba(41, 224, 142, 0.1)' },
  'local-dining': { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
  fastfood: { color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' },
  'lunch-dining': { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  'dinner-dining': { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
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

function pickIconForMeal(name: string, isAiGenerated: boolean): MealDataDisplayItem['icon'] {
  if (isAiGenerated) return 'fastfood';

  const lower = name.toLowerCase();
  if (lower.includes('breakfast') || lower.includes('morning')) return 'local-dining';
  if (lower.includes('lunch') || lower.includes('midday')) return 'lunch-dining';
  if (lower.includes('dinner') || lower.includes('evening')) return 'dinner-dining';
  if (lower.includes('snack') || lower.includes('quick')) return 'fastfood';
  return 'restaurant';
}

async function mealToDisplayItemWithT(
  meal: Meal,
  t: TFunction
): Promise<MealDataDisplayItem | null> {
  try {
    const nutrients = await meal.getTotalNutrients();
    const icon = pickIconForMeal(meal.name, meal.isAiGenerated);
    const colors = ICON_COLORS[icon] ?? ICON_COLORS.restaurant;

    return {
      id: meal.id,
      mealId: meal.id,
      name: meal.name || t('food.meals.manageMealData.unknownMeal', 'Unknown Meal'),
      description: meal.description,
      calories: Math.round(nutrients.calories),
      protein: Math.round(nutrients.protein),
      carbs: Math.round(nutrients.carbs),
      fat: Math.round(nutrients.fat),
      icon,
      iconColor: colors.color,
      iconBgColor: colors.bg,
      isFavorite: meal.isFavorite,
      isAiGenerated: meal.isAiGenerated,
    };
  } catch (error) {
    console.error('Error converting meal to display item:', error);
    return null;
  }
}

function groupMealsByDate(
  items: { item: MealDataDisplayItem; dateTimestamp: number }[],
  t: TFunction
): MealDataDayGroup[] {
  const groupMap = new Map<number, MealDataDisplayItem[]>();

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
  existing: MealDataDayGroup[],
  newItemsWithDates: { item: MealDataDisplayItem; dateTimestamp: number }[],
  t: TFunction
): MealDataDayGroup[] {
  const groupMap = new Map<number, MealDataDisplayItem[]>();
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
      items: items.sort((a, b) => a.id.localeCompare(b.id)), // stable order within day
    }))
    .sort((a, b) => b.dateTimestamp - a.dateTimestamp);
}

function filterDayGroupsBySearch(
  groups: MealDataDayGroup[],
  searchQuery: string
): MealDataDayGroup[] {
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

export interface UseMealDataLogsParams {
  visible?: boolean;
  batchSize?: number;
  searchQuery?: string;
}

export interface UseMealDataLogsResult {
  dayGroups: MealDataDayGroup[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useMealDataLogs({
  visible = true,
  batchSize = BATCH_SIZE,
  searchQuery = '',
}: UseMealDataLogsParams = {}): UseMealDataLogsResult {
  const { t } = useTranslation();
  const [dayGroups, setDayGroups] = useState<MealDataDayGroup[]>([]);
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
      const meals = await MealService.getMealsPaginated(batchSize, 0);
      const results = await Promise.all(
        meals.map(async (meal) => {
          const item = await mealToDisplayItemWithT(meal, t);
          return item ? { item, dateTimestamp: meal.createdAt } : null;
        })
      );

      const validResults = results.filter(
        (r): r is { item: MealDataDisplayItem; dateTimestamp: number } => r !== null
      );
      const groups = groupMealsByDate(validResults, t);
      setDayGroups(groups);
      setHasMore(meals.length === batchSize);
      setOffset(meals.length);
    } catch (err) {
      console.error('Error loading meal data logs:', err);
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
      const meals = await MealService.getMealsPaginated(batchSize, offset);
      if (meals.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const results = await Promise.all(
        meals.map(async (meal) => {
          const item = await mealToDisplayItemWithT(meal, t);
          return item ? { item, dateTimestamp: meal.createdAt } : null;
        })
      );

      const validResults = results.filter(
        (r): r is { item: MealDataDisplayItem; dateTimestamp: number } => r !== null
      );

      setDayGroups((prev) => mergeIntoDayGroups(prev, validResults, t));
      setHasMore(meals.length === batchSize);
      setOffset((prev) => prev + meals.length);
    } catch (err) {
      console.error('Error loading more meal data logs:', err);
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
