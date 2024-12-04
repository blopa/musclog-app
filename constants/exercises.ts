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
    ABDUCTORS: 'abductors',
    ADDUCTOR_MAGNUS_HAMSTRING_PORTION: 'adductor_magnus_hamstring_portion',
    ADDUCTORS: 'adductors',
    ANTERIOR_DELTOID: 'anterior_deltoid',
    ARMS: 'arms',
    BACK: 'back',
    BICEPS: 'biceps',
    BRACHIALIS: 'brachialis',
    CALVES: 'calves',
    CHEST: 'chest',
    CORE: 'core',
    DELTOIDS: 'deltoids',
    ERECTOR_SPINAE: 'erector_spinae',
    EXTENSORS_HAND: 'extensors_hand',
    FLEXORS_HAND: 'flexors_hand',
    FOREARMS: 'forearms',
    FULL_BODY: 'full_body',
    GLUTES: 'glutes',
    HAMSTRINGS: 'hamstrings',
    HIP_FLEXORS: 'hip_flexors',
    ILIACUS: 'iliacus',
    ILIOCOSTALIS: 'iliocostalis',
    INFRASPINATUS: 'infraspinatus',
    INTERCOSTALS: 'intercostals',
    LATERAL_DELTOID: 'lateral_deltoid',
    LATS: 'lats',
    LEGS: 'legs',
    LEVATOR_SCAPULAE: 'levator_scapulae',
    LONGISSIMUS: 'longissimus',
    LOWER_TRAPS: 'lower_traps',
    LUMBRICALS: 'lumbricals',
    MIDDLE_TRAPS: 'middle_traps',
    MULTIFIDUS: 'multifidus',
    NECK: 'neck',
    OBLIQUES: 'obliques',
    PALMARIS_LONGUS: 'palmaris_longus',
    PECTINEUS: 'pectineus',
    PERONEALS: 'peroneals',
    POPLITEUS: 'popliteus',
    POSTERIOR_DELTOID: 'posterior_deltoid',
    PSOAS_MAJOR: 'psoas_major',
    QUADRICEPS: 'quadriceps',
    RECTUS_ABDOMINIS: 'rectus_abdominis',
    RHOMBOIDS: 'rhomboids',
    ROTATOR_CUFF: 'rotator_cuff',
    SCALENE: 'scalene',
    SERRATUS_ANTERIOR: 'serratus_anterior',
    SERRATUS_POSTERIOR_INFERIOR: 'serratus_posterior_inferior',
    SERRATUS_POSTERIOR_SUPERIOR: 'serratus_posterior_superior',
    SHOULDERS: 'shoulders',
    SPINALIS: 'spinalis',
    STERNOCLEIDOMASTOID: 'sternocleidomastoid',
    SUBOCCIPITALS: 'suboccipitals',
    SUBSCAPULARIS: 'subscapularis',
    TENSOR_FASCIAE_LATAE: 'tensor_fasciae_latae',
    TERES_MAJOR: 'teres_major',
    TERES_MINOR: 'teres_minor',
    THORACIC_DIAPHRAGM: 'thoracic_diaphragm',
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
