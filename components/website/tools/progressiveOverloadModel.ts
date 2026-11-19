import type { ProgressionMode, Units } from '@/constants/settings';
import { defaultGymSnapshot, type GymSnapshot } from '@/utils/gym';
import { loadStepFor } from '@/utils/loadIncrement';
import { DEFAULT_TARGET_REPS_IN_RESERVE } from '@/utils/setAdjustment';
import { computeStartTarget, loadStepIsUsable } from '@/utils/setProgression';
import { displayToKg, kgToDisplay } from '@/utils/unitConversion';

import { type PlateLine, solvePlateLoad } from './plateCalculatorModel';
import { isInRange, isWholeInRange, parseToolNumber } from './toolNumbers';
import {
  MAX_WORKING_WEIGHT,
  WARMUP_EQUIPMENT_TYPE,
  type WarmupEquipment,
} from './warmUpCalculatorModel';

export type OverloadEquipment = WarmupEquipment;
export const OVERLOAD_EQUIPMENT: readonly OverloadEquipment[] = ['barbell', 'dumbbell', 'machine'];

export const OVERLOAD_PROGRESSION_MODES: readonly ProgressionMode[] = [
  'weight_first',
  'reps_first',
];

/** The most reps the page takes for a set: past this the number measures endurance, not load. */
export const MAX_OVERLOAD_REPS = 50;
/** The most planned reps per set the page takes. */
export const MAX_PLANNED_REPS = 30;
/** Reps in reserve the app accepts on a set (0 to 9). */
export const MAX_OVERLOAD_RESERVE = 9;
/** The reps in reserve a session has to leave for the app to call it a success. */
export const SUCCESS_REPS_IN_RESERVE = DEFAULT_TARGET_REPS_IN_RESERVE;

export interface OverloadInput {
  /** Last session's working weight, in the visitor's unit. */
  weight: number;
  /** Reps in the weakest working set of that session. */
  reps: number;
  /** The reps the plan asks for on every set. */
  plannedReps: number;
  /** Average reps in reserve over the working sets; `null` when effort was not rated. */
  repsInReserve: number | null;
  /** Every prescribed working set was done. */
  complete: boolean;
  /** The session before it also failed or missed reps at this same weight. */
  twoInARow: boolean;
}

export type OverloadProblem = 'weight' | 'reps' | 'plannedReps' | 'reserve';

export type OverloadValidation =
  { ok: true; input: OverloadInput } | { ok: false; problem: OverloadProblem | null };

/**
 * Reads the form. `problem: null` means a required field is still empty (no message wanted); a
 * named problem is a field that has text but cannot be used. An empty reps-in-reserve field is a
 * session whose effort was never rated, which the app also handles (it judges by reps alone).
 */
export function validateOverloadInput(
  fields: {
    weight: string;
    reps: string;
    plannedReps: string;
    reserve: string;
    complete: boolean;
    twoInARow: boolean;
  },
  units: Units
): OverloadValidation {
  if (
    fields.weight.trim() === '' ||
    fields.reps.trim() === '' ||
    fields.plannedReps.trim() === ''
  ) {
    return { ok: false, problem: null };
  }

  const weight = parseToolNumber(fields.weight);
  const reps = parseToolNumber(fields.reps);
  const plannedReps = parseToolNumber(fields.plannedReps);
  const reserve = fields.reserve.trim() === '' ? null : parseToolNumber(fields.reserve);

  if (!isInRange(weight, 0.01, MAX_WORKING_WEIGHT[units])) {
    return { ok: false, problem: 'weight' };
  }

  if (!isWholeInRange(reps, 1, MAX_OVERLOAD_REPS)) {
    return { ok: false, problem: 'reps' };
  }

  if (!isWholeInRange(plannedReps, 1, MAX_PLANNED_REPS)) {
    return { ok: false, problem: 'plannedReps' };
  }

  if (fields.reserve.trim() !== '' && !isInRange(reserve, 0, MAX_OVERLOAD_RESERVE)) {
    return { ok: false, problem: 'reserve' };
  }

  return {
    ok: true,
    input: {
      weight,
      reps,
      plannedReps,
      repsInReserve: reserve,
      complete: fields.complete,
      twoInARow: fields.twoInARow,
    },
  };
}

