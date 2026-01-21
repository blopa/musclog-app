import { format } from 'date-fns';
import { Activity, Dumbbell, Square } from 'lucide-react-native';
import { Q } from '@nozbe/watermelondb';
import { theme } from '../theme';
import { database } from '../database';
import WorkoutLog from '../database/models/WorkoutLog';
import WorkoutLogSet from '../database/models/WorkoutLogSet';
import Exercise from '../database/models/Exercise';
import { WorkoutAnalytics } from '../database/services/WorkoutAnalytics';

// Type definitions
export type WorkoutType = 'strength' | 'cardio' | 'hiit' | 'yoga';

export type WorkoutFilters = {
  workoutType?: 'all' | 'strength' | 'cardio' | 'hiit' | 'yoga';
  dateRange?: '30' | '90' | 'custom';
  muscleGroups: string[];
  minDuration: number;
};

export type IconData = {
  icon: typeof Dumbbell;
  iconBgColor: string;
  iconBgOpacity: string;
};

export type DateRange = {
  startDate: number;
  endDate: number;
};

export type WorkoutHistoryItem = {
  id: string;
  name: string;
  date: string;
  dateTimestamp: number; // For grouping by month
  iconBgColor: string;
  iconBgOpacity: string;
  icon: typeof Dumbbell;
  prCount: number | null;
  stats: { label: string; value: string }[];
};

export type WorkoutHistorySection = {
  month: string;
  workouts: WorkoutHistoryItem[];
};

export type TranslationFunction = (key: string) => string;

// Formatting Functions

/**
 * Format duration in minutes to readable format
 */
export function formatDuration(minutes: number, t: TranslationFunction): string {
  if (minutes < 60) {
    return `${minutes} ${t('common.min')}`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}${t('common.min')}` : `${hours}h`;
}

/**
 * Format volume with kg suffix
 */
export function formatVolume(volume: number, t: TranslationFunction): string {
  const kg = t('workoutSession.kg');
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k ${kg}`;
  }
  return `${Math.round(volume).toLocaleString()} ${kg}`;
}

// Workout Classification

/**
 * Get icon and colors based on workout type
 */
export function getWorkoutIcon(workoutName: string): IconData {
  const nameLower = workoutName.toLowerCase();
  if (nameLower.includes('run') || nameLower.includes('cardio')) {
    return {
      icon: Activity,
      iconBgColor: theme.colors.status.emerald,
      iconBgOpacity: theme.colors.status.emerald10,
    };
  }
  if (nameLower.includes('leg') || nameLower.includes('squat')) {
    return {
      icon: Square,
      iconBgColor: theme.colors.accent.primary,
      iconBgOpacity: theme.colors.accent.primary10,
    };
  }
  return {
    icon: Dumbbell,
    iconBgColor: theme.colors.status.indigo600,
    iconBgOpacity: theme.colors.status.indigo10,
  };
}

/**
 * Determine workout type from name
 */
export function getWorkoutTypeFromName(name: string): WorkoutType | null {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('run') || nameLower.includes('cardio')) {
    return 'cardio';
  }
  if (nameLower.includes('hiit') || nameLower.includes('interval')) {
    return 'hiit';
  }
  if (nameLower.includes('yoga') || nameLower.includes('stretch')) {
    return 'yoga';
  }
  // Default to strength for weightlifting workouts
  return 'strength';
}

/**
 * Get muscle groups from a workout
 */
