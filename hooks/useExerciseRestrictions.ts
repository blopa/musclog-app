import { useEffect, useMemo, useState } from 'react';

import type ExerciseRestriction from '@/database/models/ExerciseRestriction';
import {
  ExerciseRestrictionService,
  toActiveRestriction,
} from '@/database/services/ExerciseRestrictionService';
import { type ActiveRestriction, isRestrictionActive } from '@/utils/exerciseSubstitution';

const RESTRICTION_COLUMNS = ['kind', 'note', 'expires_at', 'updated_at'];

export interface UseExerciseRestrictionsResult {
  /** Every live row, including injuries that have healed (the manager shows those as healed). */
  rows: ExerciseRestriction[];
  /** The restrictions in force right now — what the suggestion logic consumes. */
  active: ActiveRestriction[];
  isLoading: boolean;
}

/** The user's exercise restrictions, observed. `now` is read at emission time, not render time. */
export function useExerciseRestrictions(): UseExerciseRestrictionsResult {
  // `now` is captured when rows arrive, not while rendering: render must be pure, and an injury
  // that heals while the screen is open is simply re-evaluated on the next emission or mount.
  const [snapshot, setSnapshot] = useState<{ rows: ExerciseRestriction[]; now: number }>({
    rows: [],
    now: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const subscription = ExerciseRestrictionService.restrictionsQuery()
      .observeWithColumns(RESTRICTION_COLUMNS)
      .subscribe({
        next: (next) => {
          setSnapshot({ rows: next, now: Date.now() });
          setIsLoading(false);
        },
        error: (error: Error) => {
          console.error('Error observing exercise restrictions:', error);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  return useMemo(() => {
    const { rows, now } = snapshot;
    return {
      rows,
      active: rows
        .map(toActiveRestriction)
        .filter((restriction) => isRestrictionActive(restriction, now)),
      isLoading,
    };
  }, [snapshot, isLoading]);
}
