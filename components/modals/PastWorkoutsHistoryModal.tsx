import { Search, SlidersHorizontal, Trophy } from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, SectionList, Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { SkeletonLoader } from '@/components/theme/SkeletonLoader';
import { TextInput } from '@/components/theme/TextInput';
import { type MuscleGroup } from '@/database/models';
import { useTheme } from '@/hooks/useTheme';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { type WorkoutHistoryItem } from '@/utils/workoutHistory';

import { FullScreenModal } from './FullScreenModal';
import PastWorkoutDetailModal from './PastWorkoutDetailModal';
import { PastWorkoutsHistoryFilterMenu } from './PastWorkoutsHistoryFilterMenu';

// UI filter muscle group type (includes database types + UI aggregations)
type FilterMuscleGroup =
  | MuscleGroup
  | 'full-body' // UI variant of 'full_body'
  | 'legs' // UI aggregate: quads, hamstrings, glutes, calves
  | 'arms' // UI aggregate: biceps, triceps, forearms
  | 'core'; // UI aggregate: abs

type WorkoutHistoryModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Only list sessions started from this workout template. Defaults to all workouts. */
  templateId?: string;
  /** Overrides the default title, e.g. with the workout's name. */
  title?: string;
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
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      className="px-4 pb-4 pt-4"
      style={{
        backgroundColor: theme.colors.background.darkBackground,
      }}
    >
      <View className="flex-row items-end gap-2">
        <View className="relative flex-1">
          <TextInput
            placeholder={t('pastWorkoutHistory.searchPlaceholder')}
            label=""
            value={searchQuery}
            onChangeText={onSearchChange}
            icon={<Search size={theme.iconSize.lg} color={theme.colors.text.tertiary} />}
          />
        </View>
        <Pressable
          className="h-12 w-12 items-center justify-center border"
          style={{
            backgroundColor: theme.colors.background.card,
            borderColor: theme.colors.background.ink5,
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
  const theme = useTheme();
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
              className="rounded-card border p-4"
              style={{
                backgroundColor: theme.colors.background.card,
                borderColor: theme.colors.background.ink5,
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
                      className="flex-1 gap-2 rounded-control p-2"
                      style={{ backgroundColor: theme.colors.background.ink5 }}
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
  isRangeLimited: boolean;
};

function EmptyState({ hasSearchQuery, isRangeLimited }: EmptyStateProps) {
  const theme = useTheme();
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
          : isRangeLimited
            ? t('pastWorkoutHistory.noWorkoutsInRange')
            : t('pastWorkoutHistory.noWorkoutHistory')}
      </Text>
    </View>
  );
}

function ItemSeparator() {
  return <View className="h-3" />;
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
  const theme = useTheme();
  const { t } = useTranslation();
  const Icon = workout.icon;

  return (
    <View
      style={{
        opacity,
      }}
    >
      <GenericCard variant="flat" isPressable={true} onPress={onPress}>
        <View className="flex-col gap-4 p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-row items-center gap-3">
              <View
                className="h-12 w-12 items-center justify-center rounded-control"
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
                className="flex-row items-center gap-1 rounded-tag px-2 py-0.5"
                style={{
                  backgroundColor: theme.colors.status.brandBright10,
                }}
              >
                <Trophy size={theme.iconSize.xs} color={theme.colors.status.brandBright} />
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xxs,
                    fontWeight: theme.typography.fontWeight.bold,
                    color: theme.colors.status.brandBright,
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
                className="flex-1 rounded-control p-2"
                style={{
                  backgroundColor: theme.colors.background.ink5,
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

// Month heading rendered as a SectionList section header
function MonthHeader({ title, isLastMonth }: { title: string; isLastMonth: boolean }) {
  const theme = useTheme();

  return (
    <Text
      className="px-5 pb-3 pt-6 font-bold"
      style={{
        fontSize: theme.typography.fontSize.xs,
        color: theme.colors.text.secondary,
        opacity: isLastMonth ? 0.8 : 1,
      }}
    >
      {title}
    </Text>
  );
}

// Footer shown while the next page is loading
function LoadingMoreFooter({ isLoadingMore }: { isLoadingMore: boolean }) {
  const theme = useTheme();

  return (
    <View className="items-center py-6">
      {isLoadingMore ? <ActivityIndicator color={theme.colors.accent.primary} /> : null}
    </View>
  );
}

const MemoWorkoutCard = memo(WorkoutCard);

function PastWorkoutsHistoryModal({
  visible,
  onClose,
  templateId,
  title,
}: WorkoutHistoryModalProps) {
  const { t } = useTranslation();
  const [isFilterMenuVisible, setIsFilterMenuVisible] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      const reset = () => {
        setIsFilterMenuVisible(false);
        setSelectedWorkoutId(null);
      };

      reset();
    }
  }, [visible]);

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
    templateId,
  });

  const listSections = useMemo(
    () =>
      workoutHistoryData.map((section, index) => ({
        key: section.monthKey,
        title: section.month,
        isLastMonth: index === workoutHistoryData.length - 1,
        data: section.workouts,
      })),
    [workoutHistoryData]
  );

  const keyExtractor = useCallback((workout: WorkoutHistoryItem) => workout.id, []);

  const renderWorkout = useCallback(
    ({ item, section }: { item: WorkoutHistoryItem; section: { isLastMonth: boolean } }) => (
      <View className="px-4">
        <MemoWorkoutCard
          workout={item}
          opacity={section.isLastMonth ? 0.8 : 1}
          onPress={() => setSelectedWorkoutId(item.id)}
        />
      </View>
    ),
    []
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string; isLastMonth: boolean } }) => (
      <MonthHeader title={section.title} isLastMonth={section.isLastMonth} />
    ),
    []
  );

  const handleEndReached = useCallback(() => {
    if (hasMore && !searchQuery && !isLoadingMore) {
      loadMoreWorkouts();
    }
  }, [hasMore, searchQuery, isLoadingMore, loadMoreWorkouts]);

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={title ?? t('pastWorkoutHistory.title')}
      scrollable={false}
    >
      <View className="flex-1">
        <SearchAndFilterHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterPress={() => setIsFilterMenuVisible(true)}
        />

        {isLoading ? (
          <WorkoutHistorySkeleton />
        ) : workoutHistoryData.length === 0 ? (
          <EmptyState hasSearchQuery={!!searchQuery} isRangeLimited={filters.dateRange !== 'all'} />
        ) : (
          <SectionList
            className="flex-1"
            sections={listSections}
            keyExtractor={keyExtractor}
            renderItem={renderWorkout}
            renderSectionHeader={renderSectionHeader}
            ItemSeparatorComponent={ItemSeparator}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            ListFooterComponent={<LoadingMoreFooter isLoadingMore={isLoadingMore} />}
          />
        )}
      </View>

      {/* Filter Menu */}
      <PastWorkoutsHistoryFilterMenu
        visible={isFilterMenuVisible}
        onClose={() => setIsFilterMenuVisible(false)}
        initialFilters={{
          workoutType: filters.workoutType,
          dateRange: filters.dateRange,
          muscleGroups: filters.muscleGroups as FilterMuscleGroup[],
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

export default memo(PastWorkoutsHistoryModal);