/** What the app decided, as the page words it. */
export type OverloadKind = 'progression' | 'repeat' | 'deload';

/** Why, so the page can say it in a sentence. */
export type OverloadReason =
  /** Reps in reserve and planned reps both met: the load or the reps go up. */
  | 'addWeight'
  | 'addReps'
  /** Weight-first, but one step is too big a share of this load, so reps climb instead. */
  | 'stepTooCoarse'
  /** The session was not finished, so it does not count as a success. */
  | 'unfinished'
  /** The planned reps were missed once. */
  | 'missedPlan'
  /** The reps came, but with less than the success reserve left. */
  | 'tooHard'
  /** Two failed sessions at this weight in a row. */
  | 'deload';

export interface OverloadPlan {
  kind: OverloadKind;
  reason: OverloadReason;
  /** Next session's weight, in the visitor's unit, to a tenth. */
  weight: number;
  /** The same weight in kilograms, as the app stores it. */
  weightKg: number;
  reps: number;
  /** `weight` minus last session's, in the visitor's unit. */
  change: number;
  /** The change as a share of last session's weight, to a tenth of a percent. */
  changePercent: number;
  /** One load step for this equipment, in the visitor's unit. */
  step: number;
  /** Plates on each side of the bar; `null` when the equipment is not bar-loaded. */
  perSide: PlateLine[] | null;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * What to do next session, from the app's own start-of-workout rule (`computeStartTarget`), with the
 * load step and rounding of the gym (`loadStepFor`). The page adds only the wording of the reason.
 */
export function planOverload(
  input: OverloadInput,
  options: {
    units: Units;
    equipment: OverloadEquipment;
    mode: ProgressionMode;
    /** The visitor's gym; used for a barbell only. */
    gym: GymSnapshot | null;
  }
): OverloadPlan {
  const { units, equipment, mode } = options;
  const barLoaded = equipment === 'barbell';
  const gym = barLoaded ? options.gym : null;
  const equipmentType = WARMUP_EQUIPMENT_TYPE[equipment];
  const { incrementKg, roundLoad } = loadStepFor(equipmentType, gym, units);
  const lastKg = displayToKg(input.weight, units);
  const rated = input.repsInReserve !== null;

  const target = computeStartTarget({
    last: {
      weightKg: lastKg,
      reps: input.reps,
      lowestReps: input.reps,
      complete: input.complete,
      averageRepsInReserve: input.repsInReserve ?? 0,
      rirRecorded: rated,
    },
    failedBefore: input.twoInARow,
    missedPlanBefore: input.twoInARow,
    planReps: input.plannedReps,
    progressionMode: mode,
    isCompound: true,
    incrementKg,
    roundLoad,
  });

  const weight = round1(kgToDisplay(target.weightKg, units));
  const loadWentUp = target.weightKg > lastKg;
  let reason: OverloadReason;
  if (target.kind === 'deload') {
    reason = 'deload';
  } else if (target.kind === 'progression') {
    if (loadWentUp) {
      reason = 'addWeight';
    } else {
      reason =
        mode === 'weight_first' && !loadStepIsUsable(lastKg, incrementKg)
          ? 'stepTooCoarse'
          : 'addReps';
    }
  } else if (!input.complete) {
    reason = 'unfinished';
  } else if (input.reps < input.plannedReps) {
    reason = 'missedPlan';
  } else {
    reason = 'tooHard';
  }

  const loadingGym = gym ?? defaultGymSnapshot(units);
  const change = round1(weight - input.weight);

  return {
    kind: target.kind,
    reason,
    weight,
    weightKg: target.weightKg,
    reps: target.reps,
    change,
    changePercent: round1((change / input.weight) * 100),
    step: round1(kgToDisplay(incrementKg, units)),
    perSide: barLoaded ? solvePlateLoad(weight, units, loadingGym).perSide : null,
  };
}
