import type { FitnessGoal, Gender, LiftingExperience, WeightGoal } from '../database/models';

/** Profile / onboarding form payload for fitness + body stats. */
export type FitnessDetails = {
  dob?: string;
  units: 'imperial' | 'metric';
  weight: string;
  height: string;
  fatPercentage?: number;
  weightGoal: WeightGoal;
  fitnessGoal: FitnessGoal;
  activityLevel: number;
  gender: Gender;
  experience: LiftingExperience;
};
