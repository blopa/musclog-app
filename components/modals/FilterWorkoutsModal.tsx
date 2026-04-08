import { Check, Dumbbell, LucideFootprints, PersonStanding } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { OptionsSelector, SelectorOption } from '@/components/OptionsSelector';
import { Button } from '@/components/theme/Button';
import { Slider } from '@/components/theme/Slider';
import { type MuscleGroup } from '@/database/models';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';

import { FullScreenModal } from './FullScreenModal';

type WorkoutType = 'strength' | 'cardio' | 'flexibility';

// UI-specific muscle group type for filtering (aggregated categories)
// Combines database MuscleGroup values with UI aggregations ('legs', 'arms', 'core', 'full-body')
type TargetMuscle =
  | MuscleGroup
  | 'full-body' // UI variant of 'full_body'
  | 'legs' // UI aggregate: quads, hamstrings, glutes, calves
  | 'arms' // UI aggregate: biceps, triceps, forearms
  | 'core'; // UI aggregate: abs

type FilterWorkoutsModalProps = {
  visible: boolean;
  onClose: () => void;
  onApplyFilters?: (filters: {
    workoutType?: WorkoutType;
    targetMuscles: TargetMuscle[];
    duration: number;
  }) => void;
  onClearFilters?: () => void;
};

