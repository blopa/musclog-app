import { PlusCircle, Search } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { database } from '../../database';
import WorkoutLog from '../../database/models/WorkoutLog';
import { WorkoutTemplateService } from '../../database/services';
import { useExercises } from '../../hooks/useExercises';
import { useTheme } from '../../hooks/useTheme';
import { SelectedExerciseCard } from '../cards/SelectedExerciseCard';
import { FilterTabs } from '../FilterTabs';
import { useSnackbar } from '../SnackbarContext';
import { Button } from '../theme/Button';
import { StepperInlineInput } from '../theme/StepperInlineInput';
import { TextInput } from '../theme/TextInput';
import { FullScreenModal } from './FullScreenModal';

type MuscleGroupFilter = 'all' | 'chest' | 'back' | 'legs' | 'arms';

function normalizeMuscleGroup(muscleGroup: string): MuscleGroupFilter | null {
  const normalized = muscleGroup.toLowerCase();
  if (normalized.includes('chest')) {
    return 'chest';
  }
  if (normalized.includes('back') || normalized.includes('lat')) {
    return 'back';
  }

  if (
    normalized.includes('leg') ||
    normalized.includes('quad') ||
    normalized.includes('hamstring') ||
    normalized.includes('calf') ||
    normalized.includes('glute')
  ) {
    return 'legs';
  }

  if (
    normalized.includes('arm') ||
    normalized.includes('bicep') ||
    normalized.includes('tricep') ||
    normalized.includes('shoulder') ||
    normalized.includes('deltoid')
  ) {
    return 'arms';
  }

  return null;
}

type AddExerciseToSessionModalProps = {
  visible: boolean;
  onClose: () => void;
  workoutLogId: string;
  onAdded?: () => void;
};

