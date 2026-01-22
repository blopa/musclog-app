import { useState, useEffect, useMemo } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import WorkoutTemplate from '../database/models/WorkoutTemplate';
import { WorkoutTemplateService } from '../database/services/WorkoutTemplateService';

export type WorkoutTemplateWithMetadata = {
  id: string;
  name: string;
  description?: string;
  exerciseCount: number;
  lastCompleted?: string;
  lastCompletedTimestamp?: number;
  duration?: string;
  image?: any;
};

export type UseWorkoutTemplatesResult = {
  templates: WorkoutTemplateWithMetadata[];
  isLoading: boolean;
  error: string | null;
};

export function useWorkoutTemplates(): UseWorkoutTemplatesResult {
  const [templates, setTemplates] = useState<WorkoutTemplateWithMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = database
      .get<WorkoutTemplate>('workout_templates')
      .query(Q.where('deleted_at', Q.eq(null)));

    const subscription = query.observe().subscribe({
      next: async (_templatesList) => {
        // Note: We don't use templatesList directly because getAllTemplatesWithMetadata()
        // performs its own query with additional processing (exercise counts, last completed, etc.)
        // The observable triggers the update, but we re-fetch to get fully processed data
        try {
          setError(null);
          // Process templates with metadata when they change
          const templatesWithMetadata = await WorkoutTemplateService.getAllTemplatesWithMetadata();
          setTemplates(templatesWithMetadata);
          setIsLoading(false);
        } catch (err) {
          console.error('Error processing workout templates:', err);
          setError(err instanceof Error ? err.message : 'Failed to load workout templates');
          setTemplates([]);
          setIsLoading(false);
        }
      },
      error: (err) => {
        console.error('Error observing workout templates:', err);
        setError(err instanceof Error ? err.message : 'Failed to load workout templates');
        setTemplates([]);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  return useMemo(
    () => ({
      templates,
      isLoading,
      error,
    }),
    [templates, isLoading, error]
  );
}
