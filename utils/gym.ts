import type { Units } from '@/constants/settings';
import type { EquipmentType } from '@/database/models/Exercise';

import { displayToKg } from './unitConversion';

/**
 * A gym profile as the rest of the app sees it: parsed, validated and in kilograms.
 *
 * The `gyms` table stores its two lists as JSON strings. `snapshotFromGymRow` is the ONE place they
 * are parsed, so the plate calculator, the load increments and the substitution ranking can all
 * trust their input — a hand-edited or newer-version row degrades to defaults instead of throwing
 * in the middle of a set.
 */
export interface GymPlate {
  weightKg: number;
  /** Plates owned in total. Plates load in pairs, so only `floor(count / 2)` can go on a bar. */
  count: number;
}

export interface GymSnapshot {
  id: string;
  name: string;
  barWeightKg: number;
  plates: GymPlate[];
  /** Smallest change in load on a dumbbell, machine or cable stack. */
  weightIncrementKg: number;
  equipment: EquipmentType[];
  weightUnit?: 'kg' | 'lbs';
}

/** The columns `snapshotFromGymRow` reads, so it works on a model or a plain object. */
export interface GymRowLike {
  id: string;
  name: string;
  barWeightKg: number;
  platesJson: string;
  weightIncrementKg: number;
  equipmentJson: string;
  weightUnit?: string | null;
}

/** Every equipment type, in the order a picker should list them. */
export const EQUIPMENT_TYPES: readonly EquipmentType[] = [
  'barbell',
  'dumbbell',
  'cable',
  'plate_machine',
  'smith_machine',
  'kettlebell',
  'resistance_band',
  'medicine_ball',
  'pneumatic_machine',
  'cardio',
  'bodyweight',
  'other',
];

/** Equipment that is always available: it needs nothing from a gym. */
export const ALWAYS_AVAILABLE_EQUIPMENT: readonly EquipmentType[] = ['bodyweight', 'other'];

/** Equipment loaded with plates on a bar: the plate calculator applies, and loads move in pairs. */
export const BAR_LOADED_EQUIPMENT: readonly EquipmentType[] = ['barbell', 'smith_machine'];

export const isBarLoadedEquipment = (equipmentType: EquipmentType | string | null | undefined) =>
  !!equipmentType && (BAR_LOADED_EQUIPMENT as readonly string[]).includes(equipmentType);

export const DEFAULT_BAR_WEIGHT_KG = 20;
export const DEFAULT_WEIGHT_INCREMENT_KG = 2.5;

/** Enough plates that a commercial gym is effectively unlimited (10 per side). */
const COMMERCIAL_PLATE_COUNT = 20;

const METRIC_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;
const IMPERIAL_PLATES_LB = [45, 35, 25, 10, 5, 2.5] as const;

/**
 * Gym weights are persisted in kilograms even when the gym uses pound plates. Seven decimals keep
 * the conversion error below 0.000001 lb across the supported gym range. Keep every gym storage
 * boundary on this helper: mixing precisions makes an existing plate stop matching the same value
 * typed into the editor.
 */
export const GYM_WEIGHT_STORAGE_DECIMALS = 7;
export const toStoredGymWeightKg = (value: number): number => {
  const factor = 10 ** GYM_WEIGHT_STORAGE_DECIMALS;
  return Math.round(value * factor) / factor;
};

/** The plates a lifter in this unit system would expect to find in a commercial gym. */
export function defaultPlates(units: Units): GymPlate[] {
  return units === 'imperial'
    ? IMPERIAL_PLATES_LB.map((lb) => ({
        weightKg: toStoredGymWeightKg(displayToKg(lb, 'imperial')),
        count: COMMERCIAL_PLATE_COUNT,
      }))
    : METRIC_PLATES_KG.map((kg) => ({ weightKg: kg, count: COMMERCIAL_PLATE_COUNT }));
}

/** The bar a lifter in this unit system would expect: 20 kg, or the 45 lb "Olympic" bar. */
export function defaultBarWeightKg(units: Units): number {
  return units === 'imperial'
    ? toStoredGymWeightKg(displayToKg(45, 'imperial'))
    : DEFAULT_BAR_WEIGHT_KG;
}

