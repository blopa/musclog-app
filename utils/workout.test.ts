import { ACTIVITY_LEVELS, EXERCISE_TYPES, EXPERIENCE_LEVELS } from '@/constants/exercises';
import { EATING_PHASES } from '@/constants/nutrition';
import {
    addSet,
    getExerciseById,
    getLatestUserMetrics,
    getSetById,
    getSetsByWorkoutId,
    getUser,
    updateSet,
} from '@/utils/database';
import {
    EatingPhaseType,
    SetReturnType,
    UserReturnType,
    WorkoutEventReturnType,
    WorkoutReturnType,
} from '@/utils/types';

import {
    calculate1RM,
    calculateAverage1RM,
    calculateNextWorkoutRepsAndSets,
    calculateWorkoutVolume,
} from './workout';

jest.mock('@/utils/database', () => ({
    addSet: jest.fn(),
    getExerciseById: jest.fn(),
    getLatestUserMetrics: jest.fn(),
    getSetById: jest.fn(),
    getSetsByIdsAndExerciseId: jest.fn(),
    getSetsByWorkoutId: jest.fn(),
    getUser: jest.fn(),
    updateSet: jest.fn(),
}));

jest.mock('@/utils/date', () => ({
    formatDate: jest.fn(),
    getNextDayOfWeekDate: jest.fn(),
}));

jest.mock('@/lang/lang', () => ({
    t: jest.fn((key: string) => key),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    removeItem: jest.fn(),
    setItem: jest.fn(),
}));

describe('Workout Utils Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('calculate1RM with Epley formula', () => {
        expect(calculate1RM(100, 10, 'Epley')).toBeCloseTo(133.33, 2);
    });

    test('calculate1RM with invalid formula', () => {
        expect(calculate1RM(100, 10, 'Invalid')).toBeNull();
    });

    test('calculateAverage1RM', () => {
        expect(calculateAverage1RM(100, 10)).toBeCloseTo(128.26, 2);
    });

    test('calculateWorkoutVolume with body weight exercise', async () => {
        (getExerciseById as jest.Mock).mockResolvedValue({ type: EXERCISE_TYPES.BODY_WEIGHT });
        (getLatestUserMetrics as jest.Mock).mockResolvedValue({ weight: 70 });

        const exercises = [
            { exerciseId: 1, sets: [{ reps: 10, weight: 0 }] as SetReturnType[] },
        ];

        const volume = await calculateWorkoutVolume(exercises);
        expect(volume).toBeCloseTo(89.78, 2);
    });

    test('calculateWorkoutVolume with weighted exercise', async () => {
        (getExerciseById as jest.Mock).mockResolvedValue({ type: EXERCISE_TYPES.COMPOUND });

        const exercises = [
            { exerciseId: 1, sets: [{ reps: 10, weight: 100 }] as SetReturnType[] },
        ];

        const volume = await calculateWorkoutVolume(exercises);
        expect(volume).toBeCloseTo(128.26, 2);
    });

    describe('calculateNextWorkoutRepsAndSets', () => {
        const workout: WorkoutReturnType = {
            createdAt: '2023-01-01T00:00:00Z',
            deletedAt: undefined,
            description: 'Test Description',
            id: 1,
            title: 'Test Workout',
            volumeCalculationType: '',
        };

        const pastWorkouts: WorkoutEventReturnType[] = [
            {
                createdAt: '2023-01-10T00:00:00Z',
                date: '2023-01-10T00:00:00Z',
                deletedAt: undefined,
                description: '',
                exerciseData: '',
                id: 1,
                recurringOnWeek: undefined,
                status: 'completed',
                title: 'Test Workout 1',
                workoutId: 1,
            },
            {
                createdAt: '2023-01-15T00:00:00Z',
                date: '2023-01-15T00:00:00Z',
                deletedAt: undefined,
                description: '',
                exerciseData: '',
                id: 2,
                recurringOnWeek: undefined,
                status: 'completed',
                title: 'Test Workout 2',
                workoutId: 1,
            },
        ];

        const sets: SetReturnType[] = [
            {
                createdAt: '2023-01-01T00:00:00Z',
                deletedAt: undefined,
                exerciseId: 1,
                id: 1,
                isDropSet: false,
                reps: 10,
                restTime: 60,
                setOrder: 0,
                weight: 50,
                workoutId: 1,
            },
            {
                createdAt: '2023-01-01T00:00:00Z',
                deletedAt: undefined,
                exerciseId: 1,
                id: 2,
                isDropSet: false,
                reps: 10,
                restTime: 60,
                setOrder: 1,
                weight: 50,
                workoutId: 1,
            },
        ];

        const user: UserReturnType = {
            activityLevel: ACTIVITY_LEVELS.SEDENTARY,
            birthday: '1990-01-01',
            createdAt: '2023-01-01T00:00:00Z',
            deletedAt: undefined,
            fitnessGoals: 'build muscle',
            gender: 'male',
            id: 1,
            liftingExperience: EXPERIENCE_LEVELS.BEGINNER,
            name: 'Test User',
        };

        const userMetrics = {
            date: '2023-01-01T00:00:00Z',
            eatingPhase: EATING_PHASES.BULKING as EatingPhaseType,
            fatPercentage: 15,
            height: 175,
            latestId: 1,
            source: 'user',
            weight: 70,
        };

        beforeEach(() => {
            (getUser as jest.Mock).mockResolvedValue({ ...user, metrics: userMetrics });
            (getSetsByWorkoutId as jest.Mock).mockResolvedValue(sets);
            (getSetById as jest.Mock).mockResolvedValue(sets[0]);
        });

        test('should calculate next workout reps and sets for beginner bulking', async () => {
            await calculateNextWorkoutRepsAndSets(workout, pastWorkouts);

            expect(updateSet).toHaveBeenCalledTimes(2);
            expect(addSet).toHaveBeenCalledTimes(0);
        });

        test('should calculate next workout reps and sets for intermediate bulking', async () => {
            user.liftingExperience = EXPERIENCE_LEVELS.INTERMEDIATE;
            await calculateNextWorkoutRepsAndSets(workout, pastWorkouts);

            expect(updateSet).toHaveBeenCalledTimes(2);
            expect(addSet).toHaveBeenCalledTimes(0);
        });

        test('should not modify sets for cutting', async () => {
            userMetrics.eatingPhase = EATING_PHASES.CUTTING;
            await calculateNextWorkoutRepsAndSets(workout, pastWorkouts);

            expect(updateSet).toHaveBeenCalledTimes(0);
            expect(addSet).toHaveBeenCalledTimes(0);
        });

        test('should calculate next workout reps and sets for advanced maintenance', async () => {
            user.liftingExperience = EXPERIENCE_LEVELS.ADVANCED;
            userMetrics.eatingPhase = EATING_PHASES.MAINTENANCE;
            await calculateNextWorkoutRepsAndSets(workout, pastWorkouts);

            expect(updateSet).toHaveBeenCalledTimes(2);
            expect(addSet).toHaveBeenCalledTimes(0);
        });
    });
});
