import type { Units } from '@/constants/settings';
import type { EquipmentType } from '@/database/models/Exercise';

import { defaultWeightIncrementKg, type GymSnapshot, isBarLoadedEquipment } from './gym';
import { kgToDisplay } from './unitConversion';

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
