import { EXERCISE_TYPES, MUSCLE_GROUPS } from '@/constants/exercises';
import { NUTRITION_TYPES } from '@/constants/nutrition';
import {
    ExerciseTypesType,
    ExerciseVolumeSetType,
    ExerciseVolumeType,
    MuscleGroupType,
    ParsedExerciseTypeWithSets,
    ParsedPastNutrition,
    ParsedRecentWorkout,
    ParsedUserMetrics,
    SetReturnType,
} from '@/utils/types';

function isExerciseTypesType(value: any): value is ExerciseTypesType {
    return Object.values(EXERCISE_TYPES).includes(value);
}

function isExerciseTypeWithSets(obj: any): obj is ParsedExerciseTypeWithSets {
    return isExerciseVolumeType(obj)
        && isMuscleGroupType((obj as unknown as ParsedExerciseTypeWithSets).muscleGroup)
        && typeof (obj as unknown as ParsedExerciseTypeWithSets).name === 'string'
        && isExerciseTypesType((obj as unknown as ParsedExerciseTypeWithSets).type);
}

function isExerciseVolumeSetType(obj: any): obj is ExerciseVolumeSetType {
    return isSetType(obj)
        && (typeof (obj as ExerciseVolumeSetType).targetReps === 'number' || (obj as ExerciseVolumeSetType).targetReps === undefined)
        && (typeof (obj as ExerciseVolumeSetType).targetWeight === 'number' || (obj as ExerciseVolumeSetType).targetWeight === undefined);
}

function isExerciseVolumeType(obj: any): obj is Omit<ExerciseVolumeType, 'exerciseId'> {
    return typeof obj === 'object'
        && Array.isArray(obj.sets)
        && obj.sets.every(isExerciseVolumeSetType);
}

function isMuscleGroupType(value: any): value is MuscleGroupType {
    return Object.values(MUSCLE_GROUPS).includes(value);
}

function isParsedPastNutrition(obj: any): obj is ParsedPastNutrition {
    return typeof obj === 'object'
        && typeof obj.calories === 'number'
        && typeof obj.carbs === 'number'
        && (typeof obj.cholesterol === 'number' || obj.cholesterol === undefined)
        && typeof obj.date === 'string'
        && typeof obj.type === 'string'
        && Object.values(NUTRITION_TYPES).includes(obj.type)
        && typeof obj.fat === 'number'
        && (typeof obj.fat_saturated === 'number' || obj.fat_saturated === undefined)
        && (typeof obj.fat_unsaturated === 'number' || obj.fat_unsaturated === undefined)
        && (typeof obj.fiber === 'number' || obj.fiber === undefined)
        && (typeof obj.potassium === 'number' || obj.potassium === undefined)
        && typeof obj.protein === 'number'
        && (typeof obj.sodium === 'number' || obj.sodium === undefined)
        && (typeof obj.sugar === 'number' || obj.sugar === undefined);
}

function isParsedRecentWorkout(obj: any): obj is ParsedRecentWorkout {
    return typeof obj === 'object'
        && typeof obj.date === 'string'
        && (typeof obj.description === 'string' || obj.description === undefined)
        && (typeof obj.duration === 'string' || typeof obj.duration === 'number')
        && Array.isArray(obj.exercises)
        && obj.exercises.every(isExerciseTypeWithSets)
        && typeof obj.title === 'string';
}

function isSetType(obj: any): obj is Omit<SetReturnType, 'exerciseId'> {
    return typeof obj === 'object'
        && (typeof obj.createdAt === 'string' || obj.createdAt === undefined)
        && (typeof obj.deletedAt === 'string' || obj.deletedAt === undefined)
        && (typeof obj.difficultyLevel === 'number' || obj.difficultyLevel === undefined)
        && (typeof obj.id === 'number' || obj.id === undefined)
        && (typeof obj.isDropSet === 'boolean' || obj.isDropSet === undefined)
        && typeof obj.reps === 'number'
        && typeof obj.restTime === 'number'
        && typeof obj.weight === 'number';
}

export const validateParsedRecentWorkouts = (data: any[]): data is ParsedRecentWorkout[] => {
    return Array.isArray(data) && data.every(isParsedRecentWorkout);
};

export const validateParsedPastNutritionArray = (data: any[]): data is ParsedPastNutrition[] => {
    return Array.isArray(data) && data.every(isParsedPastNutrition);
};

function isParsedUserMetrics(obj: any): obj is ParsedUserMetrics {
    return typeof obj === 'object'
        && typeof obj.date === 'string'
        && (typeof obj.fatPercentage === 'number' || obj.fatPercentage === undefined)
        && (typeof obj.height === 'number' || obj.height === undefined)
        && (typeof obj.weight === 'number' || obj.weight === undefined);
}

export const validateParsedUserMetricsArray = (data: any[]): data is ParsedUserMetrics[] => {
    return Array.isArray(data) && data.every(isParsedUserMetrics);
};
