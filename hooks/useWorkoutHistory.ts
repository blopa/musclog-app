import { Q } from '@nozbe/watermelondb';
import type { Locale } from 'date-fns';
import { format, isThisWeek, isToday, isYesterday } from 'date-fns';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DEFAULT_BATCH_SIZE } from '@/constants/database';
import { database } from '@/database';
import WorkoutLog from '@/database/models/WorkoutLog';
import { WorkoutAnalytics, WorkoutService } from '@/database/services';
import i18n from '@/lang/lang';
import { type Theme } from '@/theme';
import { formatAppInteger } from '@/utils/formatAppNumber';
import {
  calculateDateRange,
  filterWorkoutsBySearch,
  groupWorkoutsByMonth,
  mergeWorkoutSections,
  processWorkouts,
  type WorkoutFilters,
  type WorkoutHistorySection,
} from '@/utils/workoutHistory';

import { useDateFnsLocale } from './useDateFnsLocale';
import { useSettings } from './useSettings';
import { useTheme } from './useTheme';

// Types for simple workout format (home screen)
export type ProcessedRecentWorkout = {
  id: string;
  name: string;
  date: string;
  duration: string;
  calories: number;
  prs: number | null;
  image: any;
  imageBgColor: string;
};

// Hook parameters
export interface UseWorkoutHistoryParams {
  initialLimit?: number; // Default: 2 for home screen, 5 for modal
  batchSize?: number; // Default: 5
  filters?: WorkoutFilters; // Optional filters
  groupByMonth?: boolean; // Whether to group workouts by month
  enableReactivity?: boolean; // Whether to observe database changes (default: true)
  visible?: boolean; // For modal visibility control
  skipPRDetection?: boolean; // Skip expensive PR detection for performance (default: false)
}

// Return type when groupByMonth = false
export type UseWorkoutHistoryResultFlat = {
  workouts: ProcessedRecentWorkout[];
  sections?: never;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
};

