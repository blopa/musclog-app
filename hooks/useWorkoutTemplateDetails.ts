import { Q } from '@nozbe/watermelondb';
import { useEffect, useRef, useState } from 'react';

import { database } from '../database';
import Exercise from '../database/models/Exercise';
import WorkoutTemplate from '../database/models/WorkoutTemplate';
import WorkoutTemplateSet from '../database/models/WorkoutTemplateSet';

export function useWorkoutTemplateDetails(templateId: string | null) {
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [templateSets, setTemplateSets] = useState<WorkoutTemplateSet[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use refs to track subscriptions for cleanup
  const setsSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const exercisesSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    if (!templateId) {
      setTemplate(null);
      setTemplateSets([]);
      setExercises([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Clean up previous subscriptions
    setsSubscriptionRef.current?.unsubscribe();
    exercisesSubscriptionRef.current?.unsubscribe();

    // Observe template
    const templateQuery = database
      .get<WorkoutTemplate>('workout_templates')
      .query(Q.where('id', templateId), Q.where('deleted_at', Q.eq(null)));

    const templateSubscription = templateQuery.observe().subscribe({
      next: (templates) => {
        if (templates.length === 0) {
          setTemplate(null);
          setTemplateSets([]);
          setExercises([]);
          setIsLoading(false);
          return;
        }

        const templateModel = templates[0];
        setTemplate(templateModel);

        // Observe template sets
        const setsQuery = database
          .get<WorkoutTemplateSet>('workout_template_sets')
          .query(
            Q.where('template_id', templateId),
            Q.where('deleted_at', Q.eq(null)),
            Q.sortBy('set_order', Q.asc)
          );

        setsSubscriptionRef.current = setsQuery.observe().subscribe({
          next: (sets) => {
            setTemplateSets(sets);

            // Get unique exercise IDs
            const exerciseIds = [
              ...new Set(sets.map((set) => set.exerciseId).filter((id) => id !== undefined)),
            ];

            if (exerciseIds.length === 0) {
              setExercises([]);
              setIsLoading(false);
              return;
            }

            // Observe exercises
            const exercisesQuery = database
              .get<Exercise>('exercises')
              .query(Q.where('id', Q.oneOf(exerciseIds)), Q.where('deleted_at', Q.eq(null)));

            exercisesSubscriptionRef.current = exercisesQuery.observe().subscribe({
              next: (exerciseList) => {
                setExercises(exerciseList);
                setIsLoading(false);
              },
              error: (err) => {
                console.error('Error observing exercises:', err);
                setError(err instanceof Error ? err.message : 'Failed to load exercises');
                setIsLoading(false);
              },
            });
          },
          error: (err) => {
            console.error('Error observing template sets:', err);
            setError(err instanceof Error ? err.message : 'Failed to load template sets');
            setIsLoading(false);
          },
        });
      },
      error: (err) => {
        console.error('Error observing template:', err);
        setError(err instanceof Error ? err.message : 'Failed to load template');
        setIsLoading(false);
      },
    });

    return () => {
      templateSubscription.unsubscribe();
      setsSubscriptionRef.current?.unsubscribe();
      exercisesSubscriptionRef.current?.unsubscribe();
    };
  }, [templateId]);

  return {
    template,
    templateSets,
    exercises,
    isLoading,
    error,
  };
}