export function FilterWorkoutsModal({
  visible,
  onClose,
  onApplyFilters,
  onClearFilters,
}: FilterWorkoutsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const [selectedWorkoutType, setSelectedWorkoutType] = useState<WorkoutType | undefined>(
    'strength'
  );
  const [selectedMuscles, setSelectedMuscles] = useState<TargetMuscle[]>(['full-body']);
  const [duration, setDuration] = useState(90);

  const workoutTypeOptions: SelectorOption<WorkoutType>[] = useMemo(
    () => [
      {
        id: 'strength',
        label: t('workouts.filterWorkouts.workoutTypes.strength'),
        description: t('workouts.filterWorkouts.workoutTypes.strengthDescription'),
        icon: Dumbbell,
        iconBgColor: theme.colors.status.indigo10,
        iconColor: theme.colors.status.indigo,
      },
      {
        id: 'cardio',
        label: t('workouts.filterWorkouts.workoutTypes.cardio'),
        description: t('workouts.filterWorkouts.workoutTypes.cardioDescription'),
        icon: LucideFootprints,
        iconBgColor: theme.colors.status.emerald10,
        iconColor: theme.colors.status.emerald,
      },
      {
        id: 'flexibility',
        label: t('workouts.filterWorkouts.workoutTypes.flexibility'),
        description: t('workouts.filterWorkouts.workoutTypes.flexibilityDescription'),
        icon: PersonStanding,
        iconBgColor: theme.colors.status.purple10,
        iconColor: theme.colors.status.purple,
      },
    ],
    [
      t,
      theme.colors.status.emerald,
      theme.colors.status.emerald10,
      theme.colors.status.indigo,
      theme.colors.status.indigo10,
      theme.colors.status.purple,
      theme.colors.status.purple10,
    ]
  );

  const targetMuscles: { id: TargetMuscle; label: string }[] = useMemo(
    () => [
      { id: 'full-body', label: t('workouts.filterWorkouts.muscleGroups.fullBody') },
      { id: 'chest', label: t('workouts.filterWorkouts.muscleGroups.chest') },
      { id: 'back', label: t('workouts.filterWorkouts.muscleGroups.back') },
      { id: 'legs', label: t('workouts.filterWorkouts.muscleGroups.legs') },
      { id: 'shoulders', label: t('workouts.filterWorkouts.muscleGroups.shoulders') },
      { id: 'arms', label: t('workouts.filterWorkouts.muscleGroups.arms') },
      { id: 'core', label: t('workouts.filterWorkouts.muscleGroups.core') },
    ],
    [t]
  );

  const handleClear = () => {
    setSelectedWorkoutType(undefined);
    setSelectedMuscles([]);
    setDuration(90);
    onClearFilters?.();
  };

  const handleApply = () => {
    onApplyFilters?.({
      workoutType: selectedWorkoutType,
      targetMuscles: selectedMuscles,
      duration,
    });
    onClose();
  };

  const toggleMuscle = (muscle: TargetMuscle) => {
    setSelectedMuscles((prev) => {
      if (muscle === 'full-body') {
        // If clicking full-body, toggle it and clear others
        return prev.includes('full-body') ? [] : ['full-body'];
      } else {
        // If clicking another muscle, remove full-body and toggle the muscle
        const filtered = prev.filter((m) => m !== 'full-body');
        if (filtered.includes(muscle)) {
          return filtered.filter((m) => m !== muscle);
        } else {
          return [...filtered, muscle];
        }
      }
    });
  };

  const activeFilterCount =
    (selectedWorkoutType ? 1 : 0) + selectedMuscles.length + (duration !== 90 ? 1 : 0);

  const formatDurationLabel = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0
        ? `${formatInteger(hours)}h ${formatInteger(mins)}m`
        : `${formatInteger(hours)}h`;
    }

    return `${formatInteger(minutes)}m`;
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('workouts.filterWorkouts.title')}
      headerRight={
        <Button
          label={t('workouts.filterWorkouts.clear')}
          variant="outline"
          size="sm"
          onPress={handleClear}
        />
      }
      footer={
        <View
          style={{
            paddingHorizontal: theme.spacing.padding.base,
            paddingTop: theme.spacing.padding.base,
            paddingBottom: theme.spacing.padding['2xl'],
            backgroundColor: theme.colors.background.primary,
            borderTopWidth: theme.borderWidth.thin,
            borderTopColor: theme.colors.border.light,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.gap.base,
            }}
          >
            <Button
              label={t('workouts.filterWorkouts.clearFilters')}
              variant="outline"
              width="flex-1"
              onPress={handleClear}
              size="sm"
            />
            <Button
              label={t('workouts.filterWorkouts.applyFilters')}
              variant="gradientCta"
              width="flex-2"
              onPress={handleApply}
              size="sm"
              icon={
                <View
                  style={{
                    backgroundColor: theme.colors.background.black20,
                    borderRadius: theme.borderRadius.sm,
                    paddingHorizontal: theme.spacing.padding.sm,
                    paddingVertical: theme.spacing.padding.xsHalf,
                    minWidth: theme.size['6'],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.sm,
                      fontWeight: theme.typography.fontWeight.extrabold,
                      color: theme.colors.text.white,
                    }}
                  >
                    {activeFilterCount}
                  </Text>
                </View>
              }
              iconPosition="right"
            />
          </View>
        </View>
      }
    >
      <View
        style={{
          paddingHorizontal: theme.spacing.padding.base,
          paddingTop: theme.spacing.padding['6'],
          paddingBottom: theme.spacing.padding['3xl'],
          gap: theme.spacing.gap['2xl'],
        }}
      >
        {/* Workout Type Section */}
        <OptionsSelector
          title={t('workouts.filterWorkouts.workoutType')}
          options={workoutTypeOptions}
          selectedId={selectedWorkoutType}
          onSelect={(id) => setSelectedWorkoutType(id)}
        />

        {/* Target Muscles Section */}
        <View>
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: theme.typography.letterSpacing.extraWide,
              marginBottom: theme.spacing.padding.base,
              paddingHorizontal: theme.spacing.padding.xs,
            }}
          >
            {t('workouts.filterWorkouts.targetMuscles')}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.gap.sm,
            }}
          >
            {targetMuscles.map((muscle) => {
              const isSelected = selectedMuscles.includes(muscle.id);
              return (
                <Pressable
                  key={muscle.id}
                  onPress={() => toggleMuscle(muscle.id)}
                  className="flex-row items-center gap-2 rounded-full border px-4 py-2 active:scale-95"
                  style={{
                    backgroundColor: isSelected
                      ? theme.colors.accent.primary
                      : theme.colors.background.card,
                    borderWidth: theme.borderWidth.thin,
                    borderColor: isSelected
                      ? theme.colors.accent.primary
                      : theme.colors.border.light,
                    ...(isSelected ? theme.shadows.accentGlow : {}),
                  }}
                >
                  <Text
                    className={`text-sm ${
                      isSelected ? 'font-bold text-black' : 'font-semibold text-text-secondary'
                    }`}
                  >
                    {muscle.label}
                  </Text>
                  {isSelected ? (
                    <Check
                      size={theme.iconSize.xs}
                      color={theme.colors.text.black}
                      strokeWidth={theme.strokeWidth.thick}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Duration Section */}
        <View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginBottom: theme.spacing.padding.base,
              paddingHorizontal: theme.spacing.padding.xs,
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
              {t('workouts.filterWorkouts.duration')}
            </Text>
            <Text
              style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.accent.primary,
                fontFamily: 'monospace',
              }}
            >
              {t('workouts.filterWorkouts.upTo', { duration: formatDurationLabel(duration) })}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: theme.colors.background.card,
              padding: theme.spacing.padding['6'],
              borderRadius: theme.borderRadius.md,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.border.light,
              ...theme.shadows.sm,
            }}
          >
            <Slider
              value={duration}
              min={10}
              max={120}
              step={10}
              onChange={setDuration}
              variant="solid"
              solidColor={theme.colors.accent.primary}
              trackColor={theme.colors.background.white10}
              thumbColor={theme.colors.accent.primary}
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: theme.spacing.padding.md,
              }}
            >
              {[10, 30, 60, 90, 120].map((value) => (
                <Text
                  key={value}
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.typography.fontWeight.semibold,
                    color: theme.colors.text.tertiary,
                  }}
                >
                  {formatDurationLabel(value)}
                </Text>
              ))}
            </View>
          </View>
        </View>
      </View>
    </FullScreenModal>
  );
}
