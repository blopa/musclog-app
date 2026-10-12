import type { EnrichedWorkoutLogSet } from '@/database/services/WorkoutService';
import { type GymSnapshot, isBarLoadedEquipment } from '@/utils/gym';
import { platesPerSide } from '@/utils/plateCalculator';
import {
  parseProgressionRule,
  parseSessionProgressionState,
  type ProgressionRule,
} from '@/utils/progressionRules';
import { parseSetPrescription, type SetPrescription } from '@/utils/setPrescription';
import { isWarmupSet } from '@/utils/workoutSetCompletion';

/** How a target came about, as the badge beside it names it. */
export type GuidanceState = 'rule' | 'suggested' | 'learning' | 'attention';

/** Whole translation keys (never completed at the call site — see `check-translations`). */
export const GUIDANCE_STATE_KEYS = {
  rule: 'progression.states.rule',
  suggested: 'progression.states.suggested',
  learning: 'progression.states.learning',
  attention: 'progression.states.attention',
} as const satisfies Record<GuidanceState, string>;

export const PROGRESSION_METHOD_KEYS = {
  automatic: 'progression.methods.automatic',
  double_progression: 'progression.methods.double_progression',
  linear: 'progression.methods.linear',
  top_set_backoff: 'progression.methods.top_set_backoff',
  percentage: 'progression.methods.percentage',
} as const satisfies Record<ProgressionRule['type'] | 'automatic', string>;

/** A set as the session shows it: its place within its own exercise, not the whole workout. */
export type SessionSetRowModel = {
  set: EnrichedWorkoutLogSet;
  /** 1-based number among the exercise's working sets; null for a warm-up. */
  workingNumber: number | null;
  prescription: SetPrescription | null;
};

export type SessionBlock = {
  logExerciseId: string;
  exerciseId: string;
  rows: SessionSetRowModel[];
  rule: ProgressionRule | null;
  /** The set the user is on in this exercise: its first planned one, else its last. */
  focus: EnrichedWorkoutLogSet;
  doneCount: number;
  workingCount: number;
};

/**
 * Groups a session's sets into exercise blocks in the order they are trained (first set's
 * `set_order`), numbering each exercise's working sets from 1. The live numbering was the
 * workout-wide `set_order`, so the second exercise's first set read "Set 4".
 */
export function buildSessionBlocks(sets: readonly EnrichedWorkoutLogSet[]): SessionBlock[] {
  const byBlock = new Map<string, EnrichedWorkoutLogSet[]>();
  for (const set of [...sets].sort((a, b) => a.setOrder - b.setOrder)) {
    const rows = byBlock.get(set.logExerciseId) ?? [];
    rows.push(set);
    byBlock.set(set.logExerciseId, rows);
  }
  return [...byBlock.entries()].map(([logExerciseId, blockSets]) => {
    let working = 0;
    const rows = blockSets.map((set) => ({
      set,
      workingNumber: isWarmupSet(set) ? null : ++working,
      prescription: parseSetPrescription(set.prescriptionJson),
    }));
    return {
      logExerciseId,
      exerciseId: blockSets[0].exerciseId,
      rows,
      rule: parseProgressionRule(blockSets[0].progressionJson),
      focus: blockSets.find((set) => set.completionStatus === 'planned') ?? blockSets.at(-1)!,
      doneCount: blockSets.filter((set) => set.completionStatus !== 'planned').length,
      workingCount: working,
    };
  });
}

/**
 * Which badge a block's targets carry. "Needs attention" wins when the target cannot be loaded on
 * the active gym's bar; "Learning" means there is not enough history yet to say anything (or a
 * percentage rule still has no training max); otherwise the user's own rule or the app's
 * suggestion.
 */
export function guidanceStateFor(
  block: Pick<SessionBlock, 'rule' | 'rows' | 'focus'>,
  equipment: { equipmentType?: string; gym: GymSnapshot | null }
): GuidanceState {
  if (equipment.gym && isBarLoadedEquipment(equipment.equipmentType) && block.focus.weight > 0) {
    const load = platesPerSide(block.focus.weight, equipment.gym);
    if (load.belowBar || load.remainderKg > 0.05) {
      return 'attention';
    }
  }
  if (block.rule) {
    if (
      block.rule.type === 'percentage' &&
      !parseSessionProgressionState(block.focus.progressionJson)
    ) {
      return 'learning';
    }
    return 'rule';
  }
  return block.rows.some((row) => row.prescription?.previous) ? 'suggested' : 'learning';
}
