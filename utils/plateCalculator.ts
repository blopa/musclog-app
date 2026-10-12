import type { EquipmentType } from '@/database/models/Exercise';

import { type GymPlate, type GymSnapshot, isBarLoadedEquipment } from './gym';

/** Loads are solved in hundredths of a kilogram so 1.25 kg and 20.4117 kg plates stay exact. */
const UNITS_PER_KG = 100;
/** Past this many pairs of one plate the answer cannot change, and the table only gets bigger. */
const MAX_PAIRS_PER_PLATE = 12;
const NOT_REACHABLE = 0xffff;

type LoadingGym = Pick<GymSnapshot, 'barWeightKg' | 'plates'>;

export interface PlateLoad {
  /** The plates to put on EACH side of the bar, heaviest first. */
  platesPerSide: GymPlate[];
  /** Bar plus both sides: what is actually on the bar. */
  loadedKg: number;
  /** `targetKg - loadedKg`. Zero when the target is loadable exactly; negative when the bar alone is heavier. */
  remainderKg: number;
  /** The target is lighter than the empty bar. */
  belowBar: boolean;
}

interface Denomination {
  weightKg: number;
  units: number;
  pairs: number;
}

interface ReachableTable {
  denominations: Denomination[];
  /** Fewest plates (per side) that make exactly `u` units, or `NOT_REACHABLE`. */
  fewestPlates: Uint16Array;
  /** `choices[d][u]` = how many of denomination `d` the best way to make `u` uses. */
  choices: Uint8Array[];
}

const roundKg = (kg: number) => Math.round(kg * 10_000) / 10_000;

function denominationsOf(plates: readonly GymPlate[]): Denomination[] {
  return plates
    .map(({ weightKg, count }) => ({
      weightKg,
      units: Math.round(weightKg * UNITS_PER_KG),
      pairs: Math.min(MAX_PAIRS_PER_PLATE, Math.floor(count / 2)),
    }))
    .filter(({ units, pairs }) => units > 0 && pairs > 0)
    .sort((a, b) => b.units - a.units);
}

/**
 * Which per-side weights the plates can make, and the fewest plates for each.
 *
 * A greedy "heaviest plate that fits" is wrong as soon as the inventory is limited: with one pair
 * each of 20, 15 and 10 kg, 25 kg a side is 15 + 10, but greedy takes the 20 and is stuck 5 short.
 * This is a bounded knapsack over at most a few thousand units, so it is exact and instant.
 */
function reachableWithin(denominations: Denomination[], capUnits: number): ReachableTable {
  let previous = new Uint16Array(capUnits + 1).fill(NOT_REACHABLE);
  previous[0] = 0;
  const choices: Uint8Array[] = [];

  for (const { units, pairs } of denominations) {
    const next = new Uint16Array(capUnits + 1).fill(NOT_REACHABLE);
    const choice = new Uint8Array(capUnits + 1);

    for (let u = 0; u <= capUnits; u++) {
      for (let k = 0; k <= pairs && k * units <= u; k++) {
        const before = previous[u - k * units];
        if (before === NOT_REACHABLE) {
          continue;
        }
        if (before + k < next[u]) {
          next[u] = before + k;
          choice[u] = k;
        }
      }
    }

    choices.push(choice);
    previous = next;
  }

  return { denominations, fewestPlates: previous, choices };
}

function platesFor(table: ReachableTable, units: number): GymPlate[] {
  const result: GymPlate[] = [];
  let remaining = units;
  for (let d = table.denominations.length - 1; d >= 0; d--) {
    const count = table.choices[d][remaining];
    if (count > 0) {
      result.push({ weightKg: table.denominations[d].weightKg, count });
      remaining -= count * table.denominations[d].units;
    }
  }
  return result.sort((a, b) => b.weightKg - a.weightKg);
}

function loadFromUnits(table: ReachableTable, units: number, gym: LoadingGym, targetKg: number) {
  const loadedKg = roundKg(gym.barWeightKg + (2 * units) / UNITS_PER_KG);
  return {
    platesPerSide: platesFor(table, units),
    loadedKg,
    remainderKg: roundKg(targetKg - loadedKg),
    belowBar: false,
  } satisfies PlateLoad;
}

/**
 * The plates to load for a target weight: the heaviest load NOT above it that the gym's plates can
 * make, using the fewest plates. `remainderKg` says how far short it falls.
 */
export function platesPerSide(targetKg: number, gym: LoadingGym): PlateLoad {
  const { barWeightKg } = gym;
  if (!Number.isFinite(targetKg) || targetKg < barWeightKg) {
    return {
      platesPerSide: [],
      loadedKg: roundKg(barWeightKg),
      remainderKg: roundKg((Number.isFinite(targetKg) ? targetKg : 0) - barWeightKg),
      belowBar: true,
    };
  }

  const perSideUnits = Math.floor(((targetKg - barWeightKg) / 2) * UNITS_PER_KG + 1e-6);
  const table = reachableWithin(denominationsOf(gym.plates), perSideUnits);

  for (let u = perSideUnits; u >= 0; u--) {
    if (table.fewestPlates[u] !== NOT_REACHABLE) {
      return loadFromUnits(table, u, gym, targetKg);
    }
  }

  // Unreachable: 0 units (an empty bar) is always reachable.
  return loadFromUnits(table, 0, gym, targetKg);
}

/**
 * The loaded weight closest to the target, above or below it (the lower one on a tie). This is
 * what "round to something the bar can actually be loaded to" means.
 */
export function nearestLoadableKg(targetKg: number, gym: LoadingGym): number {
  const denominations = denominationsOf(gym.plates);
  if (denominations.length === 0 || !Number.isFinite(targetKg)) {
    return roundKg(Math.max(gym.barWeightKg, 0));
  }

  const heaviestPlateUnits = denominations[0].units;
  const targetUnits = Math.max(0, Math.round(((targetKg - gym.barWeightKg) / 2) * UNITS_PER_KG));
  const totalUnits = denominations.reduce((sum, { units, pairs }) => sum + units * pairs, 0);
  // Looking one heavy plate past the target is enough to find the nearest load above it.
  const cap = Math.min(totalUnits, targetUnits + heaviestPlateUnits * 2);
  const table = reachableWithin(denominations, cap);

  let best = 0;
  let bestDistance = Infinity;
  for (let u = 0; u <= cap; u++) {
    if (table.fewestPlates[u] === NOT_REACHABLE) {
      continue;
    }
    const distance = Math.abs(u - targetUnits);
    if (distance < bestDistance) {
      best = u;
      bestDistance = distance;
    }
  }

  return roundKg(gym.barWeightKg + (2 * best) / UNITS_PER_KG);
}

/**
 * Rounds a computed load to one the equipment can really be set to, or leaves it alone for a
 * gym-less user (whose rounding is the app's long-standing whole-kilogram one).
 *
 * A barbell snaps to what the plates can make; everything else (dumbbells, stacks, cables) to a
 * multiple of the gym's smallest increment.
 */
export function roundToLoadable(
  kg: number,
  equipmentType: EquipmentType | string | undefined,
  gym: GymSnapshot | null | undefined
): number {
  if (!gym) {
    return Math.round(kg);
  }
  if (!Number.isFinite(kg) || kg <= 0) {
    return 0;
  }

  if (isBarLoadedEquipment(equipmentType) && gym.plates.length > 0) {
    return nearestLoadableKg(kg, gym);
  }

  return roundKg(Math.max(0, Math.round(kg / gym.weightIncrementKg) * gym.weightIncrementKg));
}
