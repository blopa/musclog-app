import { useMemo } from 'react';

import {
  MuscleLoadRepository,
  type MuscleLoadSetDetail,
} from '@/database/repositories/MuscleLoadRepository';
import { useTableQuery } from '@/hooks/useTableQuery';
import type { MuscleSlug } from '@/utils/muscleGroupMapping';
import { computeMuscleLoad, type MuscleLoadEntry } from '@/utils/muscleLoad';

/** Workout edits arrive in bursts (a set saved, then the session finished); read once after the burst. */
const RELOAD_DEBOUNCE_MS = 300;

interface MuscleLoadSnapshot {
  sets: MuscleLoadSetDetail[];
  now: number;
}

export interface UseMuscleLoadResult {
  /** Recent load per muscle slug, computed from `sets` at the moment they were read. */
  load: ReadonlyMap<MuscleSlug, MuscleLoadEntry>;
  /** The counted sets behind `load`, for the per-muscle detail list. */
  sets: MuscleLoadSetDetail[];
  isLoading: boolean;
}

const EMPTY_SNAPSHOT: MuscleLoadSnapshot = { sets: [], now: 0 };

async function readSnapshot(): Promise<MuscleLoadSnapshot> {
  const now = Date.now();

  return { sets: await MuscleLoadRepository.fetchRecentSets(now), now };
}

/**
 * Recent training load for the Progress screen. Reads once on mount and again whenever a session
 * or its sets change. A failed read shows as no load rather than throwing into render.
 */
export function useMuscleLoad(): UseMuscleLoadResult {
  const { data: snapshot, isLoading } = useTableQuery({
    tables: ['workout_logs', 'workout_log_sets'],
    load: readSnapshot,
    empty: EMPTY_SNAPSHOT,
    scope: 'useMuscleLoad',
    debounceMs: RELOAD_DEBOUNCE_MS,
  });
  const load = useMemo(() => computeMuscleLoad(snapshot.sets, snapshot.now), [snapshot]);

  return { load, sets: snapshot.sets, isLoading };
}