export function AddExerciseToSessionModal({
  visible,
  onClose,
  workoutLogId,
  onAdded,
}: AddExerciseToSessionModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const [activeMuscle, setActiveMuscle] = useState<MuscleGroupFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [numberOfSets, setNumberOfSets] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { exercises: allExercises, isLoading } = useExercises({
    visible,
    enableReactivity: true,
    sortBy: 'name',
    sortOrder: 'asc',
    getAll: true,
  });

  const exercisesByGroup = useMemo(() => {
    const grouped: Record<MuscleGroupFilter, typeof allExercises> = {
      all: [],
      chest: [],
      back: [],
      legs: [],
      arms: [],
    };
    allExercises.forEach((exercise) => {
      const group = normalizeMuscleGroup(exercise.muscleGroup ?? '');
      if (group) {
        grouped[group].push(exercise);
        grouped.all.push(exercise);
      }
    });
    Object.keys(grouped).forEach((key) => {
      const k = key as MuscleGroupFilter;
      grouped[k].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    });
    return grouped;
  }, [allExercises]);

  const filteredExercises = useMemo(
    () =>
      exercisesByGroup[activeMuscle].filter((ex) =>
        (ex.name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [exercisesByGroup, activeMuscle, searchQuery]
  );

  const selectedExercise = useMemo(
    () => allExercises.find((ex) => ex.id === selectedExerciseId) ?? null,
    [allExercises, selectedExerciseId]
  );

  useEffect(() => {
    if (visible) {
      setSelectedExerciseId(null);
      setNumberOfSets(3);
      setSearchQuery('');
    }
  }, [visible]);

  const handleAddToWorkout = useCallback(async () => {
    if (!selectedExerciseId || !workoutLogId) {
      return;
    }
    try {
      setIsSubmitting(true);
      let suggestedWeightKg: number | undefined;
      let suggestedReps: number | undefined;
      try {
        const suggested =
          await WorkoutTemplateService.getSuggestedWeightAndRepsForExercise(selectedExerciseId);
        suggestedWeightKg = suggested.weightKg;
        suggestedReps = suggested.reps;
      } catch {
        // Use defaults (0, 0) if suggestion fails
      }

      const log = await database.get<WorkoutLog>('workout_logs').find(workoutLogId);
      await log.addAdHocExerciseSets(selectedExerciseId, numberOfSets, {
        suggestedWeightKg,
        suggestedReps,
      });

      onAdded?.();
      onClose();
    } catch (err) {
      console.error('Error adding exercise to session:', err);
      showSnackbar('error', err instanceof Error ? err.message : t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedExerciseId, workoutLogId, numberOfSets, onAdded, onClose, showSnackbar, t]);

  const muscleTabs = useMemo(
    () => [
      { id: 'all', label: t('workouts.addExercise.muscleGroups.all') },
      { id: 'chest', label: t('workouts.addExercise.muscleGroups.chest') },
      { id: 'back', label: t('workouts.addExercise.muscleGroups.back') },
      { id: 'legs', label: t('workouts.addExercise.muscleGroups.legs') },
      { id: 'arms', label: t('workouts.addExercise.muscleGroups.arms') },
    ],
    [t]
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('freeTraining.addExercise.title')}
      scrollable={true}
      footer={
        <Button
          label={t('freeTraining.addExercise.addToWorkout')}
          variant="gradientCta"
          size="md"
          width="full"
          icon={PlusCircle}
          onPress={handleAddToWorkout}
          disabled={!selectedExerciseId || isLoading || isSubmitting}
          loading={isSubmitting}
        />
      }
    >
      <View className="flex-1 px-4 py-6">
        {selectedExercise ? (
          <View className="mb-6">
            <SelectedExerciseCard
              exerciseName={selectedExercise.name ?? ''}
              exerciseCategory={selectedExercise.muscleGroup ?? undefined}
              exerciseType={selectedExercise.equipmentType ?? undefined}
              onChange={() => setSelectedExerciseId(null)}
            />
            <View className="mt-4">
              <StepperInlineInput
                label={t('freeTraining.addExercise.numberOfSets')}
                value={numberOfSets}
                onIncrement={() => setNumberOfSets((prev) => Math.min(prev + 1, 99))}
                onDecrement={() => setNumberOfSets((prev) => Math.max(1, prev - 1))}
                onChangeValue={(num) => setNumberOfSets(Math.max(1, Math.min(99, Math.round(num))))}
              />
            </View>
          </View>
        ) : (
          <>
            <View className="mb-4">
              <FilterTabs
                tabs={muscleTabs}
                activeTab={activeMuscle}
                onTabChange={(id) => setActiveMuscle(id as MuscleGroupFilter)}
                showContainer={false}
                withCheckmark={true}
                scrollViewContentContainerStyle={{ paddingHorizontal: theme.spacing.padding.zero }}
              />
            </View>
            <View className="mb-6">
              <TextInput
                label=""
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('workouts.addExercise.searchPlaceholderAll')}
                icon={<Search size={theme.iconSize.lg} color={theme.colors.text.tertiary} />}
              />
            </View>
            <View className="mb-8">
              {isLoading ? (
                <View className="items-center justify-center py-12">
                  <ActivityIndicator size="large" color={theme.colors.accent.primary} />
                </View>
              ) : filteredExercises.length > 0 ? (
                <View className="gap-2">
                  {filteredExercises.map((exercise) => (
                    <Pressable
                      key={exercise.id}
                      onPress={() => setSelectedExerciseId(exercise.id)}
                      className="flex-row items-center gap-4 rounded-xl border border-border-default bg-bg-card p-4"
                      style={{ borderColor: theme.colors.background.white5 }}
                    >
                      <View
                        className="h-12 w-12 items-center justify-center rounded-lg"
                        style={{ backgroundColor: theme.colors.accent.primary20 }}
                      >
                        <Text
                          className="font-bold text-accent-primary"
                          style={{ fontSize: theme.typography.fontSize.lg }}
                        >
                          {(exercise.name ?? '').charAt(0)}
                        </Text>
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text
                          className="font-bold text-text-primary"
                          numberOfLines={1}
                          style={{ fontSize: theme.typography.fontSize.base }}
                        >
                          {exercise.name ?? ''}
                        </Text>
                        <Text
                          className="text-text-secondary"
                          numberOfLines={1}
                          style={{ fontSize: theme.typography.fontSize.sm }}
                        >
                          {[exercise.muscleGroup, exercise.equipmentType]
                            .filter(Boolean)
                            .join(' • ')}
                        </Text>
                      </View>
                      <Text style={{ color: theme.colors.text.secondary }}>&gt;</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View className="items-center justify-center py-12">
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.base,
                      color: theme.colors.text.secondary,
                      textAlign: 'center',
                    }}
                  >
                    {searchQuery
                      ? t('workouts.addExercise.noExercisesFound', { query: searchQuery })
                      : t('workouts.addExercise.noExercisesAvailable', {
                          muscle:
                            muscleTabs.find((tab) => tab.id === activeMuscle)?.label ??
                            activeMuscle,
                        })}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </FullScreenModal>
  );
}
