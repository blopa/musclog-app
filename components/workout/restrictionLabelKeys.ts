import type { EquipmentType } from '@/database/models/Exercise';
import type { MuscleGroupFamily } from '@/database/models/muscleGroupFamily';
import type { CardioActivity } from '@/utils/cardioEnergy';
import type {
  InjuryExpiryOption,
  RestrictionKind,
  SubstitutionReason,
} from '@/utils/exerciseSubstitution';

/**
 * Whole translation keys for the swap and restriction UI, one entry per option. They are tables
 * rather than `t(\`...${id}\`)` at the call site because a key assembled at runtime is invisible to
 * `npm run check-translations` (and to anyone grepping a key during a rename), and a
 * `Record<Union, …>` makes a new option fail the build until its copy is wired.
 */

export const FAMILY_LABEL_KEYS = {
  all: 'replaceExercise.families.all',
  torso: 'replaceExercise.families.torso',
  arms: 'replaceExercise.families.arms',
  legs: 'replaceExercise.families.legs',
  core: 'replaceExercise.families.core',
  other: 'replaceExercise.families.other',
} as const satisfies Record<'all' | MuscleGroupFamily, string>;

export const SUBSTITUTION_REASON_KEYS = {
  equipment_unavailable: {
    label: 'replaceExercise.reason.options.equipment_unavailable',
    description: 'replaceExercise.reason.descriptions.equipment_unavailable',
  },
  pain: {
    label: 'replaceExercise.reason.options.pain',
    description: 'replaceExercise.reason.descriptions.pain',
  },
  too_hard: {
    label: 'replaceExercise.reason.options.too_hard',
    description: 'replaceExercise.reason.descriptions.too_hard',
  },
  too_easy: {
    label: 'replaceExercise.reason.options.too_easy',
    description: 'replaceExercise.reason.descriptions.too_easy',
  },
  dislike: {
    label: 'replaceExercise.reason.options.dislike',
    description: 'replaceExercise.reason.descriptions.dislike',
  },
  machine_occupied: {
    label: 'replaceExercise.reason.options.machine_occupied',
    description: 'replaceExercise.reason.descriptions.machine_occupied',
  },
  just_today: {
    label: 'replaceExercise.reason.options.just_today',
    description: 'replaceExercise.reason.descriptions.just_today',
  },
} as const satisfies Record<SubstitutionReason, { label: string; description: string }>;

/** The "remember this" toggle: only the reasons that imply a restriction have one. */
export const REMEMBER_CHOICE_KEYS = {
  injury: {
    label: 'replaceExercise.reason.remember.injury',
    hint: 'replaceExercise.reason.rememberHint.injury',
  },
  dislike: {
    label: 'replaceExercise.reason.remember.dislike',
    hint: 'replaceExercise.reason.rememberHint.dislike',
  },
} as const satisfies Record<Exclude<RestrictionKind, 'never'>, { label: string; hint: string }>;

export const INJURY_EXPIRY_LABEL_KEYS = {
  '2w': 'workoutSettings.restrictions.expiry.2w',
  '4w': 'workoutSettings.restrictions.expiry.4w',
  '12w': 'workoutSettings.restrictions.expiry.12w',
  open: 'workoutSettings.restrictions.expiry.open',
} as const satisfies Record<InjuryExpiryOption, string>;

/** The kind named in the gym settings' list of restricted exercises. */
export const RESTRICTION_KIND_LABEL_KEYS = {
  never: 'workoutSettings.restrictions.kind.never',
  injury: 'workoutSettings.restrictions.kind.injury',
  dislike: 'workoutSettings.restrictions.kind.dislike',
} as const satisfies Record<RestrictionKind, string>;

/** The exercise view's choice: a restriction kind, or `allow` for none. */
export const RESTRICTION_CHOICE_KEYS = {
  allow: { label: 'exercises.viewExercise.restriction.allow', explain: null },
  dislike: {
    label: 'exercises.viewExercise.restriction.dislike',
    explain: 'exercises.viewExercise.restriction.explain.dislike',
  },
  injury: {
    label: 'exercises.viewExercise.restriction.injury',
    explain: 'exercises.viewExercise.restriction.explain.injury',
  },
  never: {
    label: 'exercises.viewExercise.restriction.never',
    explain: 'exercises.viewExercise.restriction.explain.never',
  },
} as const satisfies Record<RestrictionKind | 'allow', { label: string; explain: string | null }>;

export const EQUIPMENT_LABEL_KEYS = {
  dumbbell: 'exercises.equipmentTypes.dumbbell',
  barbell: 'exercises.equipmentTypes.barbell',
  bodyweight: 'exercises.equipmentTypes.bodyweight',
  plate_machine: 'exercises.equipmentTypes.plate_machine',
  cable: 'exercises.equipmentTypes.cable',
  kettlebell: 'exercises.equipmentTypes.kettlebell',
  smith_machine: 'exercises.equipmentTypes.smith_machine',
  medicine_ball: 'exercises.equipmentTypes.medicine_ball',
  pneumatic_machine: 'exercises.equipmentTypes.pneumatic_machine',
  cardio: 'exercises.equipmentTypes.cardio',
  resistance_band: 'exercises.equipmentTypes.resistance_band',
  other: 'exercises.equipmentTypes.other',
} as const satisfies Record<EquipmentType, string>;

export const CARDIO_ACTIVITY_LABEL_KEYS = {
  walk: 'cardio.walk',
  run: 'cardio.run',
} as const satisfies Record<CardioActivity, string>;
