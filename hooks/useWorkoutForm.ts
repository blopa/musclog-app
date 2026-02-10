import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import type { SelectorOption } from '../components/theme/OptionsMultiSelector/utils';
import { database } from '../database';
import Exercise from '../database/models/Exercise';
import { WorkoutTemplateService } from '../database/services/WorkoutTemplateService';
import {
  createExerciseOption,
  type ExerciseMetadata,
  exercisesToWorkoutFormat,
  extractExerciseMetadata,
  transformExercisesToOptions,
  transformScheduleDays,
  updateMetadataWithGroupIds,
  validateWorkoutTitle,
} from '../utils/workout';

export interface UseWorkoutFormParams {
  templateId?: string;
}

export interface AddExerciseData {
  exerciseId: string;
  sets: number;
  reps: number;
  weight: number;
  isBodyweight: boolean;
  restTimeAfter?: number; // Rest time in seconds after completing this set
}

export function useWorkoutForm({ templateId }: UseWorkoutFormParams = {}) {
  const { t } = useTranslation();
  const router = useRouter();
  const isEditMode = !!templateId;

  const [workoutTitle, setWorkoutTitle] = useState('');
  const [description, setDescription] = useState('');
  const [volumeCalc, setVolumeCalc] = useState('none');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [exercises, setExercises] = useState<SelectorOption<string>[]>([]);
  const [exerciseMetadata, setExerciseMetadata] = useState<Map<string, ExerciseMetadata>>(
    new Map()
  );

  const loadTemplate = useCallback(async () => {
    if (!isEditMode || !templateId) return;

    setIsLoading(true);
    try {
      const { template, sets, schedule } =
        await WorkoutTemplateService.getTemplateWithDetails(templateId);

      setWorkoutTitle(template.name ?? '');
      setDescription(template.description || '');

      const dayIndices = transformScheduleDays(schedule);
      setSelectedDays(dayIndices);

      const exercisesInWorkout = await WorkoutTemplateService.convertSetsToExercises(sets);

      const exerciseOptions = transformExercisesToOptions(exercisesInWorkout);
      setExercises(exerciseOptions);

      const metadataMap = new Map<string, ExerciseMetadata>();
      exercisesInWorkout.forEach((ex) => {
        metadataMap.set(ex.id, extractExerciseMetadata(ex));
      });
      setExerciseMetadata(metadataMap);
    } catch (error) {
      console.error('Error loading template:', error);
      // TODO: use the snackbar system
      Alert.alert(
        t('common.error', 'Error'),
        t('createWorkout.loadError', 'Failed to load workout template')
      );
    } finally {
      setIsLoading(false);
    }
  }, [isEditMode, templateId, t]);

  useEffect(() => {
    if (isEditMode) {
      loadTemplate();
    }
  }, [isEditMode, loadTemplate]);

  const toggleDay = useCallback((index: number) => {
    setSelectedDays((prevDays) => {
      if (prevDays.includes(index)) {
        return prevDays.filter((d) => d !== index);
      } else {
        return [...prevDays, index].sort();
      }
    });
  }, []);

  const handleAddExerciseWithMetadata = useCallback(
    async (exerciseData: AddExerciseData) => {
      try {
        const exercise = await database.get<Exercise>('exercises').find(exerciseData.exerciseId);

        const newExercise = createExerciseOption({
          exercise,
          sets: exerciseData.sets,
          reps: exerciseData.reps,
          weight: exerciseData.weight,
          isBodyweight: exerciseData.isBodyweight,
          groupId: undefined,
        });

        setExerciseMetadata((prev) => {
          const updated = new Map(prev);
          updated.set(exerciseData.exerciseId, {
            sets: exerciseData.sets,
            reps: exerciseData.reps,
            weight: exerciseData.weight,
            isBodyweight: exerciseData.isBodyweight,
            restTimeAfter: exerciseData.restTimeAfter ?? 60, // Default to 60 seconds if not provided
            groupId: undefined,
          });
          return updated;
        });

        setExercises((prev) => [...prev, newExercise]);
      } catch (error) {
        console.error('Error adding exercise:', error);
        // TODO: use the snackbar system
        Alert.alert(
          t('common.error', 'Error'),
          t('createWorkout.addExerciseError', 'Failed to add exercise')
        );
      }
    },
    [t]
  );

  const handleSave = useCallback(async () => {
    const titleValidation = validateWorkoutTitle(workoutTitle);
    if (!titleValidation.valid) {
      // TODO: use the snackbar system
      Alert.alert(
        t('createWorkout.validation.titleRequired', 'Title Required'),
        t('createWorkout.validation.titleRequiredMessage', 'Please enter a workout title')
      );
      return;
    }

    setIsSaving(true);
    try {
      const exercisesInWorkout = exercisesToWorkoutFormat(exercises, exerciseMetadata);

      await WorkoutTemplateService.saveTemplate({
        templateId: isEditMode ? templateId : undefined,
        name: workoutTitle.trim(),
        description: description.trim() || undefined,
        exercises: exercisesInWorkout,
        selectedDays,
      });

      router.back();
    } catch (error) {
      console.error('Error saving template:', error);
      // TODO: use the snackbar system
      Alert.alert(
        t('common.error', 'Error'),
        t('createWorkout.saveError', 'Failed to save workout template')
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    workoutTitle,
    description,
    exercises,
    exerciseMetadata,
    selectedDays,
    isEditMode,
    templateId,
    router,
    t,
  ]);

  const handleExerciseOrderChange = useCallback((reorderedExercises: SelectorOption<string>[]) => {
    setExercises(reorderedExercises);
    setExerciseMetadata((prev) => updateMetadataWithGroupIds(prev, reorderedExercises));
  }, []);

  const handleDeleteExercises = useCallback((exerciseIds: string[]) => {
    // Remove exercises from the list
    setExercises((prev) => prev.filter((exercise) => !exerciseIds.includes(exercise.id)));

    // Remove metadata for deleted exercises
    setExerciseMetadata((prev) => {
      const updated = new Map(prev);
      exerciseIds.forEach((id) => updated.delete(id));
      return updated;
    });

    // Clear selection after deletion
    setSelectedExercises([]);
  }, []);

  return {
    // State
    workoutTitle,
    description,
    volumeCalc,
    selectedDays,
    focusedField,
    isLoading,
    isSaving,
    selectedExercises,
    exercises,
    exerciseMetadata,
    isEditMode,

    // Setters
    setWorkoutTitle,
    setDescription,
    setVolumeCalc,
    setFocusedField,
    setSelectedExercises,
    setExercises,

    // Handlers
    toggleDay,
    handleAddExerciseWithMetadata,
    handleSave,
    handleExerciseOrderChange,
    handleDeleteExercises,
  };
}
