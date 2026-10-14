import { csvDate } from './cycleCsv';
import type { MoodPoint } from './cycleInsights';
import type { CycleDayLogDto } from './types';

export const SHARING_FIELDS = ['bleeding', 'symptoms', 'pain', 'energy', 'mood', 'note'] as const;
export type SharingField = (typeof SHARING_FIELDS)[number];
/** Deliberately omit settings, fertility, medication, sex, tags, context, and all imported data. */
export function selectedCycleSharing(
  logs: CycleDayLogDto[],
  moods: MoodPoint[],
  fields: SharingField[],
  from: number,
  to: number
): string {
  if (
    !fields.length ||
    fields.some((f) => !SHARING_FIELDS.includes(f)) ||
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    from > to
  ) {
    throw new Error('invalid_sharing_selection');
  }

  const byDate = new Map<number, Record<string, unknown>>();
  for (const log of logs.filter((d) => d.date >= from && d.date <= to)) {
    const day: Record<string, unknown> = {};
    for (const field of fields) {
      if (field !== 'mood') {
        day[field] = log[field];
      }
    }

    if (Object.keys(day).length) {
      byDate.set(log.date, day);
    }
  }

  if (fields.includes('mood')) {
    for (const mood of moods.filter((d) => d.date >= from && d.date <= to)) {
      byDate.set(mood.date, { ...byDate.get(mood.date), mood: mood.value });
    }
  }

  return JSON.stringify(
    {
      format: 'musclog-cycle-selected-sharing',
      version: 1,
      from: csvDate(from),
      to: csvDate(to),
      fields,
      days: [...byDate]
        .sort(([a], [b]) => a - b)
        .map(([date, day]) => ({ date: csvDate(date), ...day })),
    },
    null,
    2
  );
}
