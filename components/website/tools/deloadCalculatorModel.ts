import type { Units } from '@/constants/settings';
import { defaultGymSnapshot, type GymSnapshot } from '@/utils/gym';
import { loadStepFor } from '@/utils/loadIncrement';
import { deloadedLoad, loadBelow } from '@/utils/setProgression';
import { displayToKg, kgToDisplay } from '@/utils/unitConversion';
import { LIGHTER_WEEK_TARGET_RIR, lighterSetCount } from '@/utils/weeklyTrainingRecommendation';

import { type PlateLine, solvePlateLoad } from './plateCalculatorModel';
import { isInRange, isWholeInRange, parseToolNumber } from './toolNumbers';
import {
  MAX_WORKING_WEIGHT,
  WARMUP_EQUIPMENT_TYPE,
  type WarmupEquipment,
} from './warmUpCalculatorModel';

export type DeloadEquipment = WarmupEquipment;
export const DELOAD_EQUIPMENT: readonly DeloadEquipment[] = ['barbell', 'dumbbell', 'machine'];

/** The most working sets of one exercise the page takes. */
export const MAX_DELOAD_SETS = 20;

/** The cuts the comparison table lists besides Musclog's own: common rules of thumb, not study results. */
export const DELOAD_TABLE_CUTS: readonly number[] = [10, 15, 20];

/** The reps in reserve a deload week aims for (the app's lighter week). */
export const DELOAD_TARGET_RIR = LIGHTER_WEEK_TARGET_RIR;

/** How long a deload lasts, in weeks: the app's lighter week and the usual rule of thumb. */
export const DELOAD_WEEKS = 1;

export interface DeloadInput {
  /** The exercise's working weight, in the visitor's unit. */
  weight: number;
  /** Working sets of it in a normal week. */
  sets: number;
}

export type DeloadProblem = 'weight' | 'sets';

export type DeloadValidation =
  { ok: true; input: DeloadInput } | { ok: false; problem: DeloadProblem | null };

/** Reads the two fields. `problem: null` means one is still empty (no message wanted). */
export function validateDeloadInput(
  weightText: string,
  setsText: string,
  units: Units
): DeloadValidation {
  if (weightText.trim() === '' || setsText.trim() === '') {
    return { ok: false, problem: null };
  }

  const weight = parseToolNumber(weightText);
  const sets = parseToolNumber(setsText);
  if (!isInRange(weight, 0.01, MAX_WORKING_WEIGHT[units])) {
    return { ok: false, problem: 'weight' };
  }

  if (!isWholeInRange(sets, 1, MAX_DELOAD_SETS)) {
    return { ok: false, problem: 'sets' };
  }

  return { ok: true, input: { weight, sets } };
}

export interface DeloadLoad {
  /** The share cut, as asked for (10, 15, 20) or the app's own cut (`null`). */
  cutPercent: number | null;
  /** The deload weight, in the visitor's unit, to a tenth. */
  weight: number;
  /** How much lighter than the working weight it really is, to a tenth of a percent. */
  actualCutPercent: number;
  /** Plates on each side of the bar; `null` when the equipment is not bar-loaded. */
  perSide: PlateLine[] | null;
}

export interface DeloadPlan {
  /** The app's own deload: 10% or one load step, whichever is larger, snapped to a lighter load. */
  musclog: DeloadLoad;
  /** The same weight cut by the common rules of thumb, each snapped to a lighter load. */
  table: DeloadLoad[];
  /** False when no lighter load exists (an empty bar, the lightest dumbbell). */
  lighter: boolean;
  /** Working sets to keep, and how many to drop. */
  setsKept: number;
  setsDropped: number;
  /** One load step for this equipment, in the visitor's unit. */
  step: number;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * The deload for one exercise, from the app's own functions: `deloadedLoad` (10% or one step,
 * whichever is larger, snapped DOWN to a load the equipment can set) and `lighterSetCount` (two
 * thirds of the working sets, never fewer than one). The table cuts go through `loadBelow`, the same
 * snap, so a 10% cut of a light dumbbell never rounds back up to the weight it was meant to reduce.
 */
export function planDeload(
  input: DeloadInput,
  options: { units: Units; equipment: DeloadEquipment; gym: GymSnapshot | null }
): DeloadPlan {
  const { units, equipment } = options;
  const barLoaded = equipment === 'barbell';
  const gym = barLoaded ? options.gym : null;
  const loadingGym = gym ?? defaultGymSnapshot(units);
  const step = loadStepFor(WARMUP_EQUIPMENT_TYPE[equipment], gym, units);
  const currentKg = displayToKg(input.weight, units);

  // The app's snap returns 0 when the lightest load the equipment can make is already the current
  // one (a 2.5 kg stack, the empty bar): a deload "to nothing" is no deload, so the weight stays.
  const loadFor = (cutPercent: number | null, snappedKg: number): DeloadLoad => {
    const targetKg = snappedKg > 0 && snappedKg < currentKg ? snappedKg : currentKg;
    const weight = round1(kgToDisplay(targetKg, units));
    return {
      cutPercent,
      weight,
      actualCutPercent: round1(((currentKg - targetKg) / currentKg) * 100),
      perSide: barLoaded ? solvePlateLoad(weight, units, loadingGym).perSide : null,
    };
  };

  const musclogKg = deloadedLoad(currentKg, step);
  const table = DELOAD_TABLE_CUTS.map((cut) =>
    loadFor(
      cut,
      loadBelow(currentKg, currentKg - Math.max(step.incrementKg, (currentKg * cut) / 100), step)
    )
  );
  const setsKept = lighterSetCount(input.sets);

  return {
    musclog: loadFor(null, musclogKg),
    table,
    lighter: musclogKg > 0 && musclogKg < currentKg,
    setsKept,
    setsDropped: input.sets - setsKept,
    step: round1(kgToDisplay(step.incrementKg, units)),
  };
}
