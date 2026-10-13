import { useEffect, useMemo, useState } from 'react';

import { UserMetricService } from '@/database/services/UserMetricService';
import { WorkoutService } from '@/database/services/WorkoutService';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { localDayStartFromUtcMs, MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import {
  computeInsights,
  type Insight,
  type MoodPoint,
  type WorkoutPoint,
} from '@/utils/cycle/cycleInsights';

const LOOKBACK_DAYS = 400;

export interface InsightSessions {
  [workoutId: string]: { name: string; date: number };
}

/**
 * Personal observations from the person's own cycle log, mood and workouts. Mood and workouts are
 * read once per change to the cycle history; the observations themselves are pure.
 */
export function useCycleInsights(): { insights: Insight[]; sessions: InsightSessions } {
  const { periods, history, dayLogs, nowMs, isActive } = useMenstrualCycle();
  const [moods, setMoods] = useState<MoodPoint[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutPoint[]>([]);
  const [sessions, setSessions] = useState<InsightSessions>({});

  const periodCount = periods.length;
  useEffect(() => {
    if (!isActive || periodCount < 3) {
      return;
    }

    let cancelled = false;
    const range = { startDate: nowMs - LOOKBACK_DAYS * MS_PER_SOLAR_DAY, endDate: nowMs };
    void (async () => {
      const [moodMetrics, logs] = await Promise.all([
        UserMetricService.getMetricsHistory('mood', range),
        WorkoutService.getWorkoutHistory(range),
      ]);
      const moodPoints = await Promise.all(
        moodMetrics.map(async (m) => ({
          date: localDayStartFromUtcMs(m.date),
          value: (await m.getDecrypted()).value,
        }))
      );
      if (cancelled) {
        return;
      }

      setMoods(moodPoints);
      setWorkouts(
        logs
          .filter((l) => (l.totalVolume ?? 0) > 0)
          .map((l) => ({
            id: l.id,
            date: localDayStartFromUtcMs(l.startedAt),
            volume: l.totalVolume ?? 0,
          }))
      );
      setSessions(
        Object.fromEntries(
          logs.map((l) => [
            l.id,
            { name: l.workoutName, date: localDayStartFromUtcMs(l.startedAt) },
          ])
        )
      );
    })().catch(() => undefined);

    return () => {
      cancelled = true;
    };
    // Re-read when a period is logged, not on the minute tick.
  }, [isActive, periodCount]);

  const insights = useMemo(
    () => (isActive ? computeInsights({ periods, history, dayLogs, moods, workouts }) : []),
    [isActive, periods, history, dayLogs, moods, workouts]
  );

  return { insights, sessions };
}
