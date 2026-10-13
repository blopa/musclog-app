import { useEffect, useMemo, useState } from 'react';

import { GymService } from '@/database/services/GymService';
import { type GymSnapshot, snapshotFromGymRow } from '@/utils/gym';

/** Every column a gym edit can change, so an in-place update re-emits (the query is sorted). */
const GYM_COLUMNS = [
  'name',
  'bar_weight_kg',
  'plates_json',
  'weight_increment_kg',
  'equipment_json',
  'weight_unit',
  'updated_at',
];

export interface UseGymsResult {
  gyms: GymSnapshot[];
  isLoading: boolean;
}

/**
 * The user's gym profiles, oldest first. `observeWithColumns`, not `observe`: the query sorts, so
 * WatermelonDB's reloading observer would dedupe by record identity and never emit for an edit.
 */
export function useGyms(): UseGymsResult {
  const [gyms, setGyms] = useState<GymSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const subscription = GymService.gymsQuery()
      .observeWithColumns(GYM_COLUMNS)
      .subscribe({
        next: (rows) => {
          setGyms(rows.map(snapshotFromGymRow));
          setIsLoading(false);
        },
        error: (error: Error) => {
          console.error('Error observing gyms:', error);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  return useMemo(() => ({ gyms, isLoading }), [gyms, isLoading]);
}
