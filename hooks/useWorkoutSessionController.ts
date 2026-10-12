import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { SettingsService } from '@/database/services/SettingsService';
import { WorkoutProgressionService } from '@/database/services/WorkoutProgressionService';
import type { EnrichedWorkoutLogSet } from '@/database/services/WorkoutService';
import { WorkoutService } from '@/database/services/WorkoutService';
import {
  type SessionSetValues,
  WorkoutSessionService,
} from '@/database/services/WorkoutSessionService';
import { NotificationService } from '@/services/NotificationService';
import {
  clearActiveWorkoutLogId,
  clearRestTimerEndAt,
  getRestTimerEndAt,
  setRestTimerEndAt,
} from '@/utils/activeWorkoutStorage';
import { resolveRestSeconds } from '@/utils/restTimer';
import { isPerformedWorkoutSet } from '@/utils/workoutSetCompletion';

export type SessionDraft = {
  weight: string;
  reps: string;
  rir?: string;
  rpe?: string;
  partials?: string;
};

export function useWorkoutSessionController(
  logId: string | undefined,
  sets: EnrichedWorkoutLogSet[],
  options: { autoRest: boolean; defaultRest: number; refresh: () => Promise<void> | void }
) {
  const [view, setView] = useState<'inline' | 'guided'>('guided');
  const [drafts, setDrafts] = useState<Record<string, Partial<SessionDraft>>>({});
  // The latest drafts, readable from a handler without going through a state updater: persisting
  // from inside an updater is a side effect React may run twice.
  const draftsRef = useRef(drafts);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  // Length of the rest that is running, for the progress bar. Not persisted: after a restart the
  // time still left stands in for it.
  const [restTotal, setRestTotal] = useState(0);
  // Identifies one rest from its start to its end, so a view can remember a choice made during it
  // (the expanded timer panel) without an effect resetting it when the next rest begins.
  const [restId, setRestId] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null | undefined>();
  const lock = useRef(false);
  const writeQueue = useRef(Promise.resolve());
  const key = logId ? `workout_drafts_${logId}` : null;
  useEffect(() => {
    let live = true;
    Promise.all([
      SettingsService.getWorkoutView(),
      logId ? getRestTimerEndAt(logId) : Promise.resolve(null),
      key ? AsyncStorage.getItem(key) : Promise.resolve(null),
    ])
      .then(([value, timer, raw]) => {
        if (!live) {
          return;
        }
        setView(value);
        setNow(Date.now());
        setRestEnd(timer);
        setRestTotal(timer ? Math.max(0, Math.ceil((timer - Date.now()) / 1000)) : 0);
        let stored: Record<string, Partial<SessionDraft>> = {};
        if (raw) {
          try {
            stored = JSON.parse(raw);
          } catch {
            stored = {};
          }
        }
        draftsRef.current = stored;
        setDrafts(stored);
        setLoadedKey(key);
      })
      .catch((e) => {
        if (live) {
          setError(e);
          setLoadedKey(key);
        }
      });
    return () => {
      live = false;
    };
  }, [logId, key]);
  // The clock only matters while a rest is counting down. Ticking all session long re-rendered every
  // set row once a second for nothing. Whoever starts or restores a rest also resets `now`, so the
  // first frame of a rest never reads a stale clock.
  useEffect(() => {
    if (restEnd == null) {
      return;
    }

    const tick = () => {
      const current = Date.now();
      setNow(current);
      // Once the rest has run out the remaining time stays at zero; stop re-rendering for it.
      if (current >= restEnd) {
        clearInterval(timer);
      }
    };

    const timer = setInterval(tick, 1000);
    const subscription = AppState.addEventListener('change', tick);
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [restEnd]);

  const persist = (next: Record<string, Partial<SessionDraft>>) => {
    if (key) {
      writeQueue.current = writeQueue.current
        .catch(() => {})
        .then(() => AsyncStorage.setItem(key, JSON.stringify(next)));
    }
  };
  /** Replaces the drafts and saves them. */
  const commitDrafts = (next: Record<string, Partial<SessionDraft>>) => {
    draftsRef.current = next;
    setDrafts(next);
    persist(next);
  };
  const edit = (id: string, draft: SessionDraft) => {
    commitDrafts({ ...draftsRef.current, [id]: draft });
  };

  const changeView = async (value: 'inline' | 'guided') => {
    setView(value);
    try {
      await SettingsService.setWorkoutView(value);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  };

  const startRest = async (seconds: number) => {
    if (!logId) {
      return;
    }

    const end = Date.now() + seconds * 1000;
    await setRestTimerEndAt(logId, end);
    setNow(Date.now());
    setRestEnd(end);
    setRestTotal(seconds);
    setRestId((id) => id + 1);
    await NotificationService.scheduleRestTimerNotification(seconds);
  };

  /** Lengthens or shortens the rest that is running; its reminder moves with it. */
  const adjustRest = async (deltaSeconds: number) => {
    if (!logId || !restEnd) {
      return;
    }

    const remaining = Math.max(1, Math.ceil((restEnd - Date.now()) / 1000) + deltaSeconds);
    const end = Date.now() + remaining * 1000;
    await setRestTimerEndAt(logId, end);
    setNow(Date.now());
    setRestEnd(end);
    setRestTotal((total) => Math.max(remaining, total + deltaSeconds));
    await NotificationService.cancelRestTimerNotification();
    await NotificationService.scheduleRestTimerNotification(remaining);
  };

  const stopRest = async () => {
    await clearRestTimerEndAt();
    setRestEnd(null);
    await NotificationService.cancelRestTimerNotification();
  };

  const run = async (action: () => Promise<void>) => {
    if (lock.current) {
      return;
    }

    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      await options.refresh();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const complete = async (id: string, values: SessionSetValues) =>
    run(async () => {
      if (!logId) {
        return;
      }

      const set = sets.find((s) => s.id === id);
      if (!set) {
        return;
      }

      if (isPerformedWorkoutSet(set)) {
        await WorkoutSessionService.saveSet(logId, id, 'planned');
        return;
      }

      await WorkoutSessionService.saveSet(logId, id, 'performed', values);
      const next = { ...draftsRef.current };
      delete next[id];
      commitDrafts(next);
      if (options.autoRest) {
        await startRest(resolveRestSeconds(set.restTimeAfter, options.defaultRest));
      }
    });

  const skip = async (id: string) =>
    run(async () => {
      if (logId) {
        await WorkoutSessionService.saveSet(logId, id, 'skipped');
      }
    });

  /** "Use the plan's" for one exercise: only its unfinished sets go back to the prescription. */
  const revert = async (logExerciseId: string) =>
    run(async () => {
      await WorkoutProgressionService.revertStartAdjustment(logExerciseId);
      const affected = new Set(
        sets
          .filter(
            (set) => set.logExerciseId === logExerciseId && set.completionStatus === 'planned'
          )
          .map((set) => set.id)
      );

      const next = { ...draftsRef.current };
      for (const id of affected) {
        if (!next[id]) {
          continue;
        }
        const effort = { ...next[id] };
        delete effort.weight;
        delete effort.reps;
        if (Object.keys(effort).length) {
          next[id] = effort;
        } else {
          delete next[id];
        }
      }
      commitDrafts(next);
    });
  const finish = async () =>
    run(async () => {
      if (!logId) {
        return;
      }
      await WorkoutService.completeWorkout(logId);
      await stopRest();
      await writeQueue.current;
      if (key) {
        await AsyncStorage.removeItem(key);
      }
      draftsRef.current = {};
      setDrafts({});
    });
  /**
   * Throws the session away. Everything that outlives the screen goes with it: the stored active
   * workout (or Home keeps offering to resume a deleted log), a scheduled "rest over" reminder,
   * and the persisted drafts. It does not go through `run`, whose refresh would reload a log that no
   * longer exists.
   */
  const discard = async () => {
    if (!logId || lock.current) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await WorkoutService.deleteWorkoutLog(logId);
      await Promise.all([stopRest(), clearActiveWorkoutLogId()]);
      await writeQueue.current;
      if (key) {
        await AsyncStorage.removeItem(key);
      }
      draftsRef.current = {};
      setDrafts({});
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return {
    view,
    changeView,
    drafts,
    edit,
    complete,
    skip,
    revert,
    finish,
    discard,
    startRest,
    stopRest,
    adjustRest,
    restTotal,
    restId,
    busy: busy || loadedKey !== key,
    error,
    defaultRest: options.defaultRest,
    restSeconds: restEnd ? Math.max(0, Math.ceil((restEnd - now) / 1000)) : 0,
  };
}
