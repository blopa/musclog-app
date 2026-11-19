import { parseWorkoutImport } from '@/utils/workoutImport/sessions';
import type { ImportWeightUnit } from '@/utils/workoutImport/types';

/** Largest CSV the page reads, in characters: far above any hand-kept log, below a stuck tab. */
export const MAX_CHECK_CHARS = 2_000_000;

export interface LogDownload {
  key: 'pdfA4' | 'pdfLetter' | 'xlsx' | 'csv';
  /** The file in `public/downloads/`, written by `npm run generate-workout-log`. */
  file: string;
  kind: 'pdf' | 'sheet';
}

/** The files the page offers. `scripts/generate-workout-log.js` writes exactly these names. */
export const LOG_DOWNLOADS: readonly LogDownload[] = [
  { key: 'pdfA4', file: 'musclog-workout-log-a4.pdf', kind: 'pdf' },
  { key: 'pdfLetter', file: 'musclog-workout-log-letter.pdf', kind: 'pdf' },
  { key: 'xlsx', file: 'musclog-workout-log.xlsx', kind: 'sheet' },
  { key: 'csv', file: 'musclog-workout-log.csv', kind: 'sheet' },
];

export type LogCheck =
  | { ok: true; workouts: number; sets: number; skipped: number }
  | { ok: false; problem: 'empty' | 'tooLarge' | 'unreadable' | 'noRows' };

/**
 * What Musclog's own importer would read from a filled-in CSV: the same parser the app runs
 * (`parseWorkoutImport`), so the count here is the count in the app. Nothing is uploaded.
 */
export function checkLogCsv(
  text: string,
  assumedWeightUnit: ImportWeightUnit,
  now: Date
): LogCheck {
  if (text.trim() === '') {
    return { ok: false, problem: 'empty' };
  }

  if (text.length > MAX_CHECK_CHARS) {
    return { ok: false, problem: 'tooLarge' };
  }

  const result = parseWorkoutImport(text, { assumedWeightUnit, now });
  if (!result.ok) {
    return { ok: false, problem: result.failure === 'noRows' ? 'noRows' : 'unreadable' };
  }

  const sets = result.sessions.reduce(
    (total, session) =>
      total + session.exercises.reduce((sum, block) => sum + block.sets.length, 0),
    0
  );

  return { ok: true, workouts: result.sessions.length, sets, skipped: result.skipped.length };
}
