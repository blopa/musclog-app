import type { MuscleSlug } from '@/utils/muscleGroupMapping';

/**
 * Whole translation keys, one per body-map slug. Callers never build a key from a slug, so the
 * translation checker sees every key and a new slug fails the build until it is named here.
 */
export const MUSCLE_LABEL_KEYS = {
  abs: 'muscleLoad.muscles.abs',
  adductors: 'muscleLoad.muscles.adductors',
  ankles: 'muscleLoad.muscles.ankles',
  biceps: 'muscleLoad.muscles.biceps',
  calves: 'muscleLoad.muscles.calves',
  chest: 'muscleLoad.muscles.chest',
  deltoids: 'muscleLoad.muscles.deltoids',
  feet: 'muscleLoad.muscles.feet',
  forearm: 'muscleLoad.muscles.forearm',
  gluteal: 'muscleLoad.muscles.gluteal',
  hamstring: 'muscleLoad.muscles.hamstring',
  hands: 'muscleLoad.muscles.hands',
  hair: 'muscleLoad.muscles.hair',
  head: 'muscleLoad.muscles.head',
  knees: 'muscleLoad.muscles.knees',
  'lower-back': 'muscleLoad.muscles.lowerBack',
  neck: 'muscleLoad.muscles.neck',
  obliques: 'muscleLoad.muscles.obliques',
  quadriceps: 'muscleLoad.muscles.quadriceps',
  tibialis: 'muscleLoad.muscles.tibialis',
  trapezius: 'muscleLoad.muscles.trapezius',
  triceps: 'muscleLoad.muscles.triceps',
  'upper-back': 'muscleLoad.muscles.upperBack',
} as const satisfies Record<MuscleSlug, string>;
