import { useEffect, useMemo, useState } from 'react';

import { TrainingWeekRepository } from '@/database/repositories/TrainingWeekRepository';
import { WorkoutService } from '@/database/services/WorkoutService';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { localDayStartFromUtcMs, MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import { computeInsights, type Insight, type WorkoutPoint } from '@/utils/cycle/cycleInsights';

const LOOKBACK_DAYS = 400;

export interface InsightSessions {
  [workoutId: string]: { name: string; date: number };
}

/**
 * Personal observations from the person's own cycle log, mood and workouts. Workouts are read when
 * the day or period count changes, without the sessions of a deliberately lighter week (a Weekly
 * Review deload), which would otherwise read as "lower volume near your period"; the observations
 * themselves are pure.
 */
export function useCycleInsights(): { insights: Insight[]; sessions: InsightSessions } {
  const { periods, history, dayLogs, moods, today, isActive } = useMenstrualCycle();
  const [workouts, setWorkouts] = useState<WorkoutPoint[]>([]);
  const [sessions, setSessions] = useState<InsightSessions>({});

  const periodCount = periods.length;
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
      const [logs, lighter] = await Promise.all([
        WorkoutService.getWorkoutHistory(range),
        TrainingWeekRepository.lighterWeekWindows().catch(() => []),
      ]);
      if (cancelled) {
        return;
      }

      const inLighterWeek = (at: number) => lighter.some((w) => at >= w.from && at < w.until);
      setWorkouts(
        logs
          .filter((l) => (l.totalVolume ?? 0) > 0 && !inLighterWeek(l.startedAt))
          .map((l) => ({
            id: l.id,
            date: localDayStartFromUtcMs(l.startedAt),
            volume: l.totalVolume ?? 0,
            workoutKey: l.templateId ?? l.workoutName,
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
  }, [isActive, periodCount, today]);

  const insights = useMemo(
    () =>
      isActive
        ? computeInsights({
            periods,
            history,
            dayLogs: dayLogs.filter((d) => d.date <= today),
            moods: moods.filter((m) => m.date <= today),
            workouts,
          })
        : [],
    [isActive, periods, history, dayLogs, moods, workouts, today]
  );

  return { insights, sessions };
}
