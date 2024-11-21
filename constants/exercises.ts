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

/* eslint-disable sort-imports */
/* eslint-disable import/first */
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
/* eslint-enable sort-imports */
/* eslint-enable import/first */
/* eslint-enable perfectionist/sort-objects */

export const VOLUME_CALCULATION_TYPES_VALUES = Object.values(VOLUME_CALCULATION_TYPES);

export const ACTIVITY_LEVELS_VALUES = Object.values(ACTIVITY_LEVELS);

export const EXPERIENCE_LEVELS_VALUES = Object.values(EXPERIENCE_LEVELS);
