import { counterpartAt, type HistorySet, type RuleLoadStep } from '@/utils/progressionRules';
import { sameLoad } from '@/utils/sameLoad';
import type { StartSetAdjustment } from '@/utils/setAdjustment';
import { deloadedLoad } from '@/utils/setProgression';
import { LIGHTER_WEEK_TARGET_RIR, lighterSetCount } from '@/utils/weeklyTrainingRecommendation';

export type WeekOverrideKind = 'repeat' | 'lighter';

export type WeekOverrideSet = { id: string; weight: number; reps: number };

export type WeekOverrideSetChange = {
  setId: string;
  weightKg: number;
  reps: number;
  /** The reps in reserve the planned set aims for; only a lighter week sets one. */
  repsInReserve?: number;
  /** Null when the numbers did not move (a bodyweight lighter week only loses sets). */
  adjustment: StartSetAdjustment | null;
};

export type WeekOverridePlan = {
  changes: WeekOverrideSetChange[];
  /** Trailing planned working sets a lighter week removes. */
  dropSetIds: string[];
  /** Working sets left after the change, recorded so a partial block never implies full success. */
  workingSetCount: number;
};

/**
 * What a Weekly Review decision of "repeat" or "lighter" does to one exercise's planned working
 * sets. Pure, so the arithmetic is testable without a database.
 *
 * - `repeat`: every set takes the weight and reps of its counterpart last time, so the week starts
 *   where the last one ended. No history means nothing to repeat and the plan stands.
 * - `lighter`: every set takes `deloadedLoad` of last time's load (the app's one deload
 *   definition), keeps the plan's reps, and aims for plenty in reserve; the trailing third of the
 *   working sets is dropped.
 *
 * `last` is the previous session's performed working sets. A lighter week with no history still
 * lightens the plan's own loads; its explanation then restates the plan as "last time" because the
 * stored shape needs one, and the wording for a review-sourced adjustment never claims otherwise.
 */
export function planWeekOverride(input: {
  kind: WeekOverrideKind;
  planned: readonly WeekOverrideSet[];
  last: readonly HistorySet[];
  step: RuleLoadStep;
}): WeekOverridePlan {
  const { kind, planned, last, step } = input;
  const keep = kind === 'lighter' ? lighterSetCount(planned.length) : planned.length;
  const changes: WeekOverrideSetChange[] = [];
  for (const [index, set] of planned.slice(0, keep).entries()) {
    const before = counterpartAt(last, index);
    if (kind === 'repeat' && !before) {
      continue;
    }
    const baseWeight = before?.weightKg ?? set.weight;
    let weightKg = baseWeight;
    if (kind === 'lighter') {
      weightKg = baseWeight > 0 ? deloadedLoad(baseWeight, step) : 0;
    }
    const reps = kind === 'lighter' ? set.reps : (before?.reps ?? set.reps);
    const moved = !sameLoad(weightKg, set.weight) || reps !== set.reps;
    changes.push({
      setId: set.id,
      weightKg,
      reps,
      repsInReserve: kind === 'lighter' ? LIGHTER_WEEK_TARGET_RIR : undefined,
      adjustment: moved
        ? {
            cause: kind === 'lighter' ? 'deload' : 'repeat',
            field: sameLoad(weightKg, set.weight) ? 'reps' : 'weight',
            from: sameLoad(weightKg, set.weight) ? set.reps : set.weight,
            to: sameLoad(weightKg, set.weight) ? reps : weightKg,
            plan: { weightKg: set.weight, reps: set.reps },
            last: {
              weightKg: before?.weightKg ?? set.weight,
              reps: before?.reps ?? set.reps,
              averageRepsInReserve: before?.repsInReserve ?? 0,
            },
            now: { weightKg, reps },
            source: 'weekly_review',
          }
        : null,
    });
  }
  return {
    changes,
    dropSetIds: planned.slice(keep).map((set) => set.id),
    workingSetCount: keep,
  };
}
