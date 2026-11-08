import {
  EMPTY_STRENGTH_STATE,
  type ExerciseStrengthGrade,
  StrengthLevelRepository,
} from '@/database/repositories/StrengthLevelRepository';
import { useTableQuery } from '@/hooks/useTableQuery';

/** The tables a strength level is computed from: sessions, their sets, and the body weight. */
const STRENGTH_TABLES = [
  'workout_logs',
  'workout_log_exercises',
  'workout_log_sets',
  'user_metrics',
] as const;

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
 * Strength grades for the given lifts, reloaded when a workout or a weigh-in changes. A failed
 * read leaves no grades rather than throwing into render.
 */
export function useStrengthLevels(
  exerciseIds: readonly string[],
  { enabled = true }: UseStrengthLevelsOptions = {}
): UseStrengthLevelsResult {
  // Callers pass a fresh array each render; the joined key is what actually identifies the query.
  const idKey = [...new Set(exerciseIds)].sort().join('|');
  const { data, isLoading } = useTableQuery({
    tables: STRENGTH_TABLES,
    key: idKey,
    enabled: enabled && idKey !== '',
    load: () => StrengthLevelRepository.fetchGradeState(idKey.split('|'), Date.now()),
    empty: EMPTY_STRENGTH_STATE,
    scope: 'useStrengthLevels',
  });

  return {
    grades: data.grades,
    performedWithoutWeighIn: data.performedWithoutWeighIn,
    isLoading,
  };
}
