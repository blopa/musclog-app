import { Permission } from 'react-native-health-connect/lib/typescript/types';

export const NEEDED_PERMISSIONS = [
    // "android.permission.health.READ_ACTIVE_CALORIES_BURNED"
    // { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
    { accessType: 'read', recordType: 'BodyFat' },
    // "android.permission.health.READ_HEART_RATE"
    // { accessType: 'read', recordType: 'HeartRate' },
    { accessType: 'read', recordType: 'Height' },
    // "android.permission.health.READ_LEAN_BODY_MASS"
    // { accessType: 'read', recordType: 'LeanBodyMass' },
    { accessType: 'read', recordType: 'Nutrition' },
    { accessType: 'write', recordType: 'Nutrition' },
    // "android.permission.health.READ_STEPS_CADENCE"
    // { accessType: 'read', recordType: 'StepsCadence' },
    // "android.permission.health.READ_STEPS"
    // { accessType: 'read', recordType: 'Steps' },
    { accessType: 'read', recordType: 'TotalCaloriesBurned' },
    { accessType: 'read', recordType: 'Weight' },
    // TODO enable when menstrual tracking is implemented:
    // "android.permission.health.READ_MENSTRUATION",
    // "android.permission.health.READ_INTERMENSTRUAL_BLEEDING",
    // "android.permission.health.READ_OVULATION_TEST",
    // { accessType: 'read', recordType: 'MenstruationFlow' },
    // { accessType: 'read', recordType: 'MenstruationPeriod' },
    // { accessType: 'read', recordType: 'OvulationTest' },
    // "android.permission.health.READ_BASAL_METABOLIC_RATE"
    // { accessType: 'read', recordType: 'BasalMetabolicRate' },
    // { accessType: 'read', recordType: 'DataHistory' }, // TODO what is the type of this record?
] as Permission[];

export const MANDATORY_PERMISSIONS: string[] = [
    'Height',
    'Weight',
    'BodyFat',
    'Nutrition',
    'TotalCaloriesBurned',
] as const;

export const USER_METRICS_SOURCES = {
    HEALTH_CONNECT: 'health_connect',
    USER_INPUT: 'user_input',
} as const;

// between 0.25% and 0.5% of body weight per week
export const BULKING_GAIN_WEIGHT_RATIO = [0.0025, 0.005];

// between 0.5% and 1% of body weight per week
export const CUTTING_LOSS_WEIGHT_RATIO = [0.005, 0.01];

export const CALORIES_IN_FAT = 9;

export const CALORIES_IN_ALCOHOL = 7;

export const CALORIES_IN_CARBS = 4;

export const CALORIES_IN_PROTEIN = 4;

export const CALORIES_IN_FIBER = 2;

export const DEFAULT_PAGE_SIZE = 5000; // arbitrary number to get records from last 30 days
