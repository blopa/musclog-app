/**
 * The body region a `muscle_group` value belongs to, collapsing the column's two vocabularies
 * (the coarse `legs`/`arms`/… written by the bundled catalogue and `CreateExerciseModal`, and the
 * fine-grained `quads`/`biceps`/… carried by legacy migrated exercises) into one.
 *
 * Readers that care about "is this a leg movement" must go through this instead of listing group
 * names themselves. A hand-written `Set<MuscleGroup>` naming only one vocabulary is not a type
 * error — it is a silent, total miss, which is exactly how every one of the 60 bundled leg
 * exercises (all stored as `legs`, none as `quads`) fell through the energy calculator's generic
 * branch. Because `MUSCLE_GROUP_FAMILY` is a `Record<MuscleGroup, …>`, adding a name to the union
 * fails the build until its family is declared here, and every consumer stays correct for free.
 *
 * Deliberately a SEPARATE file from `./Exercise.ts` rather than a member of it: this is a pure data
 * mapping, and pure consumers like `utils/workoutEnergyCalculator.ts` must be able to import it as
 * a value without dragging the WatermelonDB `Exercise` model class (and its decorators) into their
 * module graph. `import type` below is fully erased, so nothing of the model survives here.
 */

import type { MuscleGroup } from './Exercise';

export type MuscleGroupFamily = 'arms' | 'core' | 'legs' | 'other' | 'torso';

export const MUSCLE_GROUP_FAMILY: Record<MuscleGroup, MuscleGroupFamily> = {
  abdomen: 'core',
  abs: 'core',
  arms: 'arms',
  back: 'torso',
  biceps: 'arms',
  calves: 'legs',
  cardio: 'other',
  chest: 'torso',
  core: 'core',
  forearms: 'arms',
  full_body: 'other',
  glutes: 'legs',
  hamstrings: 'legs',
  legs: 'legs',
  other: 'other',
  quads: 'legs',
  shoulders: 'torso',
  triceps: 'arms',
};

export function muscleGroupFamily(muscleGroup: MuscleGroup): MuscleGroupFamily {
  return MUSCLE_GROUP_FAMILY[muscleGroup] ?? 'other';
}
