import { useState, useEffect, useMemo } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import NutritionGoal from '../database/models/NutritionGoal';

export type UseCurrentNutritionGoalResult = {
  goal: NutritionGoal | null;
  isLoading: boolean;
};

// TODO: make this return any number of goals
export function useCurrentNutritionGoal(): UseCurrentNutritionGoalResult {
  const [goal, setGoal] = useState<NutritionGoal | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const query = database
      .get<NutritionGoal>('nutrition_goals')
      .query(Q.where('effective_until', Q.eq(null)), Q.where('deleted_at', Q.eq(null)));

    const subscription = query.observe().subscribe({
      next: (goals) => {
        setGoal(goals.length > 0 ? goals[0] : null);
        setIsLoading(false);
      },
      error: () => {
        setGoal(null);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  // Memoize the return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      goal,
      isLoading,
    }),
    [goal, isLoading]
  );
}
