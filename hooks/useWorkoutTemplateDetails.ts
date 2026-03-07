import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useRef, useState } from 'react';

import { database } from '../database';
import Exercise from '../database/models/Exercise';
import WorkoutTemplate from '../database/models/WorkoutTemplate';
import WorkoutTemplateExercise from '../database/models/WorkoutTemplateExercise';
import WorkoutTemplateSet from '../database/models/WorkoutTemplateSet';

export type EnrichedWorkoutTemplateSet = WorkoutTemplateSet & {
  exerciseId: string;
  groupId?: string;
};

export function useWorkoutTemplateDetails(templateId: string | null) {
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [templateExercises, setTemplateExercises] = useState<WorkoutTemplateExercise[]>([]);
  const [templateSets, setTemplateSets] = useState<EnrichedWorkoutTemplateSet[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all data imperatively (non-reactive) to avoid nested subscription issues
  const loadData = useCallback(async () => {
    if (!templateId) {
      setTemplate(null);
      setTemplateExercises([]);
      setTemplateSets([]);
      setExercises([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch template
      const templates = await database
        .get<WorkoutTemplate>('workout_templates')
        .query(Q.where('id', templateId), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      if (templates.length === 0) {
        setTemplate(null);
        setTemplateExercises([]);
        setTemplateSets([]);
        setExercises([]);
        setIsLoading(false);
        return;
      }

      const templateModel = templates[0];
      setTemplate(templateModel);

      // Fetch template exercises
      const tplExercises = await database
        .get<WorkoutTemplateExercise>('workout_template_exercises')
        .query(
          Q.where('template_id', templateId),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('exercise_order', Q.asc)
        )
        .fetch();

      setTemplateExercises(tplExercises);

      if (tplExercises.length === 0) {
        setTemplateSets([]);
        setExercises([]);
        setIsLoading(false);
        return;
      }

      const templateExerciseIds = tplExercises.map((te) => te.id);

      // Build a map to enrich sets with exerciseId and groupId
      const templateExerciseMap = new Map<string, { exerciseId: string; groupId?: string }>();
      tplExercises.forEach((te) => {
        templateExerciseMap.set(te.id, { exerciseId: te.exerciseId, groupId: te.groupId });
      });

      // Fetch template sets
      const sets = await database
        .get<WorkoutTemplateSet>('workout_template_sets')
        .query(
          Q.where('template_exercise_id', Q.oneOf(templateExerciseIds)),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('set_order', Q.asc)
        )
        .fetch();

      // Enrich sets with exerciseId and groupId from template exercise
      // Copy all fields explicitly — WatermelonDB Model properties are getters and are not copied by spread
      const enrichedSets: EnrichedWorkoutTemplateSet[] = sets.map((set) => {
        const data = templateExerciseMap.get(set.templateExerciseId);
        return {
          id: set.id,
          templateExerciseId: set.templateExerciseId,
          targetReps: set.targetReps,
          targetWeight: set.targetWeight,
          restTimeAfter: set.restTimeAfter,
          setOrder: set.setOrder,
          isDropSet: set.isDropSet,
          createdAt: set.createdAt,
          updatedAt: set.updatedAt,
          deletedAt: set.deletedAt,
          exerciseId: data?.exerciseId ?? '',
          groupId: data?.groupId,
        } as EnrichedWorkoutTemplateSet;
      });
      setTemplateSets(enrichedSets);

      // Get unique exercise IDs and fetch exercises
      const exerciseIds = [...new Set(tplExercises.map((te) => te.exerciseId).filter(Boolean))];

      if (exerciseIds.length === 0) {
        setExercises([]);
        setIsLoading(false);
        return;
      }

      const exerciseList = await database
        .get<Exercise>('exercises')
        .query(Q.where('id', Q.oneOf(exerciseIds)), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      setExercises(exerciseList);
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading template details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load template');
      setIsLoading(false);
    }
  }, [templateId]);

  // Observe templates and template_exercises to trigger reload. Debounce to avoid duplicate loads when both emit.
  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  useEffect(() => {
    if (!templateId) {
      setTemplate(null);
      setTemplateExercises([]);
      setTemplateSets([]);
      setExercises([]);
      setIsLoading(false);
      return;
    }

    loadData();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        loadDataRef.current();
      }, 200);
    };

    const templateSubscription = database
      .get<WorkoutTemplate>('workout_templates')
      .query(Q.where('id', templateId), Q.where('deleted_at', Q.eq(null)))
      .observe()
      .subscribe({
        next: scheduleReload,
        error: (err) => {
          console.error('Error observing template:', err);
          setError(err instanceof Error ? err.message : 'Failed to observe template');
        },
      });

    const exercisesSubscription = database
      .get<WorkoutTemplateExercise>('workout_template_exercises')
      .query(Q.where('template_id', templateId), Q.where('deleted_at', Q.eq(null)))
      .observe()
      .subscribe({
        next: scheduleReload,
        error: (err) => {
          console.error('Error observing template exercises:', err);
        },
      });

    return () => {
      templateSubscription.unsubscribe();
      exercisesSubscription.unsubscribe();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [templateId, loadData]);

  return {
    template,
    templateExercises,
    templateSets,
    exercises,
    isLoading,
    error,
  };
}
