import { useMemo } from 'react';

import { useGyms } from '@/hooks/useGyms';
import { useSettings } from '@/hooks/useSettings';
import type { GymSnapshot } from '@/utils/gym';

export interface UseActiveGymResult {
  /** The gym being trained in, or null when none is selected (or the selected one is gone). */
  gym: GymSnapshot | null;
  gyms: GymSnapshot[];
  isLoading: boolean;
}

/**
 * The selected gym profile. The choice lives in settings (`activeGymId`, a primitive) and the
 * profile in the `gyms` table; this joins them, so a deleted gym simply reads as "none".
 */
export function useActiveGym(): UseActiveGymResult {
  const { activeGymId } = useSettings();
  const { gyms, isLoading } = useGyms();

  const gym = useMemo(
    () => (activeGymId ? (gyms.find((candidate) => candidate.id === activeGymId) ?? null) : null),
    [activeGymId, gyms]
  );

  return useMemo(() => ({ gym, gyms, isLoading }), [gym, gyms, isLoading]);
}
