export const NUTRITION_TYPES = {
    FULL_DAY: 'full_day',
    MEAL: 'meal',
} as const;

export const EATING_PHASES = {
    BULKING: 'bulking',
    CUTTING: 'cutting',
    MAINTENANCE: 'maintenance',
} as const;

export const MEAL_TYPE = {
    BREAKFAST: 1,
    DINNER: 3,
    LUNCH: 2,
    SNACK: 4,
    UNKNOWN: 0,
} as const;
