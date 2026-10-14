import { useEffect, useMemo, useState } from 'react';

import { WorkoutService } from '@/database/services/WorkoutService';
import { useCycleMoods } from '@/hooks/useCycleMoods';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { localDayStartFromUtcMs, MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import { computeInsights, type Insight, type WorkoutPoint } from '@/utils/cycle/cycleInsights';

const LOOKBACK_DAYS = 400;

export interface InsightSessions {
  [workoutId: string]: { name: string; date: number };
}

/**
 * Personal observations from the person's own cycle log, mood and workouts. Mood is observed live; workouts are
 * read when the day or period count changes; the observations themselves are pure.
 */
export function useCycleInsights(): { insights: Insight[]; sessions: InsightSessions } {
  const { periods, history, dayLogs, nowMs, isActive } = useMenstrualCycle();
  const { moods } = useCycleMoods(isActive);
  const [workouts, setWorkouts] = useState<WorkoutPoint[]>([]);
  const [sessions, setSessions] = useState<InsightSessions>({});

  const periodCount = periods.length;
  const today = localDayStartFromUtcMs(nowMs);
  useEffect(() => {
    if (!isActive || periodCount < 3) {
      return;
    }

    let cancelled = false;
    const range = {
      startDate: today - LOOKBACK_DAYS * MS_PER_SOLAR_DAY,
      endDate: today + MS_PER_SOLAR_DAY - 1,
    };
    void (async () => {
      const logs = await WorkoutService.getWorkoutHistory(range);
      if (cancelled) {
        return;
      }

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
    // Re-read on a new day or period, not on the minute tick.
  }, [isActive, periodCount, today]);

  const insights = useMemo(
    () =>
      isActive
        ? computeInsights({
            periods,
            history,
            dayLogs: dayLogs.filter((d) => d.date <= nowMs),
            moods: moods.filter((m) => m.date <= nowMs),
            workouts,
          })
        : [],
    [isActive, periods, history, dayLogs, moods, workouts, nowMs]
  );

  return { insights, sessions };
}
