import { useState } from 'react';

import { WorkoutService, type WorkoutSetUpdate } from '@/database/services/WorkoutService';
import { handleError } from '@/utils/handleError';

export function useEditWorkoutSets() {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const saveSets = async (
    workoutId: string,
    updates: WorkoutSetUpdate[],
    deletedSetIds?: string[]
  ) => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await WorkoutService.updateWorkoutSets(workoutId, updates, deletedSetIds);
      setIsSaving(false);
      return res;
    } catch (err) {
      handleError(err, 'useEditWorkoutSets.saveSets');
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setIsSaving(false);
      throw err;
    }
  };

  return { isSaving, error, saveSets } as const;
}
