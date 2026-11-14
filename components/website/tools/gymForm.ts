import type { Units } from '@/constants/settings';
import { defaultGymSnapshot, type GymSnapshot, toStoredGymWeightKg } from '@/utils/gym';
import { displayToKg } from '@/utils/unitConversion';

import { isInRange, isWholeInRange, parseToolNumber } from './toolNumbers';

/**
 * The "your gym" form the plate and warm-up tools share: a bar and how many PAIRS of each plate
 * the gym has. It is typed in the unit the visitor reads and converted to the app's own
 * `GymSnapshot` (kilograms), so `platesPerSide` and `buildWarmupSets` run on exactly what the app
 * runs on. A form is only ever a per-visitor convenience: it is remembered in `localStorage` per
 * unit system and every read of it is validated, because anyone can edit what is stored.
 */
export interface GymFormState {
  /** The bar, as typed. */
  barWeight: string;
  /** Pairs owned, as typed, keyed by the plate's displayed weight (`String(25)`, `String(2.5)`). */
  pairs: Record<string, string>;
}

export const GYM_FORM_STORAGE_KEY_PREFIX = 'musclog_tools_gym_v1_';
export const TOOL_UNITS_STORAGE_KEY = 'musclog_tools_units_v1';

/** The plates a commercial gym has, in the unit the visitor reads. Matches `defaultPlates`. */
export const PLATE_DENOMINATIONS: Record<Units, readonly number[]> = {
  metric: [25, 20, 15, 10, 5, 2.5, 1.25],
  imperial: [45, 35, 25, 10, 5, 2.5],
};

/** A commercial gym has plenty of every plate; 10 pairs matches `defaultPlates` (20 each). */
export const DEFAULT_PAIRS = 10;
export const MAX_PAIRS = 50;
export const MAX_BAR_WEIGHT = 100;

const DEFAULT_BAR: Record<Units, string> = { metric: '20', imperial: '45' };

export const plateKey = (weight: number) => String(weight);

export function defaultGymForm(units: Units): GymFormState {
  return {
    barWeight: DEFAULT_BAR[units],
    pairs: Object.fromEntries(
      PLATE_DENOMINATIONS[units].map((plate) => [plateKey(plate), String(DEFAULT_PAIRS)])
    ),
  };
}

/**
 * The form as the app's gym, or `null` while any field is not a usable number (the page then shows
 * nothing rather than a wrong answer). A bar of 0 is allowed: a counterbalanced machine.
 */
export function gymFromForm(form: GymFormState, units: Units): GymSnapshot | null {
  const bar = parseToolNumber(form.barWeight);
  if (!isInRange(bar, 0, MAX_BAR_WEIGHT)) {
    return null;
  }

  const plates: GymSnapshot['plates'] = [];
  for (const plate of PLATE_DENOMINATIONS[units]) {
    const pairs = parseToolNumber(form.pairs[plateKey(plate)]);
    if (!isWholeInRange(pairs, 0, MAX_PAIRS)) {
      return null;
    }

    if (pairs > 0) {
      plates.push({
        weightKg: toStoredGymWeightKg(displayToKg(plate, units)),
        count: pairs * 2,
      });
    }
  }

  return {
    ...defaultGymSnapshot(units),
    id: 'tool',
    name: 'tool',
    barWeightKg: toStoredGymWeightKg(displayToKg(bar, units)),
    plates,
  };
}

export const serializeGymForm = (form: GymFormState): string => JSON.stringify(form);

/** A stored form, or `null` when it is missing, not JSON or not shaped for this unit system. */
export function parseStoredGymForm(
  raw: string | null | undefined,
  units: Units
): GymFormState | null {
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const { barWeight, pairs } = parsed as Partial<GymFormState>;
  if (typeof barWeight !== 'string' || typeof pairs !== 'object' || pairs === null) {
    return null;
  }

  const result: GymFormState = { barWeight: barWeight.slice(0, 8), pairs: {} };
  for (const plate of PLATE_DENOMINATIONS[units]) {
    const value = (pairs as Record<string, unknown>)[plateKey(plate)];
    if (typeof value !== 'string') {
      return null;
    }

    result.pairs[plateKey(plate)] = value.slice(0, 4);
  }

  return result;
}

export function parseStoredUnits(raw: string | null | undefined): Units | null {
  return raw === 'metric' || raw === 'imperial' ? raw : null;
}
