import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { database } from '@/database/database-instance';
import {
  MuscleLoadRepository,
  type MuscleLoadSetDetail,
} from '@/database/repositories/MuscleLoadRepository';
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

/**
 * Recent training load for the Progress screen. Reads once on mount and again whenever a session
 * or its sets change. Only the newest read may publish, so a slow earlier read can't overwrite a
 * later one. A failed read shows as no load rather than throwing into render.
 */
export function useMuscleLoad(): UseMuscleLoadResult {
  const [snapshot, setSnapshot] = useState<MuscleLoadSnapshot>(EMPTY_SNAPSHOT);
  const [isLoading, setIsLoading] = useState(true);
  const latestRequestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    const now = Date.now();

    try {
      const sets = await MuscleLoadRepository.fetchRecentSets(now);
      if (requestId === latestRequestRef.current) {
        setSnapshot({ sets, now });
      }
    } catch (error) {
      console.error('Error loading muscle load:', error);
      if (requestId === latestRequestRef.current) {
        setSnapshot({ sets: [], now });
      }
    } finally {
      if (requestId === latestRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Every read is deferred to a timer, so the effect body itself never sets state.
    const schedule = (delayMs: number) => {
      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        timer = undefined;
        void refresh();
      }, delayMs);
    };

    schedule(0);

    const subscription = database
      .withChangesForTables(['workout_logs', 'workout_log_sets'])
      .subscribe(() => schedule(RELOAD_DEBOUNCE_MS));

    return () => {
      if (timer) {
        clearTimeout(timer);
      }

      subscription.unsubscribe();
    };
  }, [refresh]);

  const load = useMemo(() => computeMuscleLoad(snapshot.sets, snapshot.now), [snapshot]);

  return { load, sets: snapshot.sets, isLoading };
}
