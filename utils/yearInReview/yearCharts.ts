import { type ActivityHeatmapLevel, activityLevel } from '@/utils/activityHeatmap';
import { WORKOUT_HEATMAP_MAX_VALUE } from '@/utils/activityHeatmapData';
import type { YearInReview } from '@/utils/yearInReview/types';

/**
 * What the story's charts draw, read from the review's `workoutDays` so a chart can never disagree
 * with the figure beside it. Days are `yyyy-MM-dd` strings and all arithmetic is on UTC day numbers,
 * so no DST change can move a square.
 */

type WorkoutDays = YearInReview['workoutDays'];

const DAY_MS = 86_400_000;
const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;

/** 0 = Monday ... 6 = Sunday. */
function mondayFirstWeekday(dayNumber: number): number {
  return (new Date(dayNumber * DAY_MS).getUTCDay() + 6) % DAYS_PER_WEEK;
}

function dayNumberOf(year: number, month: number, day: number): number {
  return Math.round(Date.UTC(year, month, day) / DAY_MS);
}

function dayNumberOfKey(key: string): number {
  const [year, month, day] = key.split('-').map(Number);
  return dayNumberOf(year, month - 1, day);
}

/** Sessions in each month, January first. */
export function monthlySessions(workoutDays: WorkoutDays): number[] {
  const counts = new Array<number>(MONTHS_PER_YEAR).fill(0);
  for (const { day, value } of workoutDays) {
    counts[Number(day.slice(5, 7)) - 1] += value;
  }

  return counts;
}

export type YearWeekCell = 'empty' | 'trained' | 'longestRun';

/**
 * One cell per Monday-first week touching the year, January first, marking the weeks with a workout
 * and the longest unbroken run of them. Of two equally long runs the earlier is marked, and a week
 * straddling New Year counts only the sessions of this year, as the streak figure does.
 */
export function yearWeekStrip(year: number, workoutDays: WorkoutDays): YearWeekCell[] {
  const firstDay = dayNumberOf(year, 0, 1);
  const lastDay = dayNumberOf(year, 11, 31);
  const firstMonday = firstDay - mondayFirstWeekday(firstDay);
  const weekCount = Math.floor((lastDay - firstMonday) / DAYS_PER_WEEK) + 1;

  const cells = new Array<YearWeekCell>(weekCount).fill('empty');
  for (const { day } of workoutDays) {
    const index = Math.floor((dayNumberOfKey(day) - firstMonday) / DAYS_PER_WEEK);
    if (index >= 0 && index < weekCount) {
      cells[index] = 'trained';
    }
  }

  let bestStart = -1;
  let bestLength = 0;
  let runStart = -1;
  for (let index = 0; index <= weekCount; index++) {
    if (cells[index] === 'trained') {
      runStart = runStart === -1 ? index : runStart;
    } else if (runStart !== -1) {
      if (index - runStart > bestLength) {
        bestStart = runStart;
        bestLength = index - runStart;
      }

      runStart = -1;
    }
  }

  for (let index = bestStart; index >= 0 && index < bestStart + bestLength; index++) {
    cells[index] = 'longestRun';
  }

  return cells;
}

export type YearCalendarMonth = {
  /** 0-11. */
  month: number;
  /** Empty cells before the 1st in a Monday-first row. */
  leadingBlanks: number;
  /** One level per day of the month, on the same scale as the Home heatmap. */
  levels: ActivityHeatmapLevel[];
};

/** Twelve small month grids, so a whole year fits one screen without scrolling. */
export function yearCalendarMonths(year: number, workoutDays: WorkoutDays): YearCalendarMonth[] {
  const byDay = new Map(workoutDays.map(({ day, value }) => [day, value]));

  return Array.from({ length: MONTHS_PER_YEAR }, (_, month) => {
    const firstDay = dayNumberOf(year, month, 1);
    const dayCount = dayNumberOf(year, month + 1, 1) - firstDay;
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

    return {
      month,
      leadingBlanks: mondayFirstWeekday(firstDay),
      levels: Array.from({ length: dayCount }, (__, index) => {
        const value = byDay.get(`${monthKey}-${String(index + 1).padStart(2, '0')}`) ?? 0;
        return activityLevel(value, WORKOUT_HEATMAP_MAX_VALUE);
      }),
    };
  });
}
