import { validateParsedPastNutritionArray, validateParsedRecentWorkouts, validateParsedUserMetricsArray } from '@/utils/validation';

const validParsedRecentWorkout = [{
    date: '2023-06-15T06:35:00Z',
    description: 'description',
    duration: '300',
    exercises: [
        {
            muscleGroup: 'chest',
            name: 'Bench Press',
            sets: [
                {
                    createdAt: '2023-06-15T06:35:00Z',
                    isDropSet: false,
                    reps: 8,
                    restTime: 90,
                    targetReps: 8,
                    targetWeight: 110,
                    weight: 110,
                },
            ],
            type: 'compound',
        },
    ],
    title: 'Chest and Back Day',
}];

const validParsedPastNutrition = [{
    calories: 200,
    carbs: 50,
    cholesterol: 30,
    date: '2023-06-15',
    fat: 10,
    fat_saturated: 5,
    fat_unsaturated: 3,
    fiber: 7,
    potassium: 400,
    protein: 20,
    sodium: 150,
    sugar: 12,
    type: 'meal',
},
{
    calories: 250,
    carbs: 60,
    date: '2023-06-16',
    fat: 12,
    protein: 25,
    type: 'meal',
}];

const validParsedUserMetrics = [{
    date: '2023-06-15',
    fatPercentage: 15,
    height: 180,
    weight: 75,
},
{
    date: '2023-06-16',
    weight: 76,
}];

const invalidParsedRecentWorkout = [{
    date: '2023-06-15T06:35:00Z',
    description: 'description',
    duration: '300',
    exercises: [{
        muscleGroup: 'phone',
        name: 'Bench Press',
        sets: [
            {
                createdAt: '2023-06-15T06:35:00Z',
                isDropSet: false,
                reps: 8,
                restTime: 90,
                targetReps: 8,
                targetWeight: 110,
                weight: 110,
            },
        ],
        type: 'compound',
    }],
    title: 'Chest and Back Day',
}];

const invalidParsedPastNutrition = [{
    calories: 200,
    carbs: 'invalid',
    cholesterol: 30,
    date: '2023-06-15',
    fat: 10,
    fat_saturated: 5,
    fat_unsaturated: 3,
    fiber: 7,
    potassium: 400,
    protein: 20,
    sodium: 150,
    sugar: 12,
    type: 'breakfast',
}];

const invalidParsedUserMetrics = [{
    date: '2023-06-15',
    fatPercentage: 'invalid',
    height: 1.80,
    weight: 75,
},
{
    date: '2023-06-16',
    weight: 'invalid',
}];

describe('Validation Functions', () => {
    test('validateParsedRecentWorkouts with valid data', () => {
        expect(validateParsedRecentWorkouts(validParsedRecentWorkout)).toBe(true);
    });

    test('validateParsedRecentWorkouts with invalid data', () => {
        expect(validateParsedRecentWorkouts(invalidParsedRecentWorkout)).toBe(false);
    });

    test('validateParsedPastNutritionArray with valid data', () => {
        expect(validateParsedPastNutritionArray(validParsedPastNutrition)).toBe(true);
    });

    test('validateParsedPastNutritionArray with invalid data', () => {
        expect(validateParsedPastNutritionArray(invalidParsedPastNutrition)).toBe(false);
    });

    test('validateParsedUserMetricsArray with valid data', () => {
        expect(validateParsedUserMetricsArray(validParsedUserMetrics)).toBe(true);
    });

    test('validateParsedUserMetricsArray with invalid data', () => {
        expect(validateParsedUserMetricsArray(invalidParsedUserMetrics)).toBe(false);
    });
});
