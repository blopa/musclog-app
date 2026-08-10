/**
 * Metabolic Work-Energy Model (MWEM)
 *
 * Calculates calorie expenditure for resistance training based on mechanical
 * work (Force × Distance), metabolic efficiency, and anaerobic multipliers.
 *
 * Based on: Reis et al. (2017), Scott (2011), Robergs (2007)
 */

import convert from 'convert';

import type { EquipmentType, Gender, MechanicType, MuscleGroup } from '@/database/models';
// From the pure family module, not the model file: this is a value import, and pulling in
// `Exercise.ts` would drag the WatermelonDB model class into a module that must stay pure.
import { muscleGroupFamily } from '@/database/models/muscleGroupFamily';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const G = 9.80665; // m/s² — acceleration due to gravity
const J_TO_KCAL = 4184; // Joules per kilocalorie
const EFFICIENCY = 0.22; // Human skeletal muscle mechanical efficiency (~22%)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MWEMExerciseInput {
  mechanicType: MechanicType;
  muscleGroup: MuscleGroup;
  equipmentType: EquipmentType;
  loadMultiplier: number;
}

export interface MWEMSetInput {
  weight: number;
  reps: number;
}

export interface MWEMInput {
  user: {
    weightKg: number;
    heightCm: number;
    gender: Gender;
  };
  exercise: MWEMExerciseInput;
  sets: MWEMSetInput[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// `muscle_group` holds either the coarse or the fine-grained vocabulary, so neither can be
// matched by name here. `muscleGroupFamily` collapses both — see `MUSCLE_GROUP_FAMILY` in
// `database/models/muscleGroupFamily.ts` for why a local Set of group names is a silent, total
// miss rather than a type error.

function resolveDisplacementFactor(muscleGroup: MuscleGroup, mechanicType: MechanicType): number {
  if (muscleGroupFamily(muscleGroup) === 'legs') {
    return 0.45;
  }

  if (mechanicType === 'isolation' && muscleGroupFamily(muscleGroup) === 'arms') {
    return 0.25;
  }

  return 0.35;
}

function resolveBodyweightContribution(
  equipmentType: EquipmentType,
  mechanicType: MechanicType,
  muscleGroup: MuscleGroup,
  weightKg: number
): number {
  if (equipmentType === 'bodyweight') {
    return weightKg;
  }

  if (mechanicType === 'compound' && muscleGroupFamily(muscleGroup) === 'legs') {
    return 0.88 * weightKg;
  }

  if (mechanicType === 'compound') {
    return 0.1 * weightKg;
  }

  return 0.05 * weightKg;
}

function resolveAnaerobicMultiplier(
  mechanicType: MechanicType,
  equipmentType: EquipmentType
): number {
  return equipmentType === 'bodyweight' || mechanicType === 'compound' ? 1.5 : 1.1;
}

// ---------------------------------------------------------------------------
// Core calculation
// ---------------------------------------------------------------------------

/**
 * Calculate total kilocalories burned for a single exercise across all sets.
 *
 * Sets with zero weight on non-bodyweight exercises are skipped (unlogged sets).
 *
 * A `loadMultiplier` of 0 zeroes the exercise, and that is deliberate — it is
 * reserved for movements with no displacement to credit (isometric holds like the
 * plank and wall sit, and cardio). Bodyweight exercises are not in that category:
 * each carries the fraction of body mass its movement actually shifts, so a
 * pull-up is 0.99 and a push-up 0.70. See the `loadMultiplier` entry in AGENTS.md.
 */
export function calculateExerciseKcal(input: MWEMInput): number {
  const { user, exercise, sets } = input;
  const { weightKg, heightCm, gender } = user;
  const { mechanicType, muscleGroup, equipmentType, loadMultiplier } = exercise;

  const dFactor = resolveDisplacementFactor(muscleGroup, mechanicType);
  const distance = (convert(heightCm, 'cm').to('m') as number) * dFactor;
  const bodyMass = resolveBodyweightContribution(
    equipmentType,
    mechanicType,
    muscleGroup,
    weightKg
  );
  const anaerobicFactor = resolveAnaerobicMultiplier(mechanicType, equipmentType);
  const genderFactor = gender === 'female' ? 0.9 : 1.0;

  let totalKcal = 0;

  for (const set of sets) {
    if (set.weight === 0 && equipmentType !== 'bodyweight') {
      continue;
    }

    if (set.reps <= 0) {
      continue;
    }

    const totalMass = set.weight + bodyMass;
    const workJoules = totalMass * G * distance * set.reps;
    const kcal = workJoules / (J_TO_KCAL * EFFICIENCY);
    totalKcal += kcal * anaerobicFactor * loadMultiplier * genderFactor;
  }

  return totalKcal;
}

/**
 * Calculate total kilocalories burned across multiple exercises in a workout.
 */
export function calculateWorkoutKcal(inputs: MWEMInput[]): number {
  return inputs.reduce((sum, input) => sum + calculateExerciseKcal(input), 0);
}
