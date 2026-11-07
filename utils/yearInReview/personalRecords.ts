import { calculateSetVolume } from '@/utils/workoutCalculator';
import type { YearPersonalRecordInput } from '@/utils/yearInReview/types';

/** One completed session's working sets, in the form the record rule needs. */
export interface PersonalRecordSession {
  /** Ms since epoch; the session's completion, or its start when it has none. */
  achievedAt: number;
  sets: PersonalRecordSet[];
}

export interface PersonalRecordSet {
  exerciseId: string;
  equipmentType: string | undefined;
  weightKg: number;
  reps: number;
  repsInReserve: number | undefined;
}

/**
 * A personal record is a session whose best set on an exercise beats every earlier session's best
 * on that exercise. This is the rule `WorkoutAnalytics.detectPersonalRecords` applies, with the same
 * per-set volume. The first session an exercise appears in is never a record, and a tie is not one.
 *
 * Body weight is not added to bodyweight movements here: the loader must not decrypt the weight log
 * for every session. Bodyweight exercises are therefore ranked by the load logged, and a year-end
 * record can differ from the in-session banner for those movements.
 *
 * Sessions are walked once, in time order, so the whole history is a single pass.
 */
export function findPersonalRecords(
  sessions: readonly PersonalRecordSession[]
): YearPersonalRecordInput[] {
  const ordered = [...sessions].sort((a, b) => a.achievedAt - b.achievedAt);
  const bestSoFar = new Map<string, number>();
  const records: YearPersonalRecordInput[] = [];

  for (const session of ordered) {
    const sessionBest = new Map<string, number>();
    for (const set of session.sets) {
      // A timed set (reps 0) has no rep count to rank, matching WorkoutAnalytics and bestEstimated1RmKg.
      if (set.reps <= 0) {
        continue;
      }

      const volume = calculateSetVolume(
        set.weightKg,
        set.reps,
        set.repsInReserve,
        set.equipmentType,
        0
      );
      sessionBest.set(
        set.exerciseId,
        Math.max(sessionBest.get(set.exerciseId) ?? -Infinity, volume)
      );
    }

    for (const [exerciseId, volume] of sessionBest) {
      const previous = bestSoFar.get(exerciseId);
      if (previous !== undefined && volume > previous) {
        records.push({ exerciseId, achievedAt: session.achievedAt });
      }

      bestSoFar.set(exerciseId, Math.max(previous ?? -Infinity, volume));
    }
  }

  return records;
}

/** Records achieved in `year` (device calendar), counted over the whole history. */
export function countYearPersonalRecords(
  sessions: readonly PersonalRecordSession[],
  year: number
): number {
  return findPersonalRecords(sessions).filter(
    (record) => new Date(record.achievedAt).getFullYear() === year
  ).length;
}
