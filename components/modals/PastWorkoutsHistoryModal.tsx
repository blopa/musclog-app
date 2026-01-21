import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Activity, Dumbbell, Search, SlidersHorizontal, Square, Trophy } from 'lucide-react-native';
import { format } from 'date-fns';
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { useTranslation } from 'react-i18next';
import { GenericCard } from '../cards/GenericCard';
import { PastWorkoutsHistoryFilterMenu } from './PastWorkoutsHistoryFilterMenu';
import { WorkoutService } from '../../database/services/WorkoutService';
import { WorkoutAnalytics } from '../../database/services/WorkoutAnalytics';
import { database } from '../../database';
import { Q } from '@nozbe/watermelondb';
import Exercise from '../../database/models/Exercise';
import WorkoutLogSet from '../../database/models/WorkoutLogSet';
import { SkeletonLoader } from '../theme/SkeletonLoader';
import { Button } from '../theme/Button';

type WorkoutHistorySection = {
  month: string;
  workouts: WorkoutHistoryItem[];
};

type WorkoutHistoryItem = {
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

type WorkoutHistoryModalProps = {
  visible: boolean;
  onClose: () => void;
};

// Helper function to format duration in minutes to readable format
function formatDuration(minutes: number, t: (key: string) => string): string {
  if (minutes < 60) {
    return `${minutes} ${t('common.min')}`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}${t('common.min')}` : `${hours}h`;
}

// Helper function to format volume
function formatVolume(volume: number, t: (key: string) => string): string {
  const kg = t('workoutSession.kg');
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k ${kg}`;
  }
  return `${Math.round(volume).toLocaleString()} ${kg}`;
}

