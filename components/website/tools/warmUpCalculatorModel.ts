import type { Units } from '@/constants/settings';
import type { EquipmentType } from '@/database/models/Exercise';
import { defaultGymSnapshot, type GymSnapshot } from '@/utils/gym';
import { platesPerSide } from '@/utils/plateCalculator';
import { displayToKg, kgToDisplay } from '@/utils/unitConversion';
import { buildWarmupSets, WARMUP_REST_SECONDS } from '@/utils/warmupSets';

import type { PlateLine } from './plateCalculatorModel';
import { isInRange, parseToolNumber } from './toolNumbers';

/** The three kinds of equipment the page asks about, mapped to the app's equipment types. */
export type WarmupEquipment = 'barbell' | 'dumbbell' | 'machine';

export const WARMUP_EQUIPMENT: readonly WarmupEquipment[] = ['barbell', 'dumbbell', 'machine'];

export const WARMUP_EQUIPMENT_TYPE: Record<WarmupEquipment, EquipmentType> = {
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  machine: 'plate_machine',
};

/** The heaviest working weight the page takes, in the visitor's unit. */
export const MAX_WORKING_WEIGHT: Record<Units, number> = { metric: 1000, imperial: 2200 };

export type WarmupProblem = 'working';

export type WarmupValidation =
  { ok: true; working: number } | { ok: false; problem: WarmupProblem | null };

/** Reads the working weight in the visitor's unit. `problem: null` means nothing typed yet. */
export function validateWorkingWeight(text: string, units: Units): WarmupValidation {
  if (text.trim() === '') {
    return { ok: false, problem: null };
  }

  const working = parseToolNumber(text);
  if (!isInRange(working, 0.01, MAX_WORKING_WEIGHT[units])) {
    return { ok: false, problem: 'working' };
  }

  return { ok: true, working };
}

export interface WarmupRow {
  /** The weight in the visitor's unit, to a hundredth. */
  weight: number;
  /** The same weight in kilograms, as the app stores it. */
  weightKg: number;
  /** Reps of a warm-up set; `null` for the working set, whose reps the visitor already knows. */
  reps: number | null;
  /** Plates on each side of the bar; `null` when the equipment is not bar-loaded. */
  perSide: PlateLine[] | null;
}

export type WarmupReason = 'barIsWarmUp' | 'noRamp';

export interface WarmupPlan {
  /** The warm-up sets, lightest first. */
  sets: WarmupRow[];
  /** The working set, last. */
  working: WarmupRow;
  /** False when the gym cannot load the typed working weight exactly (barbell only). */
  workingLoadable: boolean;
  /** Why there are no warm-up sets; `null` when there are some. */
  reason: WarmupReason | null;
  /** The empty bar in the visitor's unit, for the barbell's opening set. */
  barWeight: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function rowFor(
  weightKg: number,
  reps: number | null,
  units: Units,
  gym: GymSnapshot,
  barLoaded: boolean
): WarmupRow {
  return {
    weight: round2(kgToDisplay(weightKg, units)),
    weightKg,
    reps,
    perSide: barLoaded
      ? platesPerSide(weightKg, gym).platesPerSide.map((plate) => ({
          weight: round2(kgToDisplay(plate.weightKg, units)),
          count: plate.count,
        }))
      : null,
  };
}

/**
 * The warm-up ramp for a working weight, from the app's own `buildWarmupSets`, with the working set
 * last. A barbell uses the gym's bar and plates; dumbbells and machines use a standard gym and no
 * bar. Empty warm-ups carry the reason the page shows instead.
 */
export function planWarmups(
  working: number,
  units: Units,
  equipment: WarmupEquipment,
  gym: GymSnapshot | null
): WarmupPlan {
  const equipmentType = WARMUP_EQUIPMENT_TYPE[equipment];
  const barLoaded = equipment === 'barbell';
  const loadingGym = gym ?? defaultGymSnapshot(units);
  const workingKg = displayToKg(working, units);

  const warmups = buildWarmupSets(workingKg, { gym, equipmentType, units });
  const sets = warmups.map((set) => rowFor(set.weightKg, set.reps, units, loadingGym, barLoaded));
  const workingRow = rowFor(workingKg, null, units, loadingGym, barLoaded);
  const workingLoadable = barLoaded
    ? Math.abs(working - kgToDisplay(platesPerSide(workingKg, loadingGym).loadedKg, units)) < 0.05
    : true;

  let reason: WarmupReason | null = null;
  if (sets.length === 0) {
    reason = barLoaded && workingKg <= loadingGym.barWeightKg * 1.15 ? 'barIsWarmUp' : 'noRamp';
  }

  return {
    sets,
    working: workingRow,
    workingLoadable,
    reason,
    barWeight: round2(kgToDisplay(loadingGym.barWeightKg, units)),
  };
}

/** Rest between warm-up sets, for the page to quote. */
export const WARMUP_REST = WARMUP_REST_SECONDS;
