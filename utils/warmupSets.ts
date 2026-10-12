import type { Units } from '@/constants/settings';
import type { EquipmentType } from '@/database/models/Exercise';

import {
  defaultBarWeightKg,
  defaultPlates,
  defaultWeightIncrementKg,
  type GymSnapshot,
  isBarLoadedEquipment,
} from './gym';
import { roundToLoadable } from './plateCalculator';
import {
  isPerformedWorkoutSet,
  isPlannedWorkoutSet,
  isWarmupSet,
  type WorkoutSetCompletionState,
  type WorkoutSetTypeState,
} from './workoutSetCompletion';

export interface WarmupSetPrescription {
  weightKg: number;
  reps: number;
}

/**
 * The ramp: a share of the working load for a handful of reps, each set lighter and longer than the
 * one after it so the lifter arrives at the working weight warm without being tired. Three steps is
 * the common prescription; two for a lighter lift is handled by the de-duplication below.
 */
export const WARMUP_RAMP: readonly { fraction: number; reps: number }[] = [
  { fraction: 0.4, reps: 5 },
  { fraction: 0.6, reps: 3 },
  { fraction: 0.8, reps: 2 },
];

/** A warm-up this close to the working weight is not a warm-up, it is the first working set. */
const MAX_WARMUP_FRACTION_OF_WORKING = 0.9;
/** Rest after a warm-up set. Shorter than between working sets: nothing here needs recovering from. */
export const WARMUP_REST_SECONDS = 45;

interface WarmupOptions {
  gym: GymSnapshot | null;
  equipmentType: EquipmentType | string | undefined;
  units: Units;
}

/**
 * Warm-up sets for a working weight, lightest first. Empty when there is nothing sensible to ramp:
 * a bodyweight or unloaded exercise, or a bar-loaded lift whose working weight is little more than
 * the empty bar (the bar IS the warm-up).
 *
 * Every weight is snapped to something the equipment can really be set to (`roundToLoadable`), and
 * a bar-loaded lift never goes below the empty bar. Duplicates created by that snapping, and
 * anything too close to the working weight to be worth doing, are dropped — so a light lift gets two
 * sets rather than three identical-looking ones.
 */
export function buildWarmupSets(
  workingKg: number,
  { gym, equipmentType, units }: WarmupOptions
): WarmupSetPrescription[] {
  if (!Number.isFinite(workingKg) || workingKg <= 0 || equipmentType === 'bodyweight') {
    return [];
  }

  const barLoaded = isBarLoadedEquipment(equipmentType);
  const barKg = barLoaded ? (gym?.barWeightKg ?? defaultBarWeightKg(units)) : 0;
  // Without a gym the standard plates and the default step apply, so a user who never described
  // their gym still gets weights that can be loaded.
  const loadingGym: GymSnapshot = gym ?? {
    id: 'default',
    name: 'default',
    barWeightKg: defaultBarWeightKg(units),
    plates: defaultPlates(units),
    weightIncrementKg: defaultWeightIncrementKg(units),
    equipment: [],
  };
  const floorKg = barLoaded ? barKg : loadingGym.weightIncrementKg;

  // The bar alone is the warm-up when the working weight barely exceeds it.
  if (barLoaded && workingKg <= barKg * 1.15) {
    return [];
  }

  const seen = new Set<number>();
  const sets: WarmupSetPrescription[] = [];
  for (const { fraction, reps } of WARMUP_RAMP) {
    const snapped = Math.max(
      floorKg,
      roundToLoadable(workingKg * fraction, equipmentType, loadingGym)
    );
    if (snapped >= workingKg * MAX_WARMUP_FRACTION_OF_WORKING || seen.has(snapped)) {
      continue;
    }
    seen.add(snapped);
    sets.push({ weightKg: snapped, reps });
  }

  return sets;
}

type SessionSet = WorkoutSetCompletionState & WorkoutSetTypeState;

export interface WarmupOffer {
  /** The ramp the session offers to insert; empty when there is nothing to offer. */
  toAdd: WarmupSetPrescription[];
  /** True while the exercise still has warm-ups that have not been done, so they can be removed. */
  canRemove: boolean;
}

/**
 * What the live session offers for warm-ups on the exercise in front of the user. A ramp is offered
 * only before its first set — no warm-ups yet, nothing performed, and the current set still to do —
 * so it can never land after work has started. Planned warm-ups stay removable until performed.
 */
export function warmupOfferFor({
  exerciseSets,
  currentSet,
  workingKg,
  ...options
}: WarmupOptions & {
  /** Every set of this exercise in the session, in any state. */
  exerciseSets: readonly SessionSet[];
  currentSet: SessionSet;
  workingKg: number;
}): WarmupOffer {
  const offersRamp =
    !exerciseSets.some(isWarmupSet) &&
    !exerciseSets.some(isPerformedWorkoutSet) &&
    isPlannedWorkoutSet(currentSet);

  return {
    toAdd: offersRamp ? buildWarmupSets(workingKg, options) : [],
    canRemove: exerciseSets.some((set) => isWarmupSet(set) && isPlannedWorkoutSet(set)),
  };
}
