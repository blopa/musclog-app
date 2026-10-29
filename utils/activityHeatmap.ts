import { addDays, startOfDay, startOfWeek, subWeeks } from 'date-fns';

import { formatLocalCalendarDayIso, parseLocalCalendarDate } from '@/utils/calendarDate';
import { weekdayDates } from '@/utils/monthGrid';

/**
 * Pure layout model for the contribution-style activity grid (`ActivityHeatmap`): one column per
 * calendar week, one row per weekday. It knows nothing about React, themes or locales, so the
 * bucketing and the week arithmetic run in the Jest `node` project.
 *
 * Days are identified by their local `yyyy-MM-dd` string, never by a timestamp: the grid is a
 * calendar, and a day key in milliseconds drifts by an hour across a DST change.
 */

/** Number of filled intensity steps. Level 0 is the empty cell, so the legend has this + 1 swatches. */
export const ACTIVITY_HEATMAP_LEVELS = 4;

export const ACTIVITY_HEATMAP_MIN_WEEKS = 1;
export const ACTIVITY_HEATMAP_MAX_WEEKS = 53;

/** Smallest gap between two month labels, in columns; closer ones would overprint each other. */
export const ACTIVITY_HEATMAP_MIN_MONTH_LABEL_SPAN = 3;

export type ActivityHeatmapLevel = 0 | 1 | 2 | 3 | 4;

export type ActivityHeatmapDay = {
  /** Local calendar day, `yyyy-MM-dd`. */
  date: string;
  /** Amount of activity that day (workouts, sets, ...). Negative and non-finite values count as 0. */
  value: number;
};

export type ActivityHeatmapCell = {
  /** `yyyy-MM-dd`, also the cell's stable key. */
  iso: string;
  date: Date;
  value: number;
  level: ActivityHeatmapLevel;
};

export type ActivityHeatmapMonthLabel = {
  /** Index of the column the label sits above. */
  column: number;
  /** First day of that column; the component formats its month with the active locale. */
  date: Date;
};

export type ActivityHeatmapModel = {
  /**
   * `weeks` columns of 7 rows each, rows ordered from `weekStartsOn`. A day after `endDate` is
   * `null`, so the final, partial week keeps its row positions without drawing the future.
   */
  columns: (ActivityHeatmapCell | null)[][];
  monthLabels: ActivityHeatmapMonthLabel[];
  /** One date per row, for formatting the weekday labels. */
  weekdays: Date[];
  /** The value that maps to the top level: `maxValue` when given, else the largest day in range. */
  max: number;
  /** Sum of every day in range. */
  total: number;
  /** Days in range with any activity. */
  activeDays: number;
};

export type BuildActivityHeatmapInput = {
  days: ActivityHeatmapDay[];
  /** Last day shown, normally today. Defaults to today. */
  endDate?: Date;
  /** Columns to draw, clamped to 1-53. Defaults to 26. */
  weeks?: number;
  /** 0 = Sunday, 1 = Monday. Matches the app's date picker, which starts on Sunday. */
  weekStartsOn?: 0 | 1;
  /**
   * The value that earns the top level. Pass it when two grids must share a scale, or to cap an
   * outlier day that would otherwise wash every other day out to level 1.
   */
  maxValue?: number;
};

function sanitizeValue(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Intensity of a day. Any activity at all is at least level 1, so a quiet day never reads as an
 * empty one however large the maximum is; the top level is reached exactly at `max`.
 */
export function activityLevel(value: number, max: number): ActivityHeatmapLevel {
  const safeValue = sanitizeValue(value);
  if (safeValue === 0 || !Number.isFinite(max) || max <= 0) {
    return 0;
  }

  const level = Math.ceil((safeValue / max) * ACTIVITY_HEATMAP_LEVELS);

  return Math.min(ACTIVITY_HEATMAP_LEVELS, Math.max(1, level)) as ActivityHeatmapLevel;
}

function clampWeeks(weeks: number | undefined): number {
  if (weeks == null || !Number.isFinite(weeks)) {
    return 26;
  }

  return Math.min(
    ACTIVITY_HEATMAP_MAX_WEEKS,
    Math.max(ACTIVITY_HEATMAP_MIN_WEEKS, Math.floor(weeks))
  );
}

/**
 * Sums repeated days (two workouts on one day are one busier day) and drops malformed keys,
 * which would otherwise silently land on the wrong day.
 */
function valuesByDay(days: ActivityHeatmapDay[]): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const day of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
      continue;
    }

    const parsed = parseLocalCalendarDate(day.date);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }

    // Normalizes an impossible date such as 2026-02-31 back to a real key before it is used.
    const iso = formatLocalCalendarDayIso(parsed);
    byDay.set(iso, (byDay.get(iso) ?? 0) + sanitizeValue(day.value));
  }

  return byDay;
}

export function buildActivityHeatmap({
  days,
  endDate,
  weeks: requestedWeeks,
  weekStartsOn = 0,
  maxValue,
}: BuildActivityHeatmapInput): ActivityHeatmapModel {
  const weeks = clampWeeks(requestedWeeks);
  const end = startOfDay(endDate ?? new Date());
  const firstWeekStart = subWeeks(startOfWeek(end, { weekStartsOn }), weeks - 1);
  const endIso = formatLocalCalendarDayIso(end);
  const byDay = valuesByDay(days);

  // First pass: the in-range days and their values, so the maximum is known before any level is.
  const grid: ({ iso: string; date: Date; value: number } | null)[][] = [];
  let largest = 0;
  let total = 0;
  let activeDays = 0;
  for (let column = 0; column < weeks; column++) {
    const cells: ({ iso: string; date: Date; value: number } | null)[] = [];
    for (let row = 0; row < 7; row++) {
      const date = addDays(firstWeekStart, column * 7 + row);
      const iso = formatLocalCalendarDayIso(date);
      // `yyyy-MM-dd` strings sort chronologically, which keeps this comparison DST-proof.
      if (iso > endIso) {
        cells.push(null);
        continue;
      }

      const value = byDay.get(iso) ?? 0;
      largest = Math.max(largest, value);
      total += value;
      if (value > 0) {
        activeDays += 1;
      }

      cells.push({ iso, date, value });
    }

    grid.push(cells);
  }

  const max = maxValue != null && Number.isFinite(maxValue) && maxValue > 0 ? maxValue : largest;
  const columns = grid.map((cells) =>
    cells.map((cell) => (cell ? { ...cell, level: activityLevel(cell.value, max) } : null))
  );

  return {
    columns,
    monthLabels: monthLabelsFor(columns),
    weekdays: weekdayDates(end, weekStartsOn),
    max,
    total,
    activeDays,
  };
}

/**
 * A label above each column where the month changes, as GitHub draws it. The first column is
 * always a candidate, but it gives way to the next label when the two would overprint.
 */
function monthLabelsFor(columns: (ActivityHeatmapCell | null)[][]): ActivityHeatmapMonthLabel[] {
  const labels: ActivityHeatmapMonthLabel[] = [];
  let previousMonth = -1;
  columns.forEach((cells, column) => {
    const first = cells.find((cell): cell is ActivityHeatmapCell => cell != null);
    if (!first) {
      return;
    }

    const month = first.date.getMonth();
    if (month !== previousMonth) {
      labels.push({ column, date: first.date });
      previousMonth = month;
    }
  });

  if (
    labels.length > 1 &&
    labels[1].column - labels[0].column < ACTIVITY_HEATMAP_MIN_MONTH_LABEL_SPAN
  ) {
    labels.shift();
  }

  return labels;
}
