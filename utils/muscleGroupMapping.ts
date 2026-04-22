export type MuscleSlug =
  | 'abs'
  | 'adductors'
  | 'ankles'
  | 'biceps'
  | 'calves'
  | 'chest'
  | 'deltoids'
  | 'feet'
  | 'forearm'
  | 'gluteal'
  | 'hamstring'
  | 'hands'
  | 'hair'
  | 'head'
  | 'knees'
  | 'lower-back'
  | 'neck'
  | 'obliques'
  | 'quadriceps'
  | 'tibialis'
  | 'trapezius'
  | 'triceps'
  | 'upper-back';

export const MUSCLE_TO_SLUGS: Record<string, MuscleSlug[]> = {
  // Primary muscle groups
  abdomen: ['abs', 'obliques'],
  arms: ['biceps', 'triceps', 'forearm'],
  back: ['upper-back', 'lower-back', 'trapezius'],
  chest: ['chest'],
  core: ['abs', 'obliques', 'lower-back'],
  glutes: ['gluteal'],
  legs: ['quadriceps', 'hamstring', 'gluteal', 'calves'],
  shoulders: ['deltoids'],
  // Legacy / alternate primary group names
  abs: ['abs', 'obliques'],
  biceps: ['biceps'],
  calves: ['calves'],
  forearms: ['forearm'],
  hamstrings: ['hamstring'],
  quads: ['quadriceps'],
  triceps: ['triceps'],
  // Target muscles
  abductors: ['gluteal'],
  adductors: ['adductors'],
  anterior_deltoid: ['deltoids'],
  brachialis: ['biceps'],
  erector_spinae: ['lower-back'],
  external_obliques: ['obliques'],
  gluteus_medius: ['gluteal'],
  gluteus_minimus: ['gluteal'],
  hip_flexors: ['abs'],
  internal_obliques: ['obliques'],
  lateral_deltoid: ['deltoids'],
  lats: ['upper-back'],
  lower_traps: ['trapezius'],
  pectoralis_major: ['chest'],
  posterior_deltoid: ['deltoids'],
  quadratus_lumborum: ['lower-back'],
  quadriceps: ['quadriceps'],
  rectus_abdominis: ['abs'],
  rhomboids: ['upper-back'],
  serratus_anterior: ['chest'],
  teres_major: ['upper-back'],
  transverse_abdominis: ['abs'],
  traps: ['trapezius'],
  upper_traps: ['trapezius'],
  // Special groups
  full_body: [
    'chest',
    'upper-back',
    'lower-back',
    'trapezius',
    'deltoids',
    'biceps',
    'triceps',
    'forearm',
    'abs',
    'obliques',
    'quadriceps',
    'hamstring',
    'gluteal',
    'calves',
  ],
  cardio: [],
  other: [],
};

export const SLUG_TO_LABEL: Record<MuscleSlug, string> = {
  abs: 'Abs',
  adductors: 'Adductors',
  ankles: 'Ankles',
  biceps: 'Biceps',
  calves: 'Calves',
  chest: 'Chest',
  deltoids: 'Deltoids',
  feet: 'Feet',
  forearm: 'Forearms',
  gluteal: 'Glutes',
  hamstring: 'Hamstrings',
  hands: 'Hands',
  hair: 'Hair',
  head: 'Head',
  knees: 'Knees',
  'lower-back': 'Lower Back',
  neck: 'Neck',
  obliques: 'Obliques',
  quadriceps: 'Quads',
  tibialis: 'Tibialis',
  trapezius: 'Trapezius',
  triceps: 'Triceps',
  'upper-back': 'Upper Back',
};

export const FRONT_SLUGS = new Set<MuscleSlug>([
  'abs',
  'biceps',
  'chest',
  'deltoids',
  'forearm',
  'quadriceps',
  'obliques',
]);

export const BACK_SLUGS = new Set<MuscleSlug>([
  'calves',
  'forearm',
  'gluteal',
  'hamstring',
  'lower-back',
  'trapezius',
  'triceps',
  'upper-back',
]);

export function buildSlugIntensityMap(
  muscleGroups: (string | null | undefined)[]
): Map<MuscleSlug, number> {
  const countMap = new Map<MuscleSlug, number>();
  for (const group of muscleGroups) {
    if (!group) {
      continue;
    }
    const slugs = MUSCLE_TO_SLUGS[group.toLowerCase()] ?? [];
    for (const slug of slugs) {
      countMap.set(slug, (countMap.get(slug) ?? 0) + 1);
    }
  }
  return countMap;
}
