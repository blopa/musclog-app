import {
  COMEBACK_RAMP_WEEKS,
  type WorkoutRamp,
  workoutRamp,
} from '@/utils/comeback/comebackProgram';
import type { ComebackAnswers } from '@/utils/comeback/comebackState';

/** One row of the 4-week table the plan step and the comeback screen show. */
export type PlanWeekRow = {
  week: number;
  /** Workouts that week; null when the person did not say. */
  sessions: number | null;
  /** Working sets per exercise; null = the plan's own count. */
  sets: number | null;
  /** Reps to leave in reserve. */
  rir: number;
  /** Share of the pre-break load. */
  percent: number;
};

export function planWeeks(answers: ComebackAnswers): PlanWeekRow[] {
  const rows: PlanWeekRow[] = [];
  for (let week = 1; week <= COMEBACK_RAMP_WEEKS; week++) {
    const ramp = workoutRamp(answers, week) as WorkoutRamp;
    rows.push({
      week,
      sessions: answers.daysPerWeek ?? null,
      sets: ramp.maxWorkingSets,
      rir: ramp.targetRir,
      percent: Math.round(ramp.loadFactor * 100),
    });
  }

  return rows;
}

/** A long break is worth a line about checking in with a doctor first when anything feels off. */
export function showsLongBreakNote(answers: ComebackAnswers): boolean {
  return answers.breakLength === '3to6m' || answers.breakLength === 'over6m';
}

/** Whether the if-then sentence has what it needs: at least one weekday. */
export function hasIfThenCue(answers: ComebackAnswers): boolean {
  return (answers.weekDays?.length ?? 0) > 0;
}

/** Time-of-day choices offered for the cue (`HH:mm`). */
export const COMEBACK_TIME_CHOICES = ['07:00', '12:00', '18:00', '20:00'] as const;
export const DEFAULT_COMEBACK_TIME = '18:00';
