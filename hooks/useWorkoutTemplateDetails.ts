import { Q } from '@nozbe/watermelondb';
import { useEffect, useState } from 'react';
import { combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { database } from '../database';
import Exercise from '../database/models/Exercise';
import WorkoutTemplate from '../database/models/WorkoutTemplate';
import WorkoutTemplateExercise from '../database/models/WorkoutTemplateExercise';
import WorkoutTemplateSet from '../database/models/WorkoutTemplateSet';

const WORKOUT_TEMPLATE_SET_COLUMNS = [
  'target_reps',
  'target_weight',
  'rest_time_after',
  'set_order',
  'is_drop_set',
  'deleted_at',
] as const;

export type EnrichedWorkoutTemplateSet = WorkoutTemplateSet & {
  exerciseId: string;
  groupId?: string;
};

function buildEnrichedTemplateSets(
  templateExercises: WorkoutTemplateExercise[],
  sets: WorkoutTemplateSet[]
): EnrichedWorkoutTemplateSet[] {
  const map = new Map<string, { exerciseId: string; groupId?: string }>();
  templateExercises.forEach((te) => {
    map.set(te.id, { exerciseId: te.exerciseId, groupId: te.groupId });
  });
  return sets.map((set) => {
    const data = map.get(set.templateExerciseId);
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
}

export function useWorkoutTemplateDetails(templateId: string | null) {
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [templateExercises, setTemplateExercises] = useState<WorkoutTemplateExercise[]>([]);
  const [templateSets, setTemplateSets] = useState<EnrichedWorkoutTemplateSet[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!templateId) {
      setTemplate(null);
      setTemplateExercises([]);
      setTemplateSets([]);
      setExercises([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);

    const templateQuery = database
      .get<WorkoutTemplate>('workout_templates')
      .query(Q.where('id', templateId), Q.where('deleted_at', Q.eq(null)));
    const templateExercisesQuery = database
      .get<WorkoutTemplateExercise>('workout_template_exercises')
      .query(
        Q.where('template_id', templateId),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('exercise_order', Q.asc)
      );

    const templateObs = templateQuery
      .observe()
      .pipe(map((rows) => (rows.length > 0 ? rows[0] : null)));
    const templateExercisesObs = templateExercisesQuery.observe();
    const templateSetsObs = templateExercisesObs.pipe(
      switchMap((tplExs) => {
        const ids = tplExs.map((te) => te.id);
        if (ids.length === 0) {
          return of([]);
        }
        return database
          .get<WorkoutTemplateSet>('workout_template_sets')
          .query(
            Q.where('template_exercise_id', Q.oneOf(ids)),
            Q.where('deleted_at', Q.eq(null)),
            Q.sortBy('set_order', Q.asc)
          )
          .observeWithColumns([...WORKOUT_TEMPLATE_SET_COLUMNS]);
      })
    );
    const exercisesObs = templateExercisesObs.pipe(
      switchMap((tplExs) => {
        const ids = [...new Set(tplExs.map((te) => te.exerciseId).filter(Boolean))];
        if (ids.length === 0) {
          return of([]);
        }
        return database
          .get<Exercise>('exercises')
          .query(Q.where('id', Q.oneOf(ids)), Q.where('deleted_at', Q.eq(null)))
          .observe();
      })
    );

    const subscription = combineLatest([
      templateObs,
      templateExercisesObs,
      templateSetsObs,
      exercisesObs,
    ])
      .pipe(
        map(([tpl, tplExs, sets, exerciseList]) => {
          if (!tpl) {
            return null;
          }
          const enrichedSets = buildEnrichedTemplateSets(tplExs, sets);
          return {
            template: tpl,
            templateExercises: tplExs,
            templateSets: enrichedSets,
            exercises: exerciseList,
          };
        })
      )
      .subscribe({
        next: (payload) => {
          if (payload === null) {
            setTemplate(null);
            setTemplateExercises([]);
            setTemplateSets([]);
            setExercises([]);
            setIsLoading(false);
            return;
          }
          setTemplate(payload.template);
          setTemplateExercises(payload.templateExercises);
          setTemplateSets(payload.templateSets);
          setExercises(payload.exercises);
          setError(null);
          setIsLoading(false);
        },
        error: (err) => {
          console.error('Error in template details pipeline:', err);
          setError(err instanceof Error ? err.message : 'Failed to load template');
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, [templateId]);

  return {
    template,
    templateExercises,
    templateSets,
    exercises,
    isLoading,
    error,
  };
}
