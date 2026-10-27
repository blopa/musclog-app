import { Q } from '@nozbe/watermelondb';
import { useEffect, useMemo, useState } from 'react';

import { COMEBACK_STATE_SETTING_TYPE } from '@/constants/settings';
import { database } from '@/database/database-instance';
import type Setting from '@/database/models/Setting';
import { useLocalToday } from '@/hooks/useLocalToday';
import {
  type ComebackPhase,
  comebackPhase,
  comebackWeek,
  COMEBACK_RAMP_WEEKS,
  currentWorkoutRamp,
  type WorkoutRamp,
} from '@/utils/comeback/comebackProgram';
import { type ComebackState, parseComebackState } from '@/utils/comeback/comebackState';

export type UseComebackStateResult = {
  state: ComebackState;
  /** Derived from the dates, never stored: a restored backup cannot read "week 14 of 4". */
  phase: ComebackPhase;
  /** 1-based week of the ramp after any held weeks; null before a comeback starts. */
  week: number | null;
  rampWeeks: number;
  ramp: WorkoutRamp | null;
  today: number;
  isLoading: boolean;
};

/**
 * Comeback mode's state, observed from its single settings row. It is NOT part of `useSettings()`:
 * its lists grow with use ("I did my minimum today"), and a field on `SettingsState` would re-render
 * every settings consumer on each tap.
 */
export function useComebackState(): UseComebackStateResult {
  const today = useLocalToday();
  const [raw, setRaw] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // observeWithColumns: the row is updated in place on every write, which plain observe() ignores.
    const subscription = database
      .get<Setting>('settings')
      .query(Q.where('type', COMEBACK_STATE_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)))
      .observeWithColumns(['value'])
      .subscribe({
        next: (rows) => {
          const newest = rows.reduce<Setting | null>(
            (latest, row) => (latest === null || row.updatedAt > latest.updatedAt ? row : latest),
            null
          );
          setRaw(newest?.value ?? null);
          setIsLoading(false);
        },
        error: (error: Error) => {
          console.error('Error observing comeback state:', error);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  const state = useMemo(() => parseComebackState(raw), [raw]);

  return useMemo(
    () => ({
      state,
      phase: comebackPhase(state, today),
      week: comebackWeek(state, today),
      rampWeeks: COMEBACK_RAMP_WEEKS,
      ramp: currentWorkoutRamp(state, today),
      today,
      isLoading,
    }),
    [state, today, isLoading]
  );
}
