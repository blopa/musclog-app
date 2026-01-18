import React, { useEffect, useState } from 'react';
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
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Helper function to format volume
function formatVolume(volume: number): string {
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k kg`;
  }
  return `${Math.round(volume).toLocaleString()} kg`;
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

export default function PastWorkoutsHistoryModal({ visible, onClose }: WorkoutHistoryModalProps) {
  const { t } = useTranslation();
  const [isFilterMenuVisible, setIsFilterMenuVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [workoutHistoryData, setWorkoutHistoryData] = useState<WorkoutHistorySection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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

  const loadWorkoutHistory = async () => {
    setIsLoading(true);
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

      // Fetch completed workouts from database with date range filter
      const workouts = await WorkoutService.getWorkoutHistory(timeframe);

      // Process each workout to get PR count and format data
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
            { label: 'Duration', value: formatDuration(durationMinutes) },
          ];

          // Add volume if available
          if (workout.totalVolume && workout.totalVolume > 0) {
            stats.push({ label: 'Volume', value: formatVolume(workout.totalVolume) });
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
      const validWorkouts = processedWorkouts.filter(
        (workout): workout is WorkoutHistoryItem => workout !== null
      );

      // Group workouts by month
      const groupedByMonth = new Map<string, WorkoutHistoryItem[]>();

      validWorkouts.forEach((workout) => {
        // Extract month-year from workout date timestamp
        const date = new Date(workout.dateTimestamp);
        const monthKey = format(date, 'MMMM yyyy');

        if (!groupedByMonth.has(monthKey)) {
          groupedByMonth.set(monthKey, []);
        }
        groupedByMonth.get(monthKey)!.push(workout);
      });

      // Convert to array format and sort by month (newest first)
      const sections: WorkoutHistorySection[] = Array.from(groupedByMonth.entries())
        .map(([month, workouts]) => ({
          month,
          workouts,
        }))
        .sort((a, b) => {
          const dateA = new Date(a.month);
          const dateB = new Date(b.month);
          return dateB.getTime() - dateA.getTime();
        });

      setWorkoutHistoryData(sections);
    } catch (error) {
      console.error('Error loading workout history:', error);
      setWorkoutHistoryData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load workout history when modal becomes visible or filters change
  useEffect(() => {
    if (visible) {
      loadWorkoutHistory();
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
      scrollable={false}>
      <View className="flex-1">
        {/* Header */}
        <View
          className="px-4 pb-4 pt-4"
          style={{
            backgroundColor: theme.colors.background.darkBackground,
          }}>
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
                }}>
                <Search size={theme.iconSize.sm} color={theme.colors.text.secondary} />
              </View>
              <TextInput
                className="h-11 w-full pl-10 pr-4"
                placeholder="Search sessions..."
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
              onPress={() => setIsFilterMenuVisible(true)}>
              <SlidersHorizontal size={theme.iconSize.sm} color={theme.colors.text.primary} />
            </Pressable>
          </View>
        </View>

        {/* Main Content */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View className="flex-1 items-center justify-center py-20">
              <ActivityIndicator size="large" color={theme.colors.accent.primary} />
            </View>
          ) : filteredWorkoutHistoryData.length === 0 ? (
            <View className="flex-1 items-center justify-center px-4 py-20">
              <Text
                style={{
                  fontSize: theme.typography.fontSize.base,
                  color: theme.colors.text.secondary,
                  textAlign: 'center',
                }}>
                {searchQuery
                  ? 'No workouts found matching your search.'
                  : 'No workout history yet.'}
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
                    }}>
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
                          }}>
                          <GenericCard
                            variant="card"
                            isPressable={true}
                            onPress={() => {
                              // Handle press if needed
                            }}>
                            <View className="flex-col gap-4 p-4">
                              {/* Card Header */}
                              <View className="flex-row items-start justify-between">
                                <View className="flex-row items-center gap-3">
                                  <View
                                    className="h-12 w-12 items-center justify-center rounded-lg"
                                    style={{
                                      backgroundColor: workout.iconBgOpacity,
                                    }}>
                                    <Icon size={theme.iconSize.xl} color={workout.iconBgColor} />
                                  </View>
                                  <View>
                                    <Text
                                      className="font-bold"
                                      style={{
                                        fontSize: theme.typography.fontSize.base,
                                        color: theme.colors.text.primary,
                                      }}>
                                      {workout.name}
                                    </Text>
                                    <Text
                                      className="text-xs"
                                      style={{
                                        color: theme.colors.text.gray400,
                                      }}>
                                      {workout.date}
                                    </Text>
                                  </View>
                                </View>
                                {workout.prCount && (
                                  <View
                                    className="flex-row items-center gap-1 rounded px-2 py-0.5"
                                    style={{
                                      backgroundColor: theme.colors.status.emerald400_10,
                                    }}>
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
                                      }}>
                                      {workout.prCount} PR{workout.prCount > 1 ? 's' : ''}
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
                                    }}>
                                    <Text
                                      className="text-center"
                                      style={{
                                        fontSize: theme.typography.fontSize.xs,
                                        color: theme.colors.text.gray400,
                                      }}>
                                      {stat.label}
                                    </Text>
                                    <Text
                                      className="text-center font-bold"
                                      style={{
                                        fontSize: theme.typography.fontSize.sm,
                                        color: theme.colors.text.primary,
                                      }}>
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