/** The smallest sensible step on a stack or dumbbell rack: 2.5 kg, or 5 lb. */
export function defaultWeightIncrementKg(units: Units): number {
  return units === 'imperial'
    ? toStoredGymWeightKg(displayToKg(5, 'imperial'))
    : DEFAULT_WEIGHT_INCREMENT_KG;
}

/**
 * The gym assumed for a user who never described theirs: a standard bar, a full set of standard
 * plates and the default step. Warm-ups load from it so they always come out as weights a bar can
 * carry. Progression deliberately does NOT round non-bar loads to it (see `roundToLoadable`).
 */
export function defaultGymSnapshot(units: Units): GymSnapshot {
  return {
    id: 'default',
    name: 'default',
    barWeightKg: defaultBarWeightKg(units),
    plates: defaultPlates(units),
    weightIncrementKg: defaultWeightIncrementKg(units),
    equipment: [],
  };
}

const isEquipmentType = (value: unknown): value is EquipmentType =>
  typeof value === 'string' && (EQUIPMENT_TYPES as readonly string[]).includes(value);

function safeParse(raw: string | null | undefined): unknown {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Valid plates only (positive weight, whole non-negative count), one entry per weight, heaviest
 * first. Anything else in the stored JSON is dropped rather than rejected: the row may have been
 * written by a build that knows more than this one.
 */
export function parsePlates(raw: string | null | undefined): GymPlate[] {
  const parsed = safeParse(raw);
  if (!Array.isArray(parsed)) {
    return [];
  }

  const byWeight = new Map<number, number>();
  for (const entry of parsed) {
    const weightKg = Number(entry?.weightKg);
    const count = Math.floor(Number(entry?.count));
    if (!Number.isFinite(weightKg) || weightKg <= 0 || !Number.isFinite(count) || count <= 0) {
      continue;
    }

    const key = toStoredGymWeightKg(weightKg);
    byWeight.set(key, (byWeight.get(key) ?? 0) + count);
  }

  return [...byWeight]
    .map(([weightKg, count]) => ({ weightKg, count }))
    .sort((a, b) => b.weightKg - a.weightKg);
}

export function parseEquipment(raw: string | null | undefined): EquipmentType[] {
  const parsed = safeParse(raw);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return [...new Set(parsed.filter(isEquipmentType))];
}

export const serializePlates = (plates: readonly GymPlate[]): string =>
  JSON.stringify(
    plates.map(({ weightKg, count }) => ({
      weightKg: toStoredGymWeightKg(weightKg),
      count,
    }))
  );

export const serializeEquipment = (equipment: readonly EquipmentType[]): string =>
  JSON.stringify([...new Set(equipment)]);

export function snapshotFromGymRow(row: GymRowLike): GymSnapshot {
  const barWeightKg = Number(row.barWeightKg);
  const weightIncrementKg = Number(row.weightIncrementKg);

  return {
    id: row.id,
    name: row.name,
    // A bar of 0 is legitimate (a Smith machine counterbalanced to nothing); a NaN is not.
    barWeightKg:
      Number.isFinite(barWeightKg) && barWeightKg >= 0 ? barWeightKg : DEFAULT_BAR_WEIGHT_KG,
    plates: parsePlates(row.platesJson),
    weightIncrementKg:
      Number.isFinite(weightIncrementKg) && weightIncrementKg > 0
        ? weightIncrementKg
        : DEFAULT_WEIGHT_INCREMENT_KG,
    equipment: parseEquipment(row.equipmentJson),
    weightUnit: row.weightUnit === 'kg' || row.weightUnit === 'lbs' ? row.weightUnit : undefined,
  };
}

/**
 * True when a gym can supply this equipment. With no gym nothing is restricted, and bodyweight and
 * "other" exercises need nothing from a gym at all.
 */
export function isEquipmentAvailable(
  equipmentType: EquipmentType | string | undefined,
  gym: Pick<GymSnapshot, 'equipment'> | null | undefined
): boolean {
  if (!gym || !equipmentType) {
    return true;
  }

  if ((ALWAYS_AVAILABLE_EQUIPMENT as readonly string[]).includes(equipmentType)) {
    return true;
  }

  return (gym.equipment as readonly string[]).includes(equipmentType);
}
