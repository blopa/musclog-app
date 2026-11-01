import type { MealType } from '@/database/models/NutritionLog';
import { formatTimeInTimezone, timeOfDayMsInTimezone } from '@/utils/calendarDate';

import type { MacroTotals, MealGroup, ResolvedLogEntry } from './foodTypes';

const MS_PER_HOUR = 3_600_000;

/** Something the diary draws as one card: a loose log, or a whole grouped meal. */
export type DiaryItem =
  | { kind: 'log'; mealType: MealType; entry: ResolvedLogEntry }
  | { kind: 'group'; mealType: MealType; group: MealGroup };

/** One hourly section of the "group by time" diary. */
export type TimeSection = {
  /** `hour-<0..23>` or `no-time`; stable across renders. */
  key: string;
  /** Wall-clock hour (0-23) in each entry's own recorded timezone, or `null` for "No time". */
  hour: number | null;
  items: DiaryItem[];
  totals: MacroTotals;
};

/**
 * The wall-clock time-of-day (ms since local midnight, in the log's own timezone) that decides
 * where a log sits in the time diary. Exactly midnight is read as "no usable time": legacy rows
 * and some imports carry it as a placeholder, and showing them at 00:00 would invent a midnight
 * snack. A genuine 00:00 meal lands in "No time" too, which is rare and honest.
 */
export function usableTimeOfDayMs(log: { date: number; timezone?: string | null }): number | null {
  const timeOfDay = timeOfDayMsInTimezone(log.date, log.timezone);
  return timeOfDay === 0 ? null : timeOfDay;
}

type TimedItem = {
  item: DiaryItem;
  /** Time-of-day used for ordering/bucketing; `null` = no usable time. */
  timeOfDayMs: number | null;
  createdAt: number;
  id: string;
};

/** Resolve the same member for both a group's section and its displayed time. */
function representativeTime(item: DiaryItem) {
  const logs =
    item.kind === 'log' ? [item.entry.log] : item.group.entries.map((entry) => entry.log);
  let log = logs[0];
  let timeOfDayMs = usableTimeOfDayMs(log);

  for (const candidate of logs.slice(1)) {
    const candidateTime = usableTimeOfDayMs(candidate);
    if (candidateTime !== null && (timeOfDayMs === null || candidateTime < timeOfDayMs)) {
      log = candidate;
      timeOfDayMs = candidateTime;
    }
  }

  return { log, timeOfDayMs };
}

/**
 * A group sits at its earliest usable member time (all members of an AI/saved meal normally
 * share one stamp). A group with no usable time at all has no time.
 */
function timedItem(item: DiaryItem): TimedItem {
  const { log, timeOfDayMs } = representativeTime(item);

  return {
    item,
    timeOfDayMs,
    createdAt: log.createdAt ?? 0,
    id: log.id,
  };
}

function itemMacros(item: DiaryItem): MacroTotals {
  if (item.kind === 'group') {
    return item.group.totalNutrients;
  }

  const { calories, protein, carbs, fat } = item.entry.nutrients;
  return { calories, protein, carbs, fat };
}

/**
 * Buckets the day's cards into hourly sections in the order they were eaten, with a trailing
 * "No time" section. Display only: it reads `date`/`timezone` and never changes a log's meal
 * type or consumed time. Section totals sum the section's own cards, so the day total across
 * sections equals the day total across meal categories.
 */
export function buildTimeSections(
  ungroupedByType: Record<MealType, ResolvedLogEntry[]>,
  mealGroupsByType: Record<MealType, MealGroup[]>
): TimeSection[] {
  const timed: TimedItem[] = [];

  (Object.keys(mealGroupsByType) as MealType[]).forEach((mealType) => {
    mealGroupsByType[mealType].forEach((group) => {
      timed.push(timedItem({ kind: 'group', mealType, group }));
    });
  });
  (Object.keys(ungroupedByType) as MealType[]).forEach((mealType) => {
    ungroupedByType[mealType].forEach((entry) => {
      timed.push(timedItem({ kind: 'log', mealType, entry }));
    });
  });

  timed.sort((a, b) => {
    if (a.timeOfDayMs !== b.timeOfDayMs) {
      // `null` (no time) is never compared here: those are split out below.
      return (a.timeOfDayMs ?? 0) - (b.timeOfDayMs ?? 0);
    }

    return a.createdAt - b.createdAt || a.id.localeCompare(b.id);
  });

  const sections: TimeSection[] = [];
  const byKey = new Map<string, TimeSection>();
  const noTime: TimedItem[] = [];

  const push = (key: string, hour: number | null, item: DiaryItem) => {
    let section = byKey.get(key);
    if (!section) {
      section = {
        key,
        hour,
        items: [],
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      };
      byKey.set(key, section);
      sections.push(section);
    }

    const macros = itemMacros(item);
    section.items.push(item);
    section.totals = {
      calories: section.totals.calories + macros.calories,
      protein: section.totals.protein + macros.protein,
      carbs: section.totals.carbs + macros.carbs,
      fat: section.totals.fat + macros.fat,
    };
  };

  timed.forEach((entry) => {
    if (entry.timeOfDayMs === null) {
      noTime.push(entry);
      return;
    }

    const hour = Math.min(23, Math.floor(entry.timeOfDayMs / MS_PER_HOUR));
    push(`hour-${hour}`, hour, entry.item);
  });
  noTime.forEach((entry) => push('no-time', null, entry.item));

  return sections;
}

/** Locale-aware label for an hourly section ("2 PM" / "14"), rendered in UTC so it can't shift. */
export function formatHourLabel(hour: number, localeTag: string): string {
  return new Intl.DateTimeFormat(localeTag, { hour: 'numeric', timeZone: 'UTC' }).format(
    Date.UTC(1970, 0, 1, hour)
  );
}

/**
 * Exact time shown on a card in the time diary, in the log's recorded timezone, or `undefined`
 * when the log has no usable time.
 */
export function formatItemTime(item: DiaryItem, localeTag: string): string | undefined {
  const { log, timeOfDayMs } = representativeTime(item);
  if (timeOfDayMs === null) {
    return undefined;
  }

  return formatTimeInTimezone(log.date, log.timezone, localeTag);
}

/** The meal category a new entry starts with when added from the time diary (still editable). */
export function inferMealTypeFromHour(hour: number): MealType {
  if (hour >= 5 && hour < 11) {
    return 'breakfast';
  }

  if (hour >= 11 && hour < 15) {
    return 'lunch';
  }

  if (hour >= 15 && hour < 22) {
    return 'dinner';
  }

  return 'snack';
}
