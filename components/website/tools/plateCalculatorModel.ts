import type { Units } from '@/constants/settings';
import type { GymSnapshot } from '@/utils/gym';
import { nearestLoadableKg, platesPerSide } from '@/utils/plateCalculator';
import { displayToKg, kgToDisplay } from '@/utils/unitConversion';

import { isInRange, parseToolNumber } from './toolNumbers';

/** The heaviest target the page takes, in the visitor's unit. No gym loads anything near this. */
export const MAX_PLATE_TARGET: Record<Units, number> = { metric: 1000, imperial: 2200 };

export type PlateProblem = 'target';

export type PlateValidation =
  { ok: true; target: number } | { ok: false; problem: PlateProblem | null };

/** Reads the target weight in the visitor's unit. `problem: null` means nothing typed yet. */
export function validatePlateTarget(text: string, units: Units): PlateValidation {
  if (text.trim() === '') {
    return { ok: false, problem: null };
  }

  const target = parseToolNumber(text);
  if (!isInRange(target, 0.01, MAX_PLATE_TARGET[units])) {
    return { ok: false, problem: 'target' };
  }

  return { ok: true, target };
}

export interface PlateLine {
  /** One plate's weight, in the visitor's unit. */
  weight: number;
  /** Plates on EACH side of the bar. */
  count: number;
}

export interface PlateSolution {
  /** The plates for one side of the bar, heaviest first. */
  perSide: PlateLine[];
  /** Bar plus both sides, in the visitor's unit, to a tenth. */
  loadedWeight: number;
  /** `target - loadedWeight`, in the visitor's unit, to two decimals. */
  remainder: number;
  /** True when the loaded weight is the target, within the plates' rounding. */
  exact: boolean;
  /** The target is lighter than the empty bar. */
  belowBar: boolean;
  /** The bar weight, in the visitor's unit. */
  barWeight: number;
  /** The loadable weight nearest the target, above or below, in the visitor's unit. */
  nearestLoadable: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const round1 = (value: number) => Math.round(value * 10) / 10;
/**
 * Plates are stored to the hundredth of a kilogram (a 45 lb plate is 20.41 kg), so a load can sit a
 * few thousandths off the target while still being the target in pounds. Within this it is exact.
 */
const EXACT_TOLERANCE = 0.05;

/**
 * The plates for a target weight, from the app's own solver (`platesPerSide`: a bounded knapsack
 * over the plates the gym has, not a greedy pick). Every figure comes back in the visitor's unit.
 */
export function solvePlateLoad(target: number, units: Units, gym: GymSnapshot): PlateSolution {
  const targetKg = displayToKg(target, units);
  const load = platesPerSide(targetKg, gym);
  const loadedWeight = round1(kgToDisplay(load.loadedKg, units));
  const remainder = round2(target - loadedWeight);

  return {
    perSide: load.platesPerSide.map((plate) => ({
      weight: round2(kgToDisplay(plate.weightKg, units)),
      count: plate.count,
    })),
    loadedWeight,
    remainder,
    exact: Math.abs(target - loadedWeight) < EXACT_TOLERANCE,
    belowBar: load.belowBar,
    barWeight: round2(kgToDisplay(gym.barWeightKg, units)),
    nearestLoadable: round2(kgToDisplay(nearestLoadableKg(targetKg, gym), units)),
  };
}
