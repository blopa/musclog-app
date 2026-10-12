import type { PersonalRecord } from '@/database/services/WorkoutAnalytics';

/** Most to least meaningful to a lifter; a row leads with the first of these it earned. */
const TYPE_ORDER: PersonalRecord['type'][] = ['weight', 'reps', 'volume'];

export type WeeklyRecordRow = {
  exerciseId: string;
  exerciseName: string;
  /** Every kind of record the exercise set this week, in {@link TYPE_ORDER}. */
  types: PersonalRecord['type'][];
  /** The set that earned the leading record: the heaviest, then the most reps. */
  best: PersonalRecord['newRecord'];
};

/**
 * One row per exercise for the review's record list. A heavier top set is usually a weight PR AND
 * a volume PR, and an exercise trained twice in the week can set records in both sessions, so the
 * raw list repeated nearly every exercise — fifteen rows for a three-workout week.
 */
export function summarizeWeeklyRecords(records: PersonalRecord[]): WeeklyRecordRow[] {
  const rows = new Map<string, WeeklyRecordRow>();
  for (const record of records) {
    const row = rows.get(record.exerciseId);
    if (!row) {
      rows.set(record.exerciseId, {
        exerciseId: record.exerciseId,
        exerciseName: record.exerciseName,
        types: [record.type],
        best: record.newRecord,
      });
      continue;
    }
    if (!row.types.includes(record.type)) {
      row.types.push(record.type);
    }
    const better =
      record.newRecord.weight > row.best.weight ||
      (record.newRecord.weight === row.best.weight && record.newRecord.reps > row.best.reps);
    if (better) {
      row.best = record.newRecord;
    }
  }
  return [...rows.values()].map((row) => ({
    ...row,
    types: TYPE_ORDER.filter((type) => row.types.includes(type)),
  }));
}
