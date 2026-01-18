import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Search, SlidersHorizontal, Dumbbell, Trophy, Square, Activity } from 'lucide-react-native';
import { format } from 'date-fns';
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { useTranslation } from 'react-i18next';
import { GenericCard } from '../cards/GenericCard';
import { PastWorkoutsHistoryFilterMenu } from './PastWorkoutsHistoryFilterMenu';
import { WorkoutService } from '../../database/services/WorkoutService';
import { WorkoutAnalytics } from '../../database/services/WorkoutAnalytics';

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

export default function PastWorkoutsHistoryModal({ visible, onClose }: WorkoutHistoryModalProps) {
  const { t } = useTranslation();
  const [isFilterMenuVisible, setIsFilterMenuVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [workoutHistoryData, setWorkoutHistoryData] = useState<WorkoutHistorySection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Load workout history when modal becomes visible
  useEffect(() => {
    if (visible) {
      loadWorkoutHistory();
    }
  }, [visible]);

  const loadWorkoutHistory = async () => {
    setIsLoading(true);
    try {
      // Fetch completed workouts from database
      const workouts = await WorkoutService.getWorkoutHistory();

      // Process each workout to get PR count and format data
      const processedWorkouts: WorkoutHistoryItem[] = await Promise.all(
        workouts.map(async (workout) => {
          // Get PR count
          const prs = await WorkoutAnalytics.detectPersonalRecords(workout);
          const prCount = prs.length > 0 ? prs.length : null;

          // Calculate duration
          const durationMinutes =
            workout.completedAt && workout.startedAt
              ? Math.round((workout.completedAt - workout.startedAt) / 60000)
              : 0;

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

      // Group workouts by month
      const groupedByMonth = new Map<string, WorkoutHistoryItem[]>();

      processedWorkouts.forEach((workout) => {
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
        onApplyFilters={(filters) => {
          console.log('Filters applied:', filters);
        }}
        onClearFilters={() => {
          console.log('Filters cleared');
        }}
      />
    </FullScreenModal>
  );
}