// Return type when groupByMonth = true
export type UseWorkoutHistoryResultGrouped = {
  workouts?: never;
  sections: WorkoutHistorySection[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filters: WorkoutFilters;
  handleApplyFilters: (filters: Partial<WorkoutFilters>) => void;
  handleClearFilters: () => void;
};

export type UseWorkoutHistoryResult = UseWorkoutHistoryResultFlat | UseWorkoutHistoryResultGrouped;

// Format relative date for simple display (home screen)
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

/** Recent-workout card duration — locale-aware digits (e.g. Arabic numerals when applicable). */
function formatDurationForRecentWorkout(minutes: number): string {
  const loc = i18n.resolvedLanguage ?? i18n.language;
  if (minutes < 60) {
    return `${formatAppInteger(loc, minutes)}m`; // TODO: use i18n
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0
    ? `${formatAppInteger(loc, hours)}h ${formatAppInteger(loc, mins)}m` // TODO: use i18n
    : `${formatAppInteger(loc, hours)}h`; // TODO: use i18n
}

// Process workout for simple display (home screen)
async function processWorkoutSimple(
  workout: WorkoutLog,
  t: TFunction,
  locale: Locale,
  theme: Theme,
  skipPRDetection: boolean = false
): Promise<ProcessedRecentWorkout> {
  // Calculate duration
  const durationMinutes =
    workout.completedAt && workout.startedAt
      ? Math.round((workout.completedAt - workout.startedAt) / 60000)
      : 0;

  // Get PR count - skip if flag is set for performance
  let prCount: number | null = null;
  if (!skipPRDetection) {
    const prs = await WorkoutAnalytics.detectPersonalRecords(workout);
    prCount = prs.length > 0 ? prs.length : null;
  }

  // Format date
  const dateTimestamp = workout.startedAt || workout.completedAt || Date.now();
  const dateStr = formatRelativeDate(dateTimestamp, t, locale);

  return {
    id: workout.id,
    name: workout.workoutName ?? '',
    date: dateStr,
    duration: formatDurationForRecentWorkout(durationMinutes),
    calories: workout.caloriesBurned || 0,
    prs: prCount,
    image: require('../assets/icon.png'), // Default image
    imageBgColor: theme.colors.background.imageLight,
  };
}

// Function overloads for proper type narrowing
export function useWorkoutHistory(
  params: UseWorkoutHistoryParams & { groupByMonth: true }
): UseWorkoutHistoryResultGrouped;

export function useWorkoutHistory(
  params?: UseWorkoutHistoryParams & { groupByMonth?: false }
): UseWorkoutHistoryResultFlat;

export function useWorkoutHistory({
  initialLimit = 2,
  batchSize = DEFAULT_BATCH_SIZE,
  filters,
  groupByMonth = false,
  enableReactivity = true,
  visible = true,
  skipPRDetection = false,
}: UseWorkoutHistoryParams = {}): UseWorkoutHistoryResult {
  const { t } = useTranslation();
  const { units } = useSettings();
  const theme = useTheme();
  const dateFnsLocale = useDateFnsLocale();

  // State for flat array (home screen)
  const [workouts, setWorkouts] = useState<ProcessedRecentWorkout[]>([]);

  // State for grouped sections (modal)
  const [sections, setSections] = useState<WorkoutHistorySection[]>([]);

  // Common state
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);

  // State for filters (only used when groupByMonth = true)
  const [searchQuery, setSearchQuery] = useState('');
  const [workoutFilters, setWorkoutFilters] = useState<WorkoutFilters>(
    filters || {
      workoutType: 'all',
      dateRange: '30',
      muscleGroups: [],
      minDuration: 0,
    }
  );

  // Load initial batch of workouts
  const loadInitialWorkouts = useCallback(async () => {
    if (!visible) {
      setIsLoading(false);
      // Clear data when not visible to free memory
      if (groupByMonth) {
        setSections([]);
      } else {
        setWorkouts([]);
      }
      return;
    }

    setIsLoading(true);
    setCurrentOffset(0);
    setHasMore(true);

    try {
      // Calculate timeframe from filters
      const timeframe = workoutFilters?.dateRange
        ? calculateDateRange(workoutFilters.dateRange)
        : undefined;

      // Fetch initial batch
      const workoutLogs = await WorkoutService.getWorkoutHistory(timeframe, initialLimit);

      if (workoutLogs.length === 0) {
        if (groupByMonth) {
          setSections([]);
        } else {
          setWorkouts([]);
        }
        setHasMore(false);
        setIsLoading(false);
        return;
      }

      if (groupByMonth && workoutFilters) {
        // Process with filters and group by month
        const validWorkouts = await processWorkouts(workoutLogs, workoutFilters, t, units, theme);
        const groupedSections = groupWorkoutsByMonth(validWorkouts);
        setSections(groupedSections);
      } else {
        // Simple processing for home screen
        const processedWorkouts = await Promise.all(
          workoutLogs.map((workout) =>
            processWorkoutSimple(workout, t, dateFnsLocale, theme, skipPRDetection)
          )
        );
        setWorkouts(processedWorkouts);
      }

      setCurrentOffset(initialLimit);

      // Check if there are more workouts
      if (workoutLogs.length < initialLimit) {
        setHasMore(false);
      } else {
        // Check if there's a next batch
        const nextBatch = await WorkoutService.getWorkoutHistory(timeframe, 1, initialLimit);
        setHasMore(nextBatch.length > 0);
      }
    } catch (err) {
      console.error('Error loading workout history:', err);
      if (groupByMonth) {
        setSections([]);
      } else {
        setWorkouts([]);
      }
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [
    visible,
    groupByMonth,
    workoutFilters,
    initialLimit,
    t,
    units,
    theme,
    dateFnsLocale,
    skipPRDetection,
  ]);

  // Load more workouts (pagination)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !visible) {
      return;
    }

    setIsLoadingMore(true);

    // Small delay to ensure React processes the state update and shows loading state
    await new Promise<void>((resolve) => setTimeout(resolve, 1));

    try {
      // Calculate timeframe from filters
      const timeframe = workoutFilters?.dateRange
        ? calculateDateRange(workoutFilters.dateRange)
        : undefined;

      // Fetch next batch
      const workoutLogs = await WorkoutService.getWorkoutHistory(
        timeframe,
        batchSize,
        currentOffset
      );

      if (workoutLogs.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      if (groupByMonth && workoutFilters) {
        // Process with filters
        const validWorkouts = await processWorkouts(workoutLogs, workoutFilters, t, units, theme);

        if (validWorkouts.length > 0) {
          // Merge with existing sections
          setSections((prev) => mergeWorkoutSections(prev, validWorkouts));
        }
      } else {
        // Simple processing
        const processedWorkouts = await Promise.all(
          workoutLogs.map((workout) =>
            processWorkoutSimple(workout, t, dateFnsLocale, theme, skipPRDetection)
          )
        );
        // Append to existing workouts
        setWorkouts((prev) => [...prev, ...processedWorkouts]);
      }

      const newOffset = currentOffset + workoutLogs.length;
      setCurrentOffset(newOffset);

      // Check if there are more workouts
      if (workoutLogs.length < batchSize) {
        setHasMore(false);
      } else {
        // Check if there's a next batch
        const nextBatch = await WorkoutService.getWorkoutHistory(timeframe, 1, newOffset);
        setHasMore(nextBatch.length > 0);
      }
    } catch (err) {
      console.error('Error loading more workouts:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    isLoadingMore,
    hasMore,
    visible,
    workoutFilters,
    batchSize,
    currentOffset,
    groupByMonth,
    t,
    units,
    theme,
    dateFnsLocale,
    skipPRDetection,
  ]);

  // Handle filter changes
  const handleApplyFilters = useCallback((newFilters: Partial<WorkoutFilters>) => {
    setWorkoutFilters((prev) => ({
      workoutType: newFilters.workoutType ?? prev.workoutType ?? 'all',
      dateRange: newFilters.dateRange ?? prev.dateRange ?? '30',
      muscleGroups: newFilters.muscleGroups ?? prev.muscleGroups ?? [],
      minDuration: newFilters.minDuration ?? prev.minDuration ?? 0,
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setWorkoutFilters({
      workoutType: 'all',
      dateRange: '30',
      muscleGroups: [],
      minDuration: 0,
    });
  }, []);

  // React to filter changes
  useEffect(() => {
    if (visible && groupByMonth) {
      loadInitialWorkouts();
    }
  }, [visible, workoutFilters, loadInitialWorkouts, groupByMonth]);

  // Observe for new completed workouts to trigger reload (reactivity)
  useEffect(() => {
    if (!enableReactivity || !visible) {
      // Still load initial data even if reactivity is disabled
      if (visible) {
        loadInitialWorkouts();
      }
      return;
    }

    // Observe completed workouts to detect when new ones are added
    const query = database.get<WorkoutLog>('workout_logs').query(
      Q.where('completed_at', Q.notEq(null)),
      Q.where('deleted_at', Q.eq(null)),
      Q.sortBy('completed_at', Q.desc),
      Q.take(1) // Only need to know if there are any changes
    );

    const subscription = query.observe().subscribe({
      next: () => {
        // When a new workout is completed, reload the initial batch
        loadInitialWorkouts();
      },
      error: (err) => {
        console.error('Error observing workout history:', err);
      },
    });

    // Load initial data
    loadInitialWorkouts();

    return () => subscription.unsubscribe();
  }, [enableReactivity, visible, loadInitialWorkouts]);

  // Apply search filter for grouped sections
  const filteredSections = useMemo(() => {
    if (!groupByMonth || !searchQuery) {
      return sections;
    }
    return filterWorkoutsBySearch(sections, searchQuery);
  }, [groupByMonth, sections, searchQuery]);

  // Always call both useMemo hooks (React Hooks rules)
  const flatResult = useMemo(
    () => ({
      workouts: workouts, // Always return array, never undefined
      isLoading,
      isLoadingMore,
      hasMore,
      loadMore,
    }),
    [workouts, isLoading, isLoadingMore, hasMore, loadMore]
  );

  const groupedResult = useMemo(
    () => ({
      sections: filteredSections,
      isLoading,
      isLoadingMore,
      hasMore,
      loadMore,
      searchQuery,
      setSearchQuery,
      filters: workoutFilters,
      handleApplyFilters,
      handleClearFilters,
    }),
    [
      filteredSections,
      isLoading,
      isLoadingMore,
      hasMore,
      loadMore,
      searchQuery,
      workoutFilters,
      handleApplyFilters,
      handleClearFilters,
    ]
  );

  // Return appropriate type based on groupByMonth
  return (groupByMonth ? groupedResult : flatResult) as UseWorkoutHistoryResult;
}
