import { useState } from 'react';
import { WorkoutService } from '../database/services/WorkoutService';

export function useEditWorkoutSets() {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const saveSets = async (
    workoutId: string,
    updates: {
      setId: string;
      reps?: number;
      weight?: number;
      partials?: number;
      restTimeAfter?: number;
      repsInReserve?: number;
      difficultyLevel?: number;
      isSkipped?: boolean;
      isDropSet?: boolean;
    }[],
    deletedSetIds?: string[]
  ) => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await WorkoutService.updateWorkoutSets(workoutId, updates as any, deletedSetIds);
      setIsSaving(false);
      return res;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setIsSaving(false);
      throw err;
    }
  };

  return { isSaving, error, saveSets } as const;
}
