import type { Locale } from 'date-fns';
import { format, isThisWeek, isToday, isYesterday } from 'date-fns';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import NutritionGoal, { type EatingPhase } from '@/database/models/NutritionGoal';
import { NutritionGoalService } from '@/database/services';

import { useDateFnsLocale } from './useDateFnsLocale';
import { useTheme } from './useTheme';

export type NutritionGoalDisplayItem = {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  iconBgColor: string;
  goalCalories?: number;
  goalEatingPhase: string;
  goalTargetWeight: number;
  isDynamic?: boolean;
};

export type NutritionGoalDayGroup = {
  date: string;
  dateTimestamp: number;
  items: NutritionGoalDisplayItem[];
};

const BATCH_SIZE = 20;

const ICON = 'flag';

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
  return format(date, 'MMM d, yyyy', { locale });
}

function getPhaseLabel(phase: EatingPhase, t: TFunction): string {
  const key = `goalsManagement.manageGoalData.phase${phase.charAt(0).toUpperCase()}${phase.slice(1)}`;
  const translated = t(key);
  if (translated === key) {
    return phase;
  }
  return translated;
}

function goalToDisplayItem(
  goal: NutritionGoal,
  t: TFunction,
  iconColors: { color: string; bg: string },
  locale: Locale
): NutritionGoalDisplayItem {
  const phaseLabel = getPhaseLabel(goal.eatingPhase, t);
  const dateLabel = format(new Date(goal.createdAt), 'MMM d, yyyy', { locale });
  return {
    id: goal.id,
    name: `${goal.isDynamic ? `${t('nutritionGoals.dynamicBadge')} • ` : ''}${phaseLabel} • ${dateLabel}`,
    icon: ICON,
    iconColor: iconColors.color,
    iconBgColor: iconColors.bg,
    goalCalories: goal.isDynamic ? undefined : Math.round(goal.totalCalories),
    goalEatingPhase: phaseLabel,
    goalTargetWeight: goal.targetWeight,
    isDynamic: goal.isDynamic,
  };
}

function groupGoalsByDate(
  items: { item: NutritionGoalDisplayItem; dateTimestamp: number }[],
  t: TFunction,
  locale: Locale
): NutritionGoalDayGroup[] {
  const groupMap = new Map<number, NutritionGoalDisplayItem[]>();

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
  existing: NutritionGoalDayGroup[],
  newItemsWithDates: { item: NutritionGoalDisplayItem; dateTimestamp: number }[],
  t: TFunction,
  locale: Locale
): NutritionGoalDayGroup[] {
  const groupMap = new Map<number, NutritionGoalDisplayItem[]>();
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
      items: items.sort((a, b) => b.id.localeCompare(a.id)),
    }))
    .sort((a, b) => b.dateTimestamp - a.dateTimestamp);
}

function filterDayGroupsBySearch(
  groups: NutritionGoalDayGroup[],
  searchQuery: string
): NutritionGoalDayGroup[] {
  if (!searchQuery.trim()) {
    return groups;
  }

  const q = searchQuery.toLowerCase().trim();
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) || item.goalEatingPhase.toLowerCase().includes(q)
      ),
    }))
    .filter((g) => g.items.length > 0);
}

export interface UseNutritionGoalDataLogsParams {
  visible?: boolean;
  batchSize?: number;
  searchQuery?: string;
}

export interface UseNutritionGoalDataLogsResult {
  dayGroups: NutritionGoalDayGroup[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNutritionGoalDataLogs({
  visible = true,
  batchSize = BATCH_SIZE,
  searchQuery = '',
}: UseNutritionGoalDataLogsParams = {}): UseNutritionGoalDataLogsResult {
  const theme = useTheme();
  const { t } = useTranslation();
  const dateFnsLocale = useDateFnsLocale();
  const iconColors = useMemo(
    () => ({ color: theme.colors.status.violet500, bg: theme.colors.status.purple10 }),
    [theme]
  );
  const [dayGroups, setDayGroups] = useState<NutritionGoalDayGroup[]>([]);
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
      const goals = await NutritionGoalService.getGoalsHistory(batchSize, 0);
      const results = goals.map((goal) => ({
        item: goalToDisplayItem(goal, t, iconColors, dateFnsLocale),
        dateTimestamp: goal.createdAt,
      }));
      const groups = groupGoalsByDate(results, t, dateFnsLocale);
      setDayGroups(groups);
      setHasMore(goals.length === batchSize);
      setOffset(goals.length);
    } catch (err) {
      console.error('Error loading nutrition goal data logs:', err);
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
      const goals = await NutritionGoalService.getGoalsHistory(batchSize, offset);
      if (goals.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const results = goals.map((goal) => ({
        item: goalToDisplayItem(goal, t, iconColors, dateFnsLocale),
        dateTimestamp: goal.createdAt,
      }));

      setDayGroups((prev) => mergeIntoDayGroups(prev, results, t, dateFnsLocale));
      setHasMore(goals.length === batchSize);
      setOffset((prev) => prev + goals.length);
    } catch (err) {
      console.error('Error loading more nutrition goal data logs:', err);
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
