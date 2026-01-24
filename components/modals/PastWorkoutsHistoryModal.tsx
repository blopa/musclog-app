import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Search, SlidersHorizontal, Trophy } from 'lucide-react-native';
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { useTranslation } from 'react-i18next';
import { GenericCard } from '../cards/GenericCard';
import { PastWorkoutsHistoryFilterMenu } from './PastWorkoutsHistoryFilterMenu';
import { SkeletonLoader } from '../theme/SkeletonLoader';
import { Button } from '../theme/Button';
import { type WorkoutHistoryItem, WorkoutHistorySection } from '../../utils/workoutHistory';
import { useWorkoutHistory } from '../../hooks/useWorkoutHistory';
import PastWorkoutDetailModal from './PastWorkoutDetailModal';

type WorkoutHistoryModalProps = {
  visible: boolean;
  onClose: () => void;
};

// Search and Filter Header Component
type SearchAndFilterHeaderProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFilterPress: () => void;
};

function SearchAndFilterHeader({
  searchQuery,
  onSearchChange,
  onFilterPress,
}: SearchAndFilterHeaderProps) {
  const { t } = useTranslation();

  return (
    <View
      className="px-4 pb-4 pt-4"
      style={{
        backgroundColor: theme.colors.background.darkBackground,
      }}
    >
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
            onChangeText={onSearchChange}
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
          onPress={onFilterPress}
        >
          <SlidersHorizontal size={theme.iconSize.sm} color={theme.colors.text.primary} />
        </Pressable>
      </View>
    </View>
  );
}

// Loading Skeleton Component
function WorkoutHistorySkeleton() {
  return (
    <View className="flex-1 gap-6 p-4">
      <View>
        <SkeletonLoader
          width={theme.size['24']}
          height={theme.size['3']}
          borderRadius={theme.borderRadius.sm}
          className="mb-3 px-1"
        />
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
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 flex-row items-center gap-3">
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
                  {i % 3 === 0 ? (
                    <SkeletonLoader
                      width={theme.size['12']}
                      height={theme.size['5']}
                      borderRadius={theme.borderRadius.md}
                    />
                  ) : null}
                </View>
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
  );
}

// Empty State Component
type EmptyStateProps = {
  hasSearchQuery: boolean;
};

function EmptyState({ hasSearchQuery }: EmptyStateProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center px-4 py-20">
      <Text
        style={{
          fontSize: theme.typography.fontSize.base,
          color: theme.colors.text.secondary,
          textAlign: 'center',
        }}
      >
        {hasSearchQuery
          ? t('pastWorkoutHistory.noWorkoutsFound')
          : t('pastWorkoutHistory.noWorkoutHistory')}
      </Text>
    </View>
  );
}

// Workout Card Component
type WorkoutCardProps = {
  workout: WorkoutHistoryItem;
  opacity: number;
};

type WorkoutCardPropsWithHandler = WorkoutCardProps & {
  onPress: () => void;
};

function WorkoutCard({ workout, opacity, onPress }: WorkoutCardPropsWithHandler) {
  const { t } = useTranslation();
  const Icon = workout.icon;

  return (
    <View
      style={{
        opacity,
      }}
    >
      <GenericCard variant="card" isPressable={true} onPress={onPress}>
        <View className="flex-col gap-4 p-4">
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
            {workout.prCount ? (
              <View
                className="flex-row items-center gap-1 rounded px-2 py-0.5"
                style={{
                  backgroundColor: theme.colors.status.emerald400_10,
                }}
              >
                <Trophy size={theme.iconSize.xs} color={theme.colors.status.emeraldLight} />
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
            ) : null}
          </View>

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
}

// Workout Month Section Component
type WorkoutMonthSectionProps = {
  section: WorkoutHistorySection;
  isLastMonth: boolean;
  onWorkoutPress: (workoutId: string) => void;
};

function WorkoutMonthSection({ section, isLastMonth, onWorkoutPress }: WorkoutMonthSectionProps) {
  return (
    <View>
      <Text
        className="mb-3 px-1 font-bold uppercase tracking-widest"
        style={{
          fontSize: theme.typography.fontSize.xs,
          color: theme.colors.text.secondary,
          opacity: isLastMonth ? 0.8 : 1,
        }}
      >
        {section.month}
      </Text>

      <View className="flex-col gap-3">
        {section.workouts.map((workout) => (
          <WorkoutCard
            key={workout.id}
            workout={workout}
            opacity={isLastMonth ? 0.8 : 1}
            onPress={() => onWorkoutPress(workout.id)}
          />
        ))}
      </View>
    </View>
  );
}

// Load More Button Component
type LoadMoreButtonProps = {
  isLoadingMore: boolean;
  onPress: () => void;
};

function LoadMoreButton({ isLoadingMore, onPress }: LoadMoreButtonProps) {
  const { t } = useTranslation();

  return (
    <View className="py-4">
      <Button
        label={
          isLoadingMore ? t('pastWorkoutHistory.loadingMore') : t('pastWorkoutHistory.loadMore')
        }
        onPress={onPress}
        size="sm"
        variant="outline"
        disabled={isLoadingMore}
        loading={isLoadingMore}
        width="full"
      />
    </View>
  );
}

export default function PastWorkoutsHistoryModal({ visible, onClose }: WorkoutHistoryModalProps) {
  const { t } = useTranslation();
  const [isFilterMenuVisible, setIsFilterMenuVisible] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);

  const {
    sections: workoutHistoryData,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore: loadMoreWorkouts,
    searchQuery,
    setSearchQuery,
    filters,
    handleApplyFilters,
    handleClearFilters,
  } = useWorkoutHistory({
    initialLimit: 5,
    batchSize: 5,
    groupByMonth: true,
    enableReactivity: true,
    visible,
  });

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('pastWorkoutHistory.title')}
      scrollable={false}
    >
      <View className="flex-1">
        <SearchAndFilterHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterPress={() => setIsFilterMenuVisible(true)}
        />

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <WorkoutHistorySkeleton />
          ) : workoutHistoryData.length === 0 ? (
            <EmptyState hasSearchQuery={!!searchQuery} />
          ) : (
            <View className="flex-1 gap-6 p-4">
              {workoutHistoryData.map((section, sectionIndex) => (
                <WorkoutMonthSection
                  key={section.month}
                  section={section}
                  isLastMonth={sectionIndex === workoutHistoryData.length - 1}
                  onWorkoutPress={setSelectedWorkoutId}
                />
              ))}

              {hasMore && !searchQuery ? (
                <LoadMoreButton isLoadingMore={isLoadingMore} onPress={loadMoreWorkouts} />
              ) : null}
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
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
      />

      <PastWorkoutDetailModal
        visible={!!selectedWorkoutId}
        onClose={() => setSelectedWorkoutId(null)}
        workoutId={selectedWorkoutId || undefined}
      />
    </FullScreenModal>
  );
}