// Helper function to get icon and colors based on workout type
function getWorkoutIcon(workoutName: string) {
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

type WorkoutFilters = {
  workoutType?: 'all' | 'strength' | 'cardio' | 'hiit' | 'yoga';
  dateRange?: '30' | '90' | 'custom';
  muscleGroups: string[];
  minDuration: number;
};

const BATCH_SIZE = 5;

export default function PastWorkoutsHistoryModal({ visible, onClose }: WorkoutHistoryModalProps) {
  const { t } = useTranslation();
  const [isFilterMenuVisible, setIsFilterMenuVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [workoutHistoryData, setWorkoutHistoryData] = useState<WorkoutHistorySection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageOffset, setPageOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState<WorkoutFilters>({
    workoutType: 'all',
    dateRange: '30',
    muscleGroups: [],
    minDuration: 0,
  });

  // Helper function to determine workout type from name
  const getWorkoutTypeFromName = (name: string): 'strength' | 'cardio' | 'hiit' | 'yoga' | null => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('run') || nameLower.includes('cardio') || nameLower.includes('run')) {
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
  };

  // Helper function to get muscle groups from a workout
  const getMuscleGroupsFromWorkout = async (workoutId: string): Promise<string[]> => {
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
  };

  // Helper function to normalize muscle group names (match filter menu IDs)
  const normalizeMuscleGroup = (group: string): string => {
    const normalized = group.toLowerCase().replace(/\s+/g, '-');
    // Map common variations
    if (normalized.includes('full') || normalized.includes('body')) {
      return 'full-body';
    }
    return normalized;
  };

  // Helper function to process workouts and apply filters
  const processWorkouts = useCallback(
    async (
      workouts: Awaited<ReturnType<typeof WorkoutService.getWorkoutHistory>>
    ): Promise<WorkoutHistoryItem[]> => {
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
    },
    [filters.minDuration, filters.muscleGroups, filters.workoutType, t]
  );

  // Helper function to group workouts by month
  const groupWorkoutsByMonth = useCallback(
    (workouts: WorkoutHistoryItem[]): WorkoutHistorySection[] => {
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
    },
    []
  );

  // Helper function to merge workout sections
  const mergeWorkoutSections = useCallback(
    (
      existing: WorkoutHistorySection[],
      newWorkouts: WorkoutHistoryItem[]
    ): WorkoutHistorySection[] => {
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
    },
    []
  );

  const loadWorkoutHistory = useCallback(async () => {
    setIsLoading(true);
    setPageOffset(0);
    setHasMore(true);
    try {
      // Calculate date range filter
      let timeframe: { startDate: number; endDate: number } | undefined;
      if (filters.dateRange === '30') {
        const endDate = Date.now();
        const startDate = endDate - 30 * 24 * 60 * 60 * 1000;
        timeframe = { startDate, endDate };
      } else if (filters.dateRange === '90') {
        const endDate = Date.now();
        const startDate = endDate - 90 * 24 * 60 * 60 * 1000;
        timeframe = { startDate, endDate };
      }
      // 'custom' date range would need a date picker, skip for now

      // Fetch initial batch of workouts (5 workouts)
      // Don't pass offset when it's 0 to avoid WatermelonDB issues
      const workouts = await WorkoutService.getWorkoutHistory(timeframe, BATCH_SIZE);

      // Process workouts and apply filters
      const validWorkouts = await processWorkouts(workouts);

      // Group workouts by month
      const sections = groupWorkoutsByMonth(validWorkouts);

      setWorkoutHistoryData(sections);
      setPageOffset(BATCH_SIZE);

      // Check if there are more workouts to load
      // If we got fewer workouts than requested, or if all were filtered out, there's no more
      if (workouts.length < BATCH_SIZE) {
        setHasMore(false);
      } else {
        // We need to check if there are more workouts after filtering
        // Since filtering happens client-side, we'll fetch one more to check
        const nextBatch = await WorkoutService.getWorkoutHistory(timeframe, 1, BATCH_SIZE);
        setHasMore(nextBatch.length > 0);
      }
    } catch (error) {
      console.error('Error loading workout history:', error);
      setWorkoutHistoryData([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [
    filters.dateRange,
    filters.minDuration,
    filters.muscleGroups,
    filters.workoutType,
    processWorkouts,
    groupWorkoutsByMonth,
  ]);

  const loadMoreWorkouts = useCallback(async () => {
    if (isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);
    
    // Small delay to ensure React processes the state update before async work
    // This ensures the Button shows loading state immediately
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    
    try {
      // Calculate date range filter
      let timeframe: { startDate: number; endDate: number } | undefined;
      if (filters.dateRange === '30') {
        const endDate = Date.now();
        const startDate = endDate - 30 * 24 * 60 * 60 * 1000;
        timeframe = { startDate, endDate };
      } else if (filters.dateRange === '90') {
        const endDate = Date.now();
        const startDate = endDate - 90 * 24 * 60 * 60 * 1000;
        timeframe = { startDate, endDate };
      }

      // Fetch next batch
      const workouts = await WorkoutService.getWorkoutHistory(timeframe, BATCH_SIZE, pageOffset);

      if (workouts.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      // Process workouts and apply filters
      const validWorkouts = await processWorkouts(workouts);

      if (validWorkouts.length > 0) {
        // Merge new workouts with existing data
        const mergedSections = mergeWorkoutSections(workoutHistoryData, validWorkouts);
        setWorkoutHistoryData(mergedSections);
      }

      // Update offset
      const newOffset = pageOffset + workouts.length;
      setPageOffset(newOffset);

      // Check if there are more workouts
      if (workouts.length < BATCH_SIZE) {
        setHasMore(false);
      } else {
        // Check if there's at least one more workout
        const nextBatch = await WorkoutService.getWorkoutHistory(timeframe, 1, newOffset);
        setHasMore(nextBatch.length > 0);
      }
    } catch (error) {
      console.error('Error loading more workouts:', error);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    isLoadingMore,
    hasMore,
    pageOffset,
    filters.dateRange,
    processWorkouts,
    mergeWorkoutSections,
    workoutHistoryData,
  ]);

  // Load workout history when modal becomes visible or filters change
  useEffect(() => {
    if (visible) {
      // Reset loading state immediately when modal opens for instant feedback
      setIsLoading(true);
      setWorkoutHistoryData([]);
      setPageOffset(0);
      setHasMore(true);
      setIsLoadingMore(false);
      // Use setTimeout to defer data loading slightly, allowing modal to render first
      // This makes the modal feel instant and snappy
      const timeoutId = setTimeout(() => {
        loadWorkoutHistory();
      }, 0);
      
      return () => {
        clearTimeout(timeoutId);
      };
    } else {
      // Reset state when modal closes
      setIsLoading(false);
      setWorkoutHistoryData([]);
      setPageOffset(0);
      setHasMore(true);
      setIsLoadingMore(false);
    }
  }, [visible, filters, loadWorkoutHistory]);

  // Filter workouts based on search query
  const filteredWorkoutHistoryData = searchQuery
    ? workoutHistoryData
        .map((section) => ({
          ...section,
          workouts: section.workouts.filter((workout) =>
            workout.name.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter((section) => section.workouts.length > 0)
    : workoutHistoryData;

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('pastWorkoutHistory.title')}
      scrollable={false}
    >
      <View className="flex-1">
        {/* Header */}
        <View
          className="px-4 pb-4 pt-4"
          style={{
            backgroundColor: theme.colors.background.darkBackground,
          }}
        >
          {/* Search and Filter */}
          <View className="flex-row items-center gap-2">
            <View className="relative flex-1">
              <View
                style={{
                  position: 'absolute',
                  left: theme.spacing.padding.md,
                  top: 0,
                  bottom: 0,
                  justifyContent: 'center',
                  zIndex: 1,
                }}
              >
                <Search size={theme.iconSize.sm} color={theme.colors.text.secondary} />
              </View>
              <TextInput
                className="h-11 w-full pl-10 pr-4"
                placeholder={t('pastWorkoutHistory.searchPlaceholder')}
                placeholderTextColor={theme.colors.text.secondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={{
                  backgroundColor: theme.colors.background.card,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: theme.colors.background.white5,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.colors.text.primary,
                  height: 44,
                }}
              />
            </View>
            <Pressable
              className="h-11 w-11 items-center justify-center border"
              style={{
                backgroundColor: theme.colors.background.card,
                borderColor: theme.colors.background.white5,
                borderRadius: theme.borderRadius.md,
              }}
              onPress={() => setIsFilterMenuVisible(true)}
            >
              <SlidersHorizontal size={theme.iconSize.sm} color={theme.colors.text.primary} />
            </Pressable>
          </View>
        </View>

        {/* Main Content */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View className="flex-1 gap-6 p-4">
              {/* Month header skeleton - only show once */}
              <View>
                <SkeletonLoader
                  width={theme.size['24']}
                  height={theme.size['3']}
                  borderRadius={theme.borderRadius.sm}
                  className="mb-3 px-1"
                />
                {/* Skeleton Loaders - Show 5 skeleton cards to match expected batch size */}
                <View className="flex-col gap-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <View
                      key={i}
                      className="rounded-lg border p-4"
                      style={{
                        backgroundColor: theme.colors.background.card,
                        borderColor: theme.colors.background.white5,
                      }}
                    >
                      <View className="flex-col gap-4">
                        {/* Card Header Skeleton */}
                        <View className="flex-row items-start justify-between">
                          <View className="flex-row items-center gap-3 flex-1">
                            <SkeletonLoader
                              width={theme.size['12']}
                              height={theme.size['12']}
                              borderRadius={theme.borderRadius.md}
                            />
                            <View className="flex-1 gap-2">
                              <SkeletonLoader width="70%" height={theme.size['4']} />
                              <SkeletonLoader width="50%" height={theme.size['3']} />
                            </View>
                          </View>
                          {i % 3 === 0 && (
                            <SkeletonLoader
                              width={theme.size['12']}
                              height={theme.size['5']}
                              borderRadius={theme.borderRadius.md}
                            />
                          )}
                        </View>
                        {/* Stats Grid Skeleton */}
                        <View className="flex-row gap-2">
                          {[1, 2, 3].map((statIndex) => (
                            <View
                              key={statIndex}
                              className="flex-1 gap-2 rounded-lg p-2"
                              style={{ backgroundColor: theme.colors.background.white5 }}
                            >
                              <SkeletonLoader
                                width="60%"
                                height={theme.size['3']}
                                borderRadius={theme.borderRadius.sm}
                              />
                              <SkeletonLoader
                                width="80%"
                                height={theme.size['4']}
                                borderRadius={theme.borderRadius.sm}
                              />
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : filteredWorkoutHistoryData.length === 0 ? (
            <View className="flex-1 items-center justify-center px-4 py-20">
              <Text
                style={{
                  fontSize: theme.typography.fontSize.base,
                  color: theme.colors.text.secondary,
                  textAlign: 'center',
                }}
              >
                {searchQuery
                  ? t('pastWorkoutHistory.noWorkoutsFound')
                  : t('pastWorkoutHistory.noWorkoutHistory')}
              </Text>
            </View>
          ) : (
            <View className="flex-1 gap-6 p-4">
              {filteredWorkoutHistoryData.map((section, sectionIndex) => (
                <View key={section.month}>
                  {/* Month Header */}
                  <Text
                    className="mb-3 px-1 font-bold uppercase tracking-widest"
                    style={{
                      fontSize: theme.typography.fontSize.xs,
                      color: theme.colors.text.secondary,
                      opacity: sectionIndex === filteredWorkoutHistoryData.length - 1 ? 0.8 : 1,
                    }}
                  >
                    {section.month}
                  </Text>

                  {/* Workout Cards */}
                  <View className="flex-col gap-3">
                    {section.workouts.map((workout) => {
                      const Icon = workout.icon;
                      const isLastMonth = sectionIndex === filteredWorkoutHistoryData.length - 1;
                      const opacity = isLastMonth ? 0.8 : 1;

                      return (
                        <View
                          key={workout.id}
                          style={{
                            opacity,
                          }}
                        >
                          <GenericCard
                            variant="card"
                            isPressable={true}
                            onPress={() => {
                              // Handle press if needed
                            }}
                          >
                            <View className="flex-col gap-4 p-4">
                              {/* Card Header */}
                              <View className="flex-row items-start justify-between">
                                <View className="flex-row items-center gap-3">
                                  <View
                                    className="h-12 w-12 items-center justify-center rounded-lg"
                                    style={{
                                      backgroundColor: workout.iconBgOpacity,
                                    }}
                                  >
                                    <Icon size={theme.iconSize.xl} color={workout.iconBgColor} />
                                  </View>
                                  <View>
                                    <Text
                                      className="font-bold"
                                      style={{
                                        fontSize: theme.typography.fontSize.base,
                                        color: theme.colors.text.primary,
                                      }}
                                    >
                                      {workout.name}
                                    </Text>
                                    <Text
                                      className="text-xs"
                                      style={{
                                        color: theme.colors.text.secondary,
                                      }}
                                    >
                                      {workout.date}
                                    </Text>
                                  </View>
                                </View>
                                {workout.prCount && (
                                  <View
                                    className="flex-row items-center gap-1 rounded px-2 py-0.5"
                                    style={{
                                      backgroundColor: theme.colors.status.emerald400_10,
                                    }}
                                  >
                                    <Trophy
                                      size={theme.iconSize.xs}
                                      color={theme.colors.status.emeraldLight}
                                    />
                                    <Text
                                      style={{
                                        fontSize: 10,
                                        fontWeight: theme.typography.fontWeight.bold,
                                        color: theme.colors.status.emeraldLight,
                                        textTransform: 'uppercase',
                                        letterSpacing: theme.typography.letterSpacing.wider,
                                      }}
                                    >
                                      {workout.prCount === 1
                                        ? t('pastWorkoutHistory.prBadge.singular', {
                                            count: workout.prCount,
                                          })
                                        : t('pastWorkoutHistory.prBadge.plural', {
                                            count: workout.prCount,
                                          })}
                                    </Text>
                                  </View>
                                )}
                              </View>

                              {/* Stats Grid */}
                              <View className="flex-row gap-2">
                                {workout.stats.map((stat, statIndex) => (
                                  <View
                                    key={statIndex}
                                    className="flex-1 rounded-lg p-2"
                                    style={{
                                      backgroundColor: theme.colors.background.white5,
                                    }}
                                  >
                                    <Text
                                      className="text-center"
                                      style={{
                                        fontSize: theme.typography.fontSize.xs,
                                        color: theme.colors.text.secondary,
                                      }}
                                    >
                                      {stat.label}
                                    </Text>
                                    <Text
                                      className="text-center font-bold"
                                      style={{
                                        fontSize: theme.typography.fontSize.sm,
                                        color: theme.colors.text.primary,
                                      }}
                                    >
                                      {stat.value}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          </GenericCard>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}

              {/* Load More Button */}
              {hasMore && !searchQuery && (
                <View className="py-4">
                  <Button
                    label={isLoadingMore ? t('pastWorkoutHistory.loadingMore') : t('pastWorkoutHistory.loadMore')}
                    onPress={loadMoreWorkouts}
                    size="sm"
                    variant="outline"
                    disabled={isLoadingMore}
                    loading={isLoadingMore}
                    width="full"
                  />
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Filter Menu */}
      <PastWorkoutsHistoryFilterMenu
        visible={isFilterMenuVisible}
        onClose={() => setIsFilterMenuVisible(false)}
        initialFilters={{
          workoutType: filters.workoutType,
          dateRange: filters.dateRange,
          muscleGroups: filters.muscleGroups as (
            | 'chest'
            | 'back'
            | 'legs'
            | 'shoulders'
            | 'arms'
            | 'core'
            | 'full-body'
          )[],
          minDuration: filters.minDuration,
        }}
        onApplyFilters={(newFilters) => {
          setFilters({
            workoutType: newFilters.workoutType || 'all',
            dateRange: newFilters.dateRange || '30',
            muscleGroups: newFilters.muscleGroups || [],
            minDuration: newFilters.minDuration || 0,
          });
        }}
        onClearFilters={() => {
          setFilters({
            workoutType: 'all',
            dateRange: '30',
            muscleGroups: [],
            minDuration: 0,
          });
        }}
      />
    </FullScreenModal>
  );
}
