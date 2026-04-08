import type { Locale } from 'date-fns';
import { format, isThisWeek, isToday, isYesterday } from 'date-fns';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Exercise, {
  type EquipmentType,
  type ExerciseSource,
  type MuscleGroup,
} from '@/database/models/Exercise';
import { ExerciseService } from '@/database/services';

import { useDateFnsLocale } from './useDateFnsLocale';
import { useTheme } from './useTheme';

export type ExerciseDataDisplayItem = {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  iconBgColor: string;
  muscleGroup: MuscleGroup | string;
  equipmentType: EquipmentType | string;
  source?: ExerciseSource;
};

export type ExerciseDataDayGroup = {
  date: string;
  dateTimestamp: number;
  items: ExerciseDataDisplayItem[];
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

function exerciseToDisplayItem(
  exercise: Exercise,
  t: TFunction,
  iconColors: Record<string, { color: string; bg: string }>
): ExerciseDataDisplayItem {
  const muscleGroup = exercise.muscleGroup ?? 'other';
  const colors = iconColors[muscleGroup] ?? iconColors.default;

  return {
    id: exercise.id,
    name: exercise.name || t('exercises.manageExerciseData.unknownExercise'),
    icon: 'fitness-center',
    iconColor: colors.color,
    iconBgColor: colors.bg,
    muscleGroup: exercise.muscleGroup,
    equipmentType: exercise.equipmentType,
    source: exercise.source,
  };
}

function groupExercisesByDate(
  items: { item: ExerciseDataDisplayItem; dateTimestamp: number }[],
  t: TFunction,
  locale: Locale
): ExerciseDataDayGroup[] {
  const groupMap = new Map<number, ExerciseDataDisplayItem[]>();

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
  existing: ExerciseDataDayGroup[],
  newItemsWithDates: { item: ExerciseDataDisplayItem; dateTimestamp: number }[],
  t: TFunction,
  locale: Locale
): ExerciseDataDayGroup[] {
  const groupMap = new Map<number, ExerciseDataDisplayItem[]>();
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
  groups: ExerciseDataDayGroup[],
  searchQuery: string
): ExerciseDataDayGroup[] {
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

export interface UseExerciseDataLogsParams {
  visible?: boolean;
  batchSize?: number;
  searchQuery?: string;
}

export interface UseExerciseDataLogsResult {
  dayGroups: ExerciseDataDayGroup[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useExerciseDataLogs({
  visible = true,
  batchSize = BATCH_SIZE,
  searchQuery = '',
}: UseExerciseDataLogsParams = {}): UseExerciseDataLogsResult {
  const theme = useTheme();
  const { t } = useTranslation();
  const dateFnsLocale = useDateFnsLocale();
  const iconColors = useMemo(
    () => ({
      chest: { color: theme.colors.status.error, bg: theme.colors.status.error10 },
      back: { color: theme.colors.status.info, bg: theme.colors.status.info10 },
      shoulders: { color: theme.colors.status.violet500, bg: theme.colors.status.purple10 },
      biceps: { color: theme.colors.status.pink500, bg: theme.colors.rose.brand10 },
      triceps: { color: theme.colors.status.warning, bg: theme.colors.status.warning10 },
      quads: { color: theme.colors.accent.primary, bg: theme.colors.accent.primary10 },
      hamstrings: { color: theme.colors.accent.tertiary, bg: theme.colors.status.emerald10 },
      glutes: { color: theme.colors.status.purple, bg: theme.colors.status.purple10 },
      abs: { color: theme.colors.status.yellow, bg: theme.colors.status.yellow10 },
      full_body: { color: theme.colors.status.indigo, bg: theme.colors.status.indigo10 },
      cardio: { color: theme.colors.accent.tertiary, bg: theme.colors.status.info10 },
      default: { color: theme.colors.text.muted, bg: theme.colors.status.gray10 },
    }),
    [theme]
  );
  const [dayGroups, setDayGroups] = useState<ExerciseDataDayGroup[]>([]);
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
      const exercises = await ExerciseService.getExercisesPaginated(batchSize, 0);
      const validResults = exercises.map((exercise) => ({
        item: exerciseToDisplayItem(exercise, t, iconColors),
        dateTimestamp: exercise.createdAt,
      }));
      const groups = groupExercisesByDate(validResults, t, dateFnsLocale);
      setDayGroups(groups);
      setHasMore(exercises.length === batchSize);
      setOffset(exercises.length);
    } catch (err) {
      console.error('Error loading exercise data logs:', err);
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
      const exercises = await ExerciseService.getExercisesPaginated(batchSize, offset);
      if (exercises.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const validResults = exercises.map((exercise) => ({
        item: exerciseToDisplayItem(exercise, t, iconColors),
        dateTimestamp: exercise.createdAt,
      }));

      setDayGroups((prev) => mergeIntoDayGroups(prev, validResults, t, dateFnsLocale));
      setHasMore(exercises.length === batchSize);
      setOffset((prev) => prev + exercises.length);
    } catch (err) {
      console.error('Error loading more exercise data logs:', err);
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
