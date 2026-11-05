import { useEffect, useRef, useState } from 'react';

import { database } from '@/database/database-instance';
import {
  type ExerciseStrengthGrade,
  type StrengthGradeState,
  StrengthLevelRepository,
} from '@/database/repositories/StrengthLevelRepository';

const EMPTY: StrengthGradeState = { grades: new Map(), performedWithoutWeighIn: false };

export interface UseStrengthLevelsOptions {
  /** Off while the workout area is locked: nothing is read, nothing is shown. */
  enabled?: boolean;
}

export interface UseStrengthLevelsResult {
  grades: ReadonlyMap<string, ExerciseStrengthGrade>;
  /** A listed lift was trained in the window but there is no weigh-in to grade it against. */
  performedWithoutWeighIn: boolean;
  isLoading: boolean;
}

/**
 * Strength grades for the given lifts, reloaded when a workout or a weigh-in changes. A response
 * that finishes after a newer request has started is dropped, so a slow read never overwrites
 * fresher data. A failed read leaves no grades rather than throwing into render.
 */
export function useStrengthLevels(
  exerciseIds: readonly string[],
  { enabled = true }: UseStrengthLevelsOptions = {}
): UseStrengthLevelsResult {
  // Callers pass a fresh array each render; the joined key is what actually identifies the query.
  const idKey = [...new Set(exerciseIds)].sort().join('|');
  const [state, setState] = useState<StrengthGradeState>(EMPTY);
  const [isLoading, setIsLoading] = useState(false);
  const requestRef = useRef(0);
  const inactive = !enabled || idKey === '';

  useEffect(() => {
    if (inactive) {
      return;
    }

    let cancelled = false;
    const ids = idKey.split('|');
    const load = async () => {
      const request = ++requestRef.current;
      setIsLoading(true);
      try {
        const next = await StrengthLevelRepository.fetchGradeState(ids, Date.now());
        if (!cancelled && request === requestRef.current) {
          setState(next);
        }
      } catch (error) {
        console.error('Error loading strength levels:', error);
        if (!cancelled && request === requestRef.current) {
          setState(EMPTY);
        }
      } finally {
        if (!cancelled && request === requestRef.current) {
          setIsLoading(false);
        }
      }
    };

    load();
    const subscription = database
      .withChangesForTables([
        'workout_logs',
        'workout_log_exercises',
        'workout_log_sets',
        'user_metrics',
      ])
      .subscribe(() => {
        load();
      });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [idKey, inactive]);

  // While inactive the state from an earlier query is not shown; a re-enabled query reloads.
  if (inactive) {
    return { grades: EMPTY.grades, performedWithoutWeighIn: false, isLoading: false };
  }

  return {
    grades: state.grades,
    performedWithoutWeighIn: state.performedWithoutWeighIn,
    isLoading,
  };
}
