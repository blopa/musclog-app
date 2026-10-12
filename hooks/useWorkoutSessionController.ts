import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { SettingsService } from '@/database/services/SettingsService';
import type { EnrichedWorkoutLogSet } from '@/database/services/WorkoutService';
import { WorkoutService } from '@/database/services/WorkoutService';
import {
  type SessionSetValues,
  WorkoutSessionService,
} from '@/database/services/WorkoutSessionService';
import { NotificationService } from '@/services/NotificationService';
import {
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
  const [drafts, setDrafts] = useState<Record<string, SessionDraft>>({});
  const [restEnd, setRestEnd] = useState<number | null>(null);
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
        setRestEnd(timer);
        setDrafts({});
        if (raw) {
          try {
            setDrafts(JSON.parse(raw));
          } catch {
            setDrafts({});
          }
        }
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
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    const subscription = AppState.addEventListener('change', tick);
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  const persist = (next: Record<string, SessionDraft>) => {
    if (key) {
      writeQueue.current = writeQueue.current
        .catch(() => {})
        .then(() => AsyncStorage.setItem(key, JSON.stringify(next)));
    }
  };
  const edit = (id: string, draft: SessionDraft) => {
    setDrafts((previous) => {
      const next = { ...previous, [id]: draft };
      persist(next);
      return next;
    });
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
    setRestEnd(end);
    await NotificationService.scheduleRestTimerNotification(seconds);
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
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[id];
        persist(next);
        return next;
      });
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
      setDrafts({});
    });
  return {
    view,
    changeView,
    drafts,
    edit,
    complete,
    skip,
    finish,
    startRest,
    stopRest,
    busy: busy || loadedKey !== key,
    error,
    defaultRest: options.defaultRest,
    restSeconds: restEnd ? Math.max(0, Math.ceil((restEnd - now) / 1000)) : 0,
  };
}
