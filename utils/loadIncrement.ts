import type { Units } from '@/constants/settings';
import type { EquipmentType } from '@/database/models/Exercise';

import { defaultWeightIncrementKg, type GymSnapshot, isBarLoadedEquipment } from './gym';
import { roundToLoadable } from './plateCalculator';
import { kgToDisplay, roundWeightForUnits } from './unitConversion';

/** The numeric input's step with no gym configured: the app's long-standing half-unit nudge. */
const LEGACY_INPUT_STEP = 0.5;

/**
 * The smallest change in load worth making, in kg.
 *
 * On a barbell it is one pair of the lightest plate the gym has (the plates go on both sides, so
 * the load moves by twice that plate); anywhere else it is the gym's own increment. Without a gym
 * it is the app's default step (2.5 kg / 5 lb) — what progression always used.
 */
export function incrementFor(
  equipmentType: EquipmentType | string | undefined,
  gym: GymSnapshot | null | undefined,
  units: Units
): number {
  if (!gym) {
    return defaultWeightIncrementKg(units);
  }

  if (isBarLoadedEquipment(equipmentType)) {
    const pairable = gym.plates.filter(({ count }) => count >= 2);
    if (pairable.length > 0) {
      return 2 * Math.min(...pairable.map(({ weightKg }) => weightKg));
    }
  }

  return gym.weightIncrementKg;
}

/**
 * The +/- step for a weight input, in the unit the input displays.
 *
 * With a gym, one tap moves to the next load the equipment can actually be set to. Without one the
 * step stays the legacy half unit: inventing a coarser step for someone who never configured
 * anything would make small corrections impossible.
 */
export function weightInputStep(
  equipmentType: EquipmentType | string | undefined,
  gym: GymSnapshot | null | undefined,
  units: Units
): number {
  if (!gym) {
    return LEGACY_INPUT_STEP;
  }
  return Math.round(kgToDisplay(incrementFor(equipmentType, gym, units), units) * 100) / 100;
}

export interface LoadStep {
  /** The smallest sensible change in load, in kg (see `incrementFor`). */
  incrementKg: number;
  /** Snaps a computed load (kg) to one the lifter can really set and will see as a round number. */
  roundLoad: (kg: number) => number;
}

/**
 * How a computed load may move for one exercise: the step to progress by, and the snap to a load
 * that can really be set. Every progression path (start of workout, ad-hoc suggestion, between
 * sets) takes both from here, so they cannot disagree.
 *
 * `units` must be the exercise's RESOLVED unit (`resolveWeightUnits`: exercise → gym → account),
 * never the account's alone. Without a gym it decides the whole step and the rounding: an exercise
 * pinned to pounds for a metric account must move in 5 lb and land on whole pounds, not on
 * whole kilograms that read as 143.3 lb.
 */
export function loadStepFor(
  equipmentType: EquipmentType | string | undefined,
  gym: GymSnapshot | null | undefined,
  units: Units
): LoadStep {
  return {
    incrementKg: incrementFor(equipmentType, gym, units),
    roundLoad: (kg) => {
      if (gym) {
        return roundToLoadable(kg, equipmentType, gym);
      }
      if (units === 'imperial') {
        return roundWeightForUnits(kg, units);
      }
      // Metric with no gym: the standard plates load in 2.5 kg pairs, so land on a multiple of the
      // step. Rounding to a whole kilogram produced 60 → 63 → 66, which no plate set can load.
      const step = defaultWeightIncrementKg(units);
      return Math.max(0, Math.round(kg / step) * step);
    },
  };
}