export async function getMuscleGroupsFromWorkout(workoutId: string): Promise<string[]> {
  try {
    // Get all sets for this workout
    const sets = await database
      .get<WorkoutLogSet>('workout_log_sets')
      .query(Q.where('workout_log_id', workoutId), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    // Get unique exercise IDs
    const exerciseIds = [...new Set(sets.map((set) => set.exerciseId))];

    if (exerciseIds.length === 0) {
      return [];
    }

    // Get exercises and their muscle groups
    const exercises = await database
      .get<Exercise>('exercises')
      .query(Q.where('id', Q.oneOf(exerciseIds)), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    // Get unique muscle groups
    return [...new Set(exercises.map((ex) => ex.muscleGroup.toLowerCase()))];
  } catch (error) {
    console.error('Error getting muscle groups from workout:', error);
    return [];
  }
}

/**
 * Normalize muscle group names (match filter menu IDs)
 */
export function normalizeMuscleGroup(group: string): string {
  const normalized = group.toLowerCase().replace(/\s+/g, '-');
  // Map common variations
  if (normalized.includes('full') || normalized.includes('body')) {
    return 'full-body';
  }
  return normalized;
}

// Data Processing

/**
 * Calculate date range from filter
 */
export function calculateDateRange(dateRange: '30' | '90' | 'custom'): DateRange | undefined {
  if (dateRange === '30') {
    const endDate = Date.now();
    const startDate = endDate - 30 * 24 * 60 * 60 * 1000;
    return { startDate, endDate };
  }
  if (dateRange === '90') {
    const endDate = Date.now();
    const startDate = endDate - 90 * 24 * 60 * 60 * 1000;
    return { startDate, endDate };
  }
  // 'custom' date range would need a date picker, skip for now
  return undefined;
}

/**
 * Process workouts and apply filters
 */
export async function processWorkouts(
  workouts: WorkoutLog[],
  filters: WorkoutFilters,
  t: TranslationFunction
): Promise<WorkoutHistoryItem[]> {
  const processedWorkouts: (WorkoutHistoryItem | null)[] = await Promise.all(
    workouts.map(async (workout) => {
      // Calculate duration
      const durationMinutes =
        workout.completedAt && workout.startedAt
          ? Math.round((workout.completedAt - workout.startedAt) / 60000)
          : 0;

      // Apply min duration filter
      if (durationMinutes < filters.minDuration) {
        return null;
      }

      // Get workout type and apply filter
      if (filters.workoutType !== 'all') {
        const workoutType = getWorkoutTypeFromName(workout.workoutName);
        if (workoutType !== filters.workoutType) {
          return null;
        }
      }

      // Get muscle groups and apply filter
      if (filters.muscleGroups.length > 0) {
        const workoutMuscleGroups = await getMuscleGroupsFromWorkout(workout.id);
        const normalizedWorkoutGroups = workoutMuscleGroups.map(normalizeMuscleGroup);
        const normalizedFilterGroups = filters.muscleGroups.map((g) =>
          g.toLowerCase().replace(/\s+/g, '-')
        );

        // Check if workout has any of the selected muscle groups
        const hasMatchingMuscleGroup = normalizedWorkoutGroups.some((group) =>
          normalizedFilterGroups.includes(group)
        );

        if (!hasMatchingMuscleGroup) {
          return null;
        }
      }

      // Get PR count
      const prs = await WorkoutAnalytics.detectPersonalRecords(workout);
      const prCount = prs.length > 0 ? prs.length : null;

      // Format date
      const dateTimestamp = workout.startedAt || workout.completedAt || Date.now();
      const workoutDate = new Date(dateTimestamp);
      const dateStr = format(workoutDate, 'MMM d • hh:mm a');

      // Get icon and colors
      const iconData = getWorkoutIcon(workout.workoutName);

      // Format stats
      const stats: { label: string; value: string }[] = [
        {
          label: t('pastWorkoutHistory.stats.duration'),
          value: formatDuration(durationMinutes, t),
        },
      ];

      // Add volume if available
      if (workout.totalVolume && workout.totalVolume > 0) {
        stats.push({
          label: t('pastWorkoutHistory.stats.volume'),
          value: formatVolume(workout.totalVolume, t),
        });
      }

      // Add calories if available
      if (workout.caloriesBurned && workout.caloriesBurned > 0) {
        stats.push({
          label: t('pastWorkoutHistory.stats.calories'),
          value: `${workout.caloriesBurned} ${t('common.kcal')}`,
        });
      }

      return {
        id: workout.id,
        name: workout.workoutName,
        date: dateStr,
        dateTimestamp,
        iconBgColor: iconData.iconBgColor,
        iconBgOpacity: iconData.iconBgOpacity,
        icon: iconData.icon,
        prCount,
        stats,
      };
    })
  );

  // Filter out null values (workouts that didn't match filters)
  return processedWorkouts.filter((workout): workout is WorkoutHistoryItem => workout !== null);
}

/**
 * Group workouts by month
 */
export function groupWorkoutsByMonth(workouts: WorkoutHistoryItem[]): WorkoutHistorySection[] {
  const groupedByMonth = new Map<string, WorkoutHistoryItem[]>();

  workouts.forEach((workout) => {
    const date = new Date(workout.dateTimestamp);
    const monthKey = format(date, 'MMMM yyyy');

    if (!groupedByMonth.has(monthKey)) {
      groupedByMonth.set(monthKey, []);
    }
    groupedByMonth.get(monthKey)!.push(workout);
  });

  return Array.from(groupedByMonth.entries())
    .map(([month, workouts]) => ({
      month,
      workouts,
    }))
    .sort((a, b) => {
      const dateA = new Date(a.month);
      const dateB = new Date(b.month);
      return dateB.getTime() - dateA.getTime();
    });
}

/**
 * Merge workout sections
 */
export function mergeWorkoutSections(
  existing: WorkoutHistorySection[],
  newWorkouts: WorkoutHistoryItem[]
): WorkoutHistorySection[] {
  // Create a map of existing sections and track existing workout IDs to avoid duplicates
  const sectionMap = new Map<string, WorkoutHistoryItem[]>();
  const existingWorkoutIds = new Set<string>();

  existing.forEach((section) => {
    sectionMap.set(section.month, [...section.workouts]);
    section.workouts.forEach((workout) => {
      existingWorkoutIds.add(workout.id);
    });
  });

  // Add new workouts to appropriate sections (skip duplicates)
  newWorkouts.forEach((workout) => {
    // Skip if this workout already exists
    if (existingWorkoutIds.has(workout.id)) {
      return;
    }

    const date = new Date(workout.dateTimestamp);
    const monthKey = format(date, 'MMMM yyyy');

    if (!sectionMap.has(monthKey)) {
      sectionMap.set(monthKey, []);
    }
    sectionMap.get(monthKey)!.push(workout);
    existingWorkoutIds.add(workout.id);
  });

  // Convert back to array and sort
  return Array.from(sectionMap.entries())
    .map(([month, workouts]) => ({
      month,
      workouts: workouts.sort((a, b) => b.dateTimestamp - a.dateTimestamp), // Sort within month (newest first)
    }))
    .sort((a, b) => {
      const dateA = new Date(a.month);
      const dateB = new Date(b.month);
      return dateB.getTime() - dateA.getTime();
    });
}

/**
 * Filter workouts by search query
 */
export function filterWorkoutsBySearch(
  sections: WorkoutHistorySection[],
  searchQuery: string
): WorkoutHistorySection[] {
  if (!searchQuery) {
    return sections;
  }

  return sections
    .map((section) => ({
      ...section,
      workouts: section.workouts.filter((workout) =>
        workout.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((section) => section.workouts.length > 0);
}
