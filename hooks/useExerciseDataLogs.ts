import { format, isThisWeek, isToday, isYesterday } from 'date-fns';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Exercise, { type EquipmentType, type MuscleGroup } from '../database/models/Exercise';
import { ExerciseService } from '../database/services';

export type ExerciseDataDisplayItem = {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  iconBgColor: string;
  muscleGroup: MuscleGroup | string;
  equipmentType: EquipmentType | string;
};

export type ExerciseDataDayGroup = {
  date: string;
  dateTimestamp: number;
  items: ExerciseDataDisplayItem[];
};

const BATCH_SIZE = 20;

const ICON_COLORS: Record<string, { color: string; bg: string }> = {
  chest: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  back: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  shoulders: { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  biceps: { color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
  triceps: { color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' },
  quads: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  hamstrings: { color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)' },
  glutes: { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
  abs: { color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)' },
  full_body: { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
  cardio: { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
  default: { color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' },
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

function exerciseToDisplayItem(exercise: Exercise, t: TFunction): ExerciseDataDisplayItem {
  const muscleGroup = exercise.muscleGroup ?? 'other';
  const colors = ICON_COLORS[muscleGroup] ?? ICON_COLORS.default;

  return {
    id: exercise.id,
    name: exercise.name || t('exercises.manageExerciseData.unknownExercise', 'Unknown Exercise'),
    icon: 'fitness-center',
    iconColor: colors.color,
    iconBgColor: colors.bg,
    muscleGroup: exercise.muscleGroup,
    equipmentType: exercise.equipmentType,
  };
}

function groupExercisesByDate(
  items: { item: ExerciseDataDisplayItem; dateTimestamp: number }[],
  t: TFunction
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
      date: formatRelativeDate(dateTimestamp, t),
      dateTimestamp,
      items,
    }))
    .sort((a, b) => b.dateTimestamp - a.dateTimestamp);
}

function mergeIntoDayGroups(
  existing: ExerciseDataDayGroup[],
  newItemsWithDates: { item: ExerciseDataDisplayItem; dateTimestamp: number }[],
  t: TFunction
): ExerciseDataDayGroup[] {
  const groupMap = new Map<number, ExerciseDataDisplayItem[]>();
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
      items: items.sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => b.dateTimestamp - a.dateTimestamp);
}

function filterDayGroupsBySearch(
  groups: ExerciseDataDayGroup[],
  searchQuery: string
): ExerciseDataDayGroup[] {
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
  const { t } = useTranslation();
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
        item: exerciseToDisplayItem(exercise, t),
        dateTimestamp: exercise.createdAt,
      }));
      const groups = groupExercisesByDate(validResults, t);
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
  }, [visible, batchSize, t]);

  const loadMore = useCallback(async () => {
    if (!visible || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);

    try {
      const exercises = await ExerciseService.getExercisesPaginated(batchSize, offset);
      if (exercises.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const validResults = exercises.map((exercise) => ({
        item: exerciseToDisplayItem(exercise, t),
        dateTimestamp: exercise.createdAt,
      }));

      setDayGroups((prev) => mergeIntoDayGroups(prev, validResults, t));
      setHasMore(exercises.length === batchSize);
      setOffset((prev) => prev + exercises.length);
    } catch (err) {
      console.error('Error loading more exercise data logs:', err);
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
