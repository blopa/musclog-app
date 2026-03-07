import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSnackbar } from '../components/SnackbarContext';
import type { SelectorOption } from '../components/theme/OptionsMultiSelector/utils';
import type { WorkoutType } from '../constants/workoutTypes';
import { DEFAULT_WORKOUT_TYPE, isWorkoutType } from '../constants/workoutTypes';
import { database } from '../database';
import Exercise from '../database/models/Exercise';
import { WorkoutTemplateService } from '../database/services';
import {
  createExerciseOption,
  type ExerciseMetadata,
  exercisesToWorkoutFormat,
  extractExerciseMetadata,
  formatExerciseDescription,
  transformExercisesToOptions,
  transformScheduleDays,
  updateMetadataWithGroupIds,
  validateWorkoutTitle,
} from '../utils/workout';
import { useSettings } from './useSettings';

export interface UseWorkoutFormParams {
  templateId?: string;
}

export interface AddExerciseData {
  exerciseId: string;
  sets: number;
  reps: number;
  weight: number;
  isBodyweight: boolean;
  restTimeAfter?: number;
  isDropSet?: boolean;
  notes?: string;
}

export function useWorkoutForm({ templateId }: UseWorkoutFormParams = {}) {
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const { units } = useSettings();
  const router = useRouter();
  const isEditMode = !!templateId;

  const [workoutTitle, setWorkoutTitle] = useState('');
  const [description, setDescription] = useState('');
  const [volumeCalc, setVolumeCalc] = useState('none');
  const [workoutType, setWorkoutType] = useState<WorkoutType>(DEFAULT_WORKOUT_TYPE);
  const [icon, setIcon] = useState<string | undefined>(undefined);
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
    if (!isEditMode || !templateId) {
      return;
    }

    setIsLoading(true);
    try {
      const { template, templateExercises, sets, schedule } =
        await WorkoutTemplateService.getTemplateWithDetails(templateId);

      setWorkoutTitle(template.name ?? '');
      setDescription(template.description || '');
      setVolumeCalc(template.volumeCalculationType || 'none');
      setWorkoutType(isWorkoutType(template.type) ? template.type : DEFAULT_WORKOUT_TYPE);
      setIcon(template.icon ?? undefined);

      if (template.weekDaysJson && template.weekDaysJson.length > 0) {
        setSelectedDays(template.weekDaysJson);
      } else {
        const dayIndices = transformScheduleDays(schedule);
        setSelectedDays(dayIndices);
      }

      const exercisesInWorkout = await WorkoutTemplateService.convertTemplateExercisesToUI(
        templateExercises,
        sets
      );

      const exerciseOptions = transformExercisesToOptions(exercisesInWorkout);
      setExercises(exerciseOptions);

      const metadataMap = new Map<string, ExerciseMetadata>();
      exercisesInWorkout.forEach((ex) => {
        metadataMap.set(ex.id, extractExerciseMetadata(ex));
      });
      setExerciseMetadata(metadataMap);
    } catch (error) {
      console.error('Error loading template:', error);
      showSnackbar('error', t('createWorkout.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [isEditMode, templateId, t, showSnackbar]);

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
          units,
        });

        setExerciseMetadata((prev) => {
          const updated = new Map(prev);
          updated.set(exerciseData.exerciseId, {
            sets: exerciseData.sets,
            reps: exerciseData.reps,
            weight: exerciseData.weight,
            isBodyweight: exerciseData.isBodyweight,
            restTimeAfter: exerciseData.restTimeAfter ?? 60,
            groupId: undefined,
            isDropSet: exerciseData.isDropSet ?? false,
            notes: exerciseData.notes,
          });
          return updated;
        });

        setExercises((prev) => [...prev, newExercise]);
      } catch (error) {
        console.error('Error adding exercise:', error);
        showSnackbar('error', t('createWorkout.addExerciseError'));
      }
    },
    [t, showSnackbar]
  );

  const handleSave = useCallback(async () => {
    const titleValidation = validateWorkoutTitle(workoutTitle);
    if (!titleValidation.valid) {
      showSnackbar('error', t('createWorkout.validation.titleRequiredMessage'));
      return;
    }

    setIsSaving(true);
    try {
      const exercisesInWorkout = exercisesToWorkoutFormat(exercises, exerciseMetadata);

      await WorkoutTemplateService.saveTemplate({
        templateId: isEditMode ? templateId : undefined,
        name: workoutTitle.trim(),
        description: description.trim() || undefined,
        volumeCalculationType: volumeCalc,
        type: workoutType,
        icon: icon ?? undefined,
        weekDaysJson: selectedDays.length > 0 ? selectedDays : undefined,
        exercises: exercisesInWorkout,
        selectedDays,
      });

      router.back();
    } catch (error) {
      console.error('Error saving template:', error);
      showSnackbar('error', t('createWorkout.saveError'));
    } finally {
      setIsSaving(false);
    }
  }, [
    workoutTitle,
    description,
    volumeCalc,
    workoutType,
    icon,
    exercises,
    exerciseMetadata,
    selectedDays,
    isEditMode,
    templateId,
    router,
    t,
    showSnackbar,
  ]);

  const handleExerciseOrderChange = useCallback((reorderedExercises: SelectorOption<string>[]) => {
    setExercises(reorderedExercises);
    setExerciseMetadata((prev) => updateMetadataWithGroupIds(prev, reorderedExercises));
  }, []);

  const handleDeleteExercises = useCallback((exerciseIds: string[]) => {
    setExercises((prev) => prev.filter((exercise) => !exerciseIds.includes(exercise.id)));

    setExerciseMetadata((prev) => {
      const updated = new Map(prev);
      exerciseIds.forEach((id) => updated.delete(id));
      return updated;
    });

    setSelectedExercises([]);
  }, []);

  const handleUpdateExerciseNotes = useCallback(
    (exerciseId: string, notes: string | undefined) => {
      setExerciseMetadata((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(exerciseId);
        if (existing) {
          updated.set(exerciseId, { ...existing, notes });
        }
        return updated;
      });

      setExercises((prev) =>
        prev.map((ex) => {
          if (ex.id === exerciseId) {
            const meta = exerciseMetadata.get(exerciseId);
            const baseDescription = meta
              ? formatExerciseDescription(meta.sets, meta.reps)
              : ex.description.replace(' • 📝', '');
            return {
              ...ex,
              description: notes ? `${baseDescription} • 📝` : baseDescription,
            };
          }
          return ex;
        })
      );
    },
    [exerciseMetadata]
  );

  return {
    // State
    workoutTitle,
    description,
    volumeCalc,
    workoutType,
    icon,
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
    setWorkoutType,
    setIcon,
    setFocusedField,
    setSelectedExercises,
    setExercises,

    // Handlers
    toggleDay,
    handleAddExerciseWithMetadata,
    handleSave,
    handleExerciseOrderChange,
    handleDeleteExercises,
    handleUpdateExerciseNotes,
  };
}
