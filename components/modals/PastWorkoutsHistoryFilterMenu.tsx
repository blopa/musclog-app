import { Calendar } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { theme } from '../../theme';
import { BottomPopUp } from '../BottomPopUp';
import { FilterTabs } from '../FilterTabs';
import { Button } from '../theme/Button';
import { SegmentedControl } from '../theme/SegmentedControl';
import { Slider } from '../theme/Slider';

type WorkoutType = 'all' | 'strength' | 'cardio' | 'hiit' | 'yoga';
type DateRange = '30' | '90' | 'custom';
type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'full-body';

type PastWorkoutsHistoryFilterMenuProps = {
  visible: boolean;
  onClose: () => void;
  onApplyFilters?: (filters: {
    workoutType?: WorkoutType;
    dateRange?: DateRange;
    muscleGroups: MuscleGroup[];
    minDuration: number;
  }) => void;
  onClearFilters?: () => void;
  initialFilters?: {
    workoutType?: WorkoutType;
    dateRange?: DateRange;
    muscleGroups?: MuscleGroup[];
    minDuration?: number;
  };
};

export function PastWorkoutsHistoryFilterMenu({
  visible,
  onClose,
  onApplyFilters,
  onClearFilters,
  initialFilters,
}: PastWorkoutsHistoryFilterMenuProps) {
  const { t } = useTranslation();

  const [selectedWorkoutType, setSelectedWorkoutType] = useState<WorkoutType>(
    initialFilters?.workoutType || 'all'
  );
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>(
    initialFilters?.dateRange || '30'
  );
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<MuscleGroup[]>(
    initialFilters?.muscleGroups || []
  );
  const [minDuration, setMinDuration] = useState(initialFilters?.minDuration || 0);

  // Reset to initial filters when modal opens or initialFilters change
  useEffect(() => {
    if (visible && initialFilters) {
      setSelectedWorkoutType(initialFilters.workoutType || 'all');
      setSelectedDateRange(initialFilters.dateRange || '30');
      setSelectedMuscleGroups(initialFilters.muscleGroups || []);
      setMinDuration(initialFilters.minDuration || 0);
    }
  }, [visible, initialFilters]);

  const workoutTypes = useMemo(
    () => [
      { id: 'all', label: t('pastWorkoutHistory.filters.workoutTypes.all') || 'All Types' },
      {
        id: 'strength',
        label: t('pastWorkoutHistory.filters.workoutTypes.strength') || 'Strength',
      },
      { id: 'cardio', label: t('pastWorkoutHistory.filters.workoutTypes.cardio') || 'Cardio' },
      { id: 'hiit', label: t('pastWorkoutHistory.filters.workoutTypes.hiit') || 'HIIT' },
      { id: 'yoga', label: t('pastWorkoutHistory.filters.workoutTypes.yoga') || 'Yoga' },
    ],
    [t]
  );

  const dateRangeOptions = useMemo(
    () => [
      {
        label: t('pastWorkoutHistory.filters.dateRange.30days') || 'Last 30 Days',
        value: '30',
      },
      {
        label: t('pastWorkoutHistory.filters.dateRange.90days') || 'Last 90 Days',
        value: '90',
      },
      {
        label: t('pastWorkoutHistory.filters.dateRange.custom') || 'Custom',
        value: 'custom',
        icon: <Calendar size={theme.iconSize.sm} color={theme.colors.text.secondary} />,
      },
    ],
    [t]
  );

  const muscleGroups = useMemo(
    () => [
      { id: 'chest', label: t('pastWorkoutHistory.filters.muscleGroups.chest') || 'Chest' },
      { id: 'back', label: t('pastWorkoutHistory.filters.muscleGroups.back') || 'Back' },
      { id: 'legs', label: t('pastWorkoutHistory.filters.muscleGroups.legs') || 'Legs' },
      {
        id: 'shoulders',
        label: t('pastWorkoutHistory.filters.muscleGroups.shoulders') || 'Shoulders',
      },
      { id: 'arms', label: t('pastWorkoutHistory.filters.muscleGroups.arms') || 'Arms' },
      { id: 'core', label: t('pastWorkoutHistory.filters.muscleGroups.core') || 'Core' },
      {
        id: 'full-body',
        label: t('pastWorkoutHistory.filters.muscleGroups.fullBody') || 'Full Body',
      },
    ],
    [t]
  );

  const toggleMuscleGroup = (muscleGroup: MuscleGroup) => {
    setSelectedMuscleGroups((prev) => {
      if (prev.includes(muscleGroup)) {
        return prev.filter((m) => m !== muscleGroup);
      } else {
        return [...prev, muscleGroup];
      }
    });
  };

  const handleReset = () => {
    setSelectedWorkoutType('all');
    setSelectedDateRange('30');
    setSelectedMuscleGroups([]);
    setMinDuration(0);
    onClearFilters?.();
  };

  const handleApply = () => {
    onApplyFilters?.({
      workoutType: selectedWorkoutType,
      dateRange: selectedDateRange,
      muscleGroups: selectedMuscleGroups,
      minDuration,
    });
    onClose();
  };

  const formatDuration = (minutes: number) => {
    if (minutes >= 120) {
      return t('pastWorkoutHistory.filters.durationFormats.max');
    }
    return t('pastWorkoutHistory.filters.durationFormats.minutes', { minutes });
  };

  const formatDurationDisplay = (minutes: number) => {
    if (minutes === 0) {
      return t('pastWorkoutHistory.filters.durationFormats.zero');
    }
    if (minutes >= 120) {
      return t('pastWorkoutHistory.filters.durationFormats.max');
    }
    return t('pastWorkoutHistory.filters.durationFormats.minutesPlus', { minutes });
  };

  return (
    <BottomPopUp
      visible={visible}
      onClose={onClose}
      title={t('pastWorkoutHistory.filters.title') || 'Filter Workouts'}
      maxHeight="90%"
      footer={
        <View
          style={{
            flexDirection: 'row',
            gap: theme.spacing.gap.base,
            paddingTop: theme.spacing.padding.md,
          }}
        >
          <Button
            label={t('pastWorkoutHistory.filters.reset') || 'Reset'}
            variant="outline"
            width="flex-1"
            size="sm"
            onPress={handleReset}
          />
          <Button
            label={t('pastWorkoutHistory.filters.applyFilters') || 'Apply Filters'}
            variant="gradientCta"
            width="flex-2"
            size="sm"
            onPress={handleApply}
          />
        </View>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: theme.spacing.gap['2xl'],
        }}
      >
        {/* Drag Handle */}
        <View
          style={{
            alignSelf: 'center',
            width: theme.size['12'],
            height: theme.spacing.padding['1half'],
            backgroundColor: theme.colors.text.tertiary,
            borderRadius: theme.borderRadius.full,
            marginTop: theme.spacing.padding.sm,
            marginBottom: -theme.spacing.gap.base,
          }}
        />

        {/* Workout Type Section */}
        <View>
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: theme.typography.letterSpacing.extraWide,
              marginBottom: theme.spacing.padding.base,
            }}
          >
            {t('pastWorkoutHistory.filters.workoutType') || 'WORKOUT TYPE'}
          </Text>
          <FilterTabs
            tabs={workoutTypes}
            activeTab={selectedWorkoutType}
            onTabChange={(tabId) => setSelectedWorkoutType(tabId as WorkoutType)}
            showContainer={false}
            scrollViewContentContainerStyle={{ paddingHorizontal: 0 }}
          />
        </View>

        {/* Date Range Section */}
        <View>
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: theme.typography.letterSpacing.extraWide,
              marginBottom: theme.spacing.padding.base,
            }}
          >
            {t('pastWorkoutHistory.filters.dateRange.title') || 'DATE RANGE'}
          </Text>
          <SegmentedControl
            options={dateRangeOptions}
            value={selectedDateRange}
            onValueChange={(value) => setSelectedDateRange(value as DateRange)}
            variant="outline"
          />
        </View>

        {/* Muscle Group Section */}
        <View>
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: theme.typography.letterSpacing.extraWide,
              marginBottom: theme.spacing.padding.base,
            }}
          >
            {t('pastWorkoutHistory.filters.muscleGroups.title') || 'MUSCLE GROUP (MULTI-SELECT)'}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.gap.sm,
            }}
          >
            {muscleGroups.map((muscle) => {
              const isSelected = selectedMuscleGroups.includes(muscle.id as MuscleGroup);
              return (
                <Pressable
                  key={muscle.id}
                  onPress={() => toggleMuscleGroup(muscle.id as MuscleGroup)}
                  className="flex-row items-center gap-2 rounded-full border px-4 py-2 active:scale-95"
                  style={{
                    backgroundColor: isSelected
                      ? theme.colors.accent.primary10
                      : theme.colors.background.card,
                    borderWidth: theme.borderWidth.thin,
                    borderColor: isSelected
                      ? theme.colors.accent.primary30
                      : theme.colors.border.light,
                  }}
                >
                  <Text
                    className={`text-sm font-medium ${
                      isSelected ? 'font-semibold text-accent-primary' : 'text-text-secondary'
                    }`}
                  >
                    {muscle.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Min. Duration Section */}
        <View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: theme.spacing.padding.base,
            }}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.secondary,
                textTransform: 'uppercase',
                letterSpacing: theme.typography.letterSpacing.extraWide,
              }}
            >
              {t('pastWorkoutHistory.filters.minDuration') || 'MIN. DURATION'}
            </Text>
            <Text
              style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.accent.primary,
              }}
            >
              {formatDurationDisplay(minDuration)}
            </Text>
          </View>
          <View
            style={{
              marginBottom: theme.spacing.padding.sm,
            }}
          >
            <Slider
              value={minDuration}
              min={0}
              max={120}
              step={5}
              onChange={setMinDuration}
              variant="solid"
              solidColor={theme.colors.accent.primary}
              trackColor={theme.colors.background.white10}
              thumbColor={theme.colors.accent.primary}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.xxs,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.tertiary,
              }}
            >
              {t('pastWorkoutHistory.filters.durationFormats.zero')}
            </Text>
            <Text
              style={{
                fontSize: theme.typography.fontSize.xxs,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.tertiary,
              }}
            >
              {t('pastWorkoutHistory.filters.durationFormats.max')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </BottomPopUp>
  );
}
