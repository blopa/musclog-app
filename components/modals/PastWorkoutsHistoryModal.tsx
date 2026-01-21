import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Search, SlidersHorizontal, Trophy } from 'lucide-react-native';
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { useTranslation } from 'react-i18next';
import { GenericCard } from '../cards/GenericCard';
import { PastWorkoutsHistoryFilterMenu } from './PastWorkoutsHistoryFilterMenu';
import { WorkoutService } from '../../database/services/WorkoutService';
import { SkeletonLoader } from '../theme/SkeletonLoader';
import { Button } from '../theme/Button';
import {
  type WorkoutHistorySection,
  type WorkoutFilters,
  calculateDateRange,
  processWorkouts,
  groupWorkoutsByMonth,
  mergeWorkoutSections,
  filterWorkoutsBySearch,
} from '../../utils/workoutHistory';

type WorkoutHistoryModalProps = {
  visible: boolean;
  onClose: () => void;
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

  const loadWorkoutHistory = useCallback(async () => {
    setIsLoading(true);
    setPageOffset(0);
    setHasMore(true);
    try {
      // Calculate date range filter
      const timeframe = calculateDateRange(filters.dateRange || '30');

      // Fetch initial batch of workouts (5 workouts)
      // Don't pass offset when it's 0 to avoid WatermelonDB issues
      const workouts = await WorkoutService.getWorkoutHistory(timeframe, BATCH_SIZE);

      // Process workouts and apply filters
      const validWorkouts = await processWorkouts(workouts, filters, t);

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
  }, [filters, t]);

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
      const timeframe = calculateDateRange(filters.dateRange || '30');

      // Fetch next batch
      const workouts = await WorkoutService.getWorkoutHistory(timeframe, BATCH_SIZE, pageOffset);

      if (workouts.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      // Process workouts and apply filters
      const validWorkouts = await processWorkouts(workouts, filters, t);

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
    filters,
    t,
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
  const filteredWorkoutHistoryData = filterWorkoutsBySearch(workoutHistoryData, searchQuery);

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
