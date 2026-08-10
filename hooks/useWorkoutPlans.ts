import { useEffect, useMemo, useState } from 'react';

import type WorkoutPlan from '@/database/models/WorkoutPlan';
import type WorkoutPlanTemplate from '@/database/models/WorkoutPlanTemplate';
import { WorkoutPlanRepository } from '@/database/repositories/WorkoutPlanRepository';

export interface UseWorkoutPlansResult {
  plans: WorkoutPlan[];
  memberships: WorkoutPlanTemplate[];
  isLoading: boolean;
}

export function useWorkoutPlans(): UseWorkoutPlansResult {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [memberships, setMemberships] = useState<WorkoutPlanTemplate[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [membershipsLoaded, setMembershipsLoaded] = useState(false);

  useEffect(() => {
    const plansSubscription = WorkoutPlanRepository.getAll()
      .observeWithColumns(['name', 'description', 'cycle_type', 'icon', 'difficulty', 'updated_at'])
      .subscribe({
        next: (records) => {
          setPlans(records);
          setPlansLoaded(true);
        },
        error: (error: Error) => {
          console.error('Error observing workout plans:', error);
          setPlansLoaded(true);
        },
      });
    const membershipsSubscription = WorkoutPlanRepository.getAllMemberships()
      .observeWithColumns(['plan_id', 'template_id', 'week_days_json', 'position', 'updated_at'])
      .subscribe({
        next: (records) => {
          setMemberships(records);
          setMembershipsLoaded(true);
        },
        error: (error: Error) => {
          console.error('Error observing workout plan memberships:', error);
          setMembershipsLoaded(true);
        },
      });

    return () => {
      plansSubscription.unsubscribe();
      membershipsSubscription.unsubscribe();
    };
  }, []);

  return useMemo(
    () => ({ plans, memberships, isLoading: !plansLoaded || !membershipsLoaded }),
    [plans, memberships, plansLoaded, membershipsLoaded]
  );
}
