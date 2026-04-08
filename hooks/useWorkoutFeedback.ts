import { useState } from 'react';

import { WorkoutService } from '@/database/services';

export type SessionFeedbackData = {
  difficulty: number;
  exhaustion: number;
  enjoyment: number;
};

export function useWorkoutFeedback() {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const completeWorkout = async (workoutLogId: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await WorkoutService.completeWorkout(workoutLogId);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const submitFeedback = async (workoutLogId: string, data: SessionFeedbackData) => {
    setIsSaving(true);
    setError(null);
    try {
      await WorkoutService.updateWorkoutLogFeedback(workoutLogId, {
        exhaustionLevel: data.exhaustion,
        workoutScore: Math.round((data.difficulty + data.exhaustion + data.enjoyment) / 3),
      });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return { completeWorkout, submitFeedback, isSaving, error } as const;
}
