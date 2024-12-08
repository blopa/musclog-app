export const EXERCISE_TYPES = {
    BODY_WEIGHT: 'bodyweight',
    CARDIO: 'cardio',
    COMPOUND: 'compound',
    ISOLATION: 'isolation',
    MACHINE: 'machine',
    PLYOMETRIC: 'plyometric',
} as const;

export const MUSCLE_GROUPS = {
    ABDOMEN: 'abdomen',
    ARMS: 'arms',
    BACK: 'back',
    CALVES: 'calves',
    CHEST: 'chest',
    CORE: 'core',
    FOREARMS: 'forearms',
    FULL_BODY: 'full_body',
    GLUTES: 'glutes',
    LEGS: 'legs',
    NECK: 'neck',
    OBLIQUES: 'obliques',
    SHOULDERS: 'shoulders',
} as const;

export const MUSCLES = {
    ABDUCTORS: 'abductors',
    ADDUCTOR_BREVIS: 'adductor_brevis',
    ADDUCTOR_LONGUS: 'adductor_longus',
    ADDUCTOR_MAGNUS_HAMSTRING_PORTION: 'adductor_magnus_hamstring_portion',
    ADDUCTORS: 'adductors',
    ANTERIOR_DELTOID: 'anterior_deltoid',
    BICEPS: 'biceps',
    BRACHIALIS: 'brachialis',
    CALVES: 'calves',
    ERECTOR_SPINAE: 'erector_spinae',
    EXTERNAL_OBLIQUES: 'external_obliques',
    FOREARMS: 'forearms',
    GLUTES: 'glutes',
    GLUTEUS_MEDIUS: 'gluteus_medius',
    GLUTEUS_MINIMUS: 'gluteus_minimus',
    HAMSTRINGS: 'hamstrings',
    HIP_FLEXORS: 'hip_flexors',
    ILIACUS: 'iliacus',
    INFRASPINATUS: 'infraspinatus',
    INTERNAL_OBLIQUES: 'internal_obliques',
    LATERAL_DELTOID: 'lateral_deltoid',
    LATS: 'lats',
    LEVATOR_SCAPULAE: 'levator_scapulae',
    LOWER_TRAPS: 'lower_traps',
    MIDDLE_TRAPS: 'middle_traps',
    MULTIFIDUS: 'multifidus',
    OBLIQUES: 'obliques',
    PECTINEUS: 'pectineus',
    PERONEALS: 'peroneals',
    POSTERIOR_DELTOID: 'posterior_deltoid',
    PSOAS_MAJOR: 'psoas_major',
    QUADRICEPS: 'quadriceps',
    RECTUS_ABDOMINIS: 'rectus_abdominis',
    RHOMBOIDS: 'rhomboids',
    ROTATOR_CUFF: 'rotator_cuff',
    SERRATUS_ANTERIOR: 'serratus_anterior',
    STERNOCLEIDOMASTOID: 'sternocleidomastoid',
    SUBSCAPULARIS: 'subscapularis',
    TENSOR_FASCIAE_LATAE: 'tensor_fasciae_latae',
    TERES_MAJOR: 'teres_major',
    TERES_MINOR: 'teres_minor',
    THORACIC_DIAPHRAGM: 'thoracic_diaphragm',
    TIBIALIS_ANTERIOR: 'tibialis_anterior',
    TRANSVERSE_ABDOMINIS: 'transverse_abdominis',
    TRAPS: 'traps',
    TRICEPS: 'triceps',
    UPPER_TRAPS: 'upper_traps',
} as const;


/* eslint-disable perfectionist/sort-objects */
export const ACTIVITY_LEVELS = {
    SEDENTARY: 'sedentary',
    LIGHTLY_ACTIVE: 'lightly_active',
    MODERATELY_ACTIVE: 'moderately_active',
    VERY_ACTIVE: 'very_active',
    SUPER_ACTIVE: 'super_active',
} as const;

export const ACTIVITY_LEVELS_MULTIPLIER = {
    [ACTIVITY_LEVELS.SEDENTARY]: 1.2,
    [ACTIVITY_LEVELS.LIGHTLY_ACTIVE]: 1.375,
    [ACTIVITY_LEVELS.MODERATELY_ACTIVE]: 1.55,
    [ACTIVITY_LEVELS.VERY_ACTIVE]: 1.725,
    [ACTIVITY_LEVELS.SUPER_ACTIVE]: 1.9,
} as const;

export const EXPERIENCE_LEVELS = {
    BEGINNER: 'beginner',
    INTERMEDIATE: 'intermediate',
    ADVANCED: 'advanced',
} as const;

export const VOLUME_CALCULATION_TYPES = {
    NONE: 'none',
    ALGO_GENERATED: 'algo_generated',
    AI_GENERATED: 'ai_generated',
} as const;


/* eslint-enable perfectionist/sort-objects */

export const VOLUME_CALCULATION_TYPES_VALUES = Object.values(VOLUME_CALCULATION_TYPES);

export const ACTIVITY_LEVELS_VALUES = Object.values(ACTIVITY_LEVELS);

export const EXPERIENCE_LEVELS_VALUES = Object.values(EXPERIENCE_LEVELS);
