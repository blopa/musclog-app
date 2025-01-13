import { EXERCISE_TYPES, EXPERIENCE_LEVELS } from '@/constants/exercises';
import { EATING_PHASES } from '@/constants/nutrition';
import {
    COUNTDOWN_START_TIME,
    CURRENT_EXERCISE_INDEX,
    CURRENT_WORKOUT_ID,
    CURRENT_WORKOUT_PROGRESS,
    EXERCISE_REPLACEMENTS,
    IMPERIAL_SYSTEM,
    KILOGRAMS,
    SCHEDULED_STATUS,
    WORKOUT_START_TIME,
} from '@/constants/storage';
import i18n from '@/lang/lang';
import {
    addWorkoutEvent,
    getAllWorkouts,
    getExerciseById,
    getRecentWorkoutsBetweenDates,
    getSetsByWorkoutId,
    getUpcomingWorkoutsByWorkoutId,
    getUser,
    updateSet,
} from '@/utils/database';
import {
    formatDate,
    getCurrentTimestampISOString,
    getDaysAgoTimestampISOString,
    getNextDayOfWeekDate,
} from '@/utils/date';
import {
    ExerciseVolumeType,
    SetReturnType,
    WorkoutEventReturnType,
    WorkoutReturnType,
} from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function calculate1RM(weight: number, reps: number, formula: string, rir: number = 0) {
    const adjustedReps = reps + rir;
    try {
        switch (formula) {
            case 'Brzycki': {
                return weight / (1.0278 - 0.0278 * adjustedReps);
            }
            case 'Epley': {
                return weight * (1 + adjustedReps / 30);
            }
            case 'Lander': {
                return weight / (1.013 - 0.0267123 * adjustedReps);
            }
            case 'Lombardi': {
                return weight * Math.pow(adjustedReps, 0.10);
            }
            case 'Mayhew': {
                return weight / (0.522 + 0.419 * Math.exp(-0.055 * adjustedReps));
            }
            case 'OConner': {
                return weight * (1 + 0.025 * adjustedReps);
            }
            case 'Wathan': {
                return weight / (0.488 + 0.539 * Math.exp(-0.035 * adjustedReps));
            }
            default: {
                return null;
            }
        }
    } catch (error) {
        console.error('Error calculating 1RM:', error);
        throw error;
    }
}

export function calculateAverage1RM(weight: number, reps: number, rir: number = 0) {
    try {
        const formulas = ['Epley', 'Brzycki', 'Lander', 'Lombardi', 'Mayhew', 'OConner', 'Wathan'];
        let total1RM = 0;
        let validFormulas = 0;

        formulas.forEach((formula) => {
            const oneRM = calculate1RM(weight, reps, formula, rir);
            if (oneRM) {
                total1RM += oneRM;
                validFormulas++;
            }
        });

        return total1RM / validFormulas;
    } catch (error) {
        console.error('Error calculating average 1RM:', error);
        throw error;
    }
}

export async function calculateWorkoutVolume(
    exercises: { exerciseId: number, sets: SetReturnType[] }[],
    bodyWeight: number = 0
): Promise<number> {
    try {
        let totalVolume = 0;

        for (const { exerciseId, sets } of exercises) {
            const exercise = await getExerciseById(exerciseId);
            let addedWeight = 0;

            if (exercise?.type === EXERCISE_TYPES.BODY_WEIGHT) {
                addedWeight = bodyWeight || 0;
            }

            for (const set of sets) {
                totalVolume += calculateAverage1RM((set.weight + addedWeight), set.reps);
            }
        }

        return Math.round(totalVolume * 100) / 100;
    } catch (error) {
        console.error('Error calculating workout volume:', error);
        throw error;
    }
}

export const scheduleNextWorkout = async () => {
    try {
        const workouts = await getAllWorkouts();
        const recurringWorkouts = workouts.filter((workout) => workout.recurringOnWeek);
        const dateFormat = 'yyyy-MM-dd';

        for (const workout of recurringWorkouts) {
            const workoutEvents = await getUpcomingWorkoutsByWorkoutId(workout.id!);
            const nextWeekDay = getNextDayOfWeekDate(workout.recurringOnWeek!);
            const date = formatDate(nextWeekDay.toISOString(), dateFormat);

            if (!workoutEvents.some((event) => formatDate(event.date, dateFormat) === date)) {
                await addWorkoutEvent({
                    date: new Date(nextWeekDay).toISOString(),
                    description: workout.description || '',
                    duration: 0,
                    exerciseData: '[]',
                    recurringOnWeek: workout.recurringOnWeek,
                    status: SCHEDULED_STATUS,
                    title: workout.title || i18n.t('scheduled_workout'),
                    workoutId: workout.id!,
                });
            }
        }
    } catch (error) {
        console.error('Error scheduling next workout:', error);
        throw error;
    }
};

export const resetWorkoutStorageData = async () => {
    try {
        await AsyncStorage.multiRemove([
            CURRENT_EXERCISE_INDEX,
            CURRENT_WORKOUT_ID,
            EXERCISE_REPLACEMENTS,
            CURRENT_WORKOUT_PROGRESS,
            WORKOUT_START_TIME,
            COUNTDOWN_START_TIME,
        ]);
    } catch (error) {
        console.error('Error resetting workout storage data:', error);
        throw error;
    }
};

export const generateWorkoutSummary = async (
    recentWorkout: WorkoutEventReturnType,
    exerciseVolumeData: ExerciseVolumeType[],
    workoutVolume: number,
    unitSystem: string,
    weightUnit: string
) => {
    try {
        const isImperial = unitSystem === IMPERIAL_SYSTEM;
        const workoutDate = formatDate(recentWorkout.date);

        const workoutVolumeText = workoutVolume > 0 ? i18n.t('workout_volume_text', {
            volume: getDisplayFormattedWeight(workoutVolume, KILOGRAMS, isImperial),
            weightUnit,
        }) : '';

        const totalSets = exerciseVolumeData.reduce((sum, exercise) => sum + exercise.sets.length, 0);
        const exercisesText = await getExerciseVolumeText(exerciseVolumeData);

        return i18n.t('workout_summary', {
            date: workoutDate,
            exercises: exercisesText,
            sets: totalSets,
            title: recentWorkout.title,
            volumeText: workoutVolumeText,
        });
    } catch (error) {
        console.error('Error generating workout summary:', error);
        throw error;
    }
};

type SetsDoneThisWeek = {
    [exerciseId: number]: number;
};

export async function calculateNextWorkoutRepsAndSets(
    workout: WorkoutReturnType,
    pastWorkouts: WorkoutEventReturnType[]
): Promise<WorkoutReturnType> {
    try {
        // Sort past workouts by date and take the most recent 5
        const sortedWorkouts = pastWorkouts
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);

        // Get all sets for the current workout
        const sets = await getSetsByWorkoutId(workout.id!);

        // Get unique exercise IDs from the sets
        const exerciseIds = Array.from(new Set(sets.map((set) => set.exerciseId)));

        for (const exerciseId of exerciseIds) {
            // Get sets for the specific exercise
            const exerciseSets = sets.filter((set) => set.exerciseId === exerciseId);

            // Calculate new sets based on past performance
            const [newSets, didUpdate] = await calculateNewSets(
                sortedWorkouts,
                exerciseId,
                exerciseSets
            );

            if (didUpdate) {
                // Update each set in the database
                for (const set of newSets) {
                    await updateSet(set.id!, set);
                }
            }
        }

        return workout;
    } catch (error) {
        console.error('Error calculating next workout reps and sets:', error);
        throw error;
    }
}

async function calculateNewSets(
    sortedWorkouts: WorkoutEventReturnType[],
    exerciseId: number,
    sets: SetReturnType[]
): Promise<[SetReturnType[], boolean]> {
    let didUpdate = false;
    try {
        const user = await getUser();
        const { liftingExperience, metrics } = user!;
        const { eatingPhase } = metrics;

        // Get past sets for the exercise from sorted workouts
        const pastSets = await getPastSetsForExercise(sortedWorkouts, exerciseId);

        if (eatingPhase === EATING_PHASES.BULKING) {
            if (liftingExperience === EXPERIENCE_LEVELS.BEGINNER) {
                for (let i = 0; i < sets.length / 2; i++) {
                    sets[i].reps += 1;
                    didUpdate = true;
                }
            } else if (
                liftingExperience === EXPERIENCE_LEVELS.INTERMEDIATE
                || liftingExperience === EXPERIENCE_LEVELS.ADVANCED
            ) {
                const checkWorkouts = liftingExperience === EXPERIENCE_LEVELS.INTERMEDIATE ? 2 : 4;

                for (let i = 0; i < sets.length; i++) {
                    const pastSetReps = pastSets
                        .slice(-checkWorkouts)
                        .map((set) => set.reps);

                    if (pastSetReps.every((reps) => reps <= sets[i].reps)) {
                        sets[i].reps += 1;
                        didUpdate = true;
                    }
                }
            }
        } else if (eatingPhase === EATING_PHASES.MAINTENANCE || !eatingPhase) {
            const checkWorkouts = liftingExperience === EXPERIENCE_LEVELS.BEGINNER
                ? 2
                : liftingExperience === EXPERIENCE_LEVELS.INTERMEDIATE
                    ? 3
                    : 4;

            for (let i = 0; i < sets.length; i++) {
                const pastSetReps = pastSets
                    .slice(-checkWorkouts)
                    .map((set) => set.reps);

                if (pastSetReps.every((reps) => reps <= sets[i].reps)) {
                    sets[i].reps += 1;
                    didUpdate = true;
                }
            }
        }

        return [sets, didUpdate];
    } catch (error) {
        console.error('Error calculating new sets:', error);
        throw error;
    }
}

async function getExerciseVolumeText(exerciseVolumeData: ExerciseVolumeType[]) {
    try {
        const exerciseVolumePromises = exerciseVolumeData.map(async ({ exerciseId }) => {
            const exercise = await getExerciseById(exerciseId);
            return exercise?.name || '';
        });

        return (await Promise.all(exerciseVolumePromises))
            .filter((exerciseName) => exerciseName)
            .join(', ');
    } catch (error) {
        console.error('Error getting exercise volume text:', error);
        throw error;
    }
}

async function getPastSetsForExercise(
    sortedWorkouts: WorkoutEventReturnType[],
    exerciseId: number
): Promise<SetReturnType[]> {
    try {
        const pastSets: SetReturnType[] = [];
        for (const workoutEvent of sortedWorkouts) {
            // Get all sets for the workout event
            const sets = await getSetsByWorkoutId(workoutEvent.workoutId);
            // Filter sets by the specific exerciseId
            const exerciseSets = sets.filter((set) => set.exerciseId === exerciseId);
            pastSets.push(...exerciseSets);
        }
        return pastSets;
    } catch (error) {
        console.error('Error getting past sets for exercise:', error);
        throw error;
    }
}

// TODO: add charts for this data too
export const getRepsDoneBetweenDates = async (startDate: string, endDate: string) => {
    const recentWorkouts = await getRecentWorkoutsBetweenDates(
        startDate,
        endDate
    );

    const exercisesVolume = recentWorkouts.reduce<ExerciseVolumeType[]>(
        (acc, { exerciseData }) => ([...acc, ...JSON.parse(exerciseData ?? '{}')]), []
    );

    const exerciseReps = exercisesVolume.reduce<SetsDoneThisWeek>((acc, curr) => {
        return {
            ...acc,
            [curr.exerciseId]: (acc[curr.exerciseId] || 0) + curr.sets.reduce(
                (totalReps, set) => totalReps + set.reps, 0
            ),
        };
    }, {});

    const result = {} as { [muscleGroup: string]: number };
    for (const [exerciseId, repsDone] of Object.entries(exerciseReps)) {
        const exercise = await getExerciseById(Number(exerciseId));
        const muscleGroup = exercise?.muscleGroup || 'unset';

        result[muscleGroup] = (result[muscleGroup] || 0) + repsDone;
    }

    return result;
};

export const getSetsDoneBetweenDates = async (startDate: string, endDate: string) => {
    const recentWorkouts = await getRecentWorkoutsBetweenDates(
        startDate,
        endDate
    );

    const exercisesVolume = recentWorkouts.reduce<ExerciseVolumeType[]>(
        (acc, { exerciseData }) => ([...acc, ...JSON.parse(exerciseData ?? '{}')]), []
    );

    const exerciseSets = exercisesVolume.reduce<SetsDoneThisWeek>((acc, curr) => {
        return {
            ...acc,
            [curr.exerciseId]: (acc[curr.exerciseId] || 0) + curr.sets.length,
        };
    }, {});

    const result = {} as { [muscleGroup: string]: number };
    for (const [exerciseId, setsDone] of Object.entries(exerciseSets)) {
        const exercise = await getExerciseById(Number(exerciseId));
        const muscleGroup = exercise?.muscleGroup || 'unset';

        result[muscleGroup] = (result[muscleGroup] || 0) + setsDone;
    }

    return result;
};

export const getSetsDoneThisWeekText = async () => {
    const setsDoneThisWeek = await getSetsDoneBetweenDates(
        getDaysAgoTimestampISOString(7),
        getCurrentTimestampISOString()
    );

    const entries = Object.entries(setsDoneThisWeek);

    if (entries.length === 0) {
        return null;
    }

    // Handle the case where there's only one muscle group
    if (entries.length === 1) {
        const [muscleGroup, setsDone] = entries[0];
        return i18n.t('you_have_completed_sets', {
            setsText: i18n.t('sets_of_muscle_group', {
                muscleGroup: i18n.t(`muscle_groups.${muscleGroup}`).toLowerCase(),
                sets: setsDone,
            }),
        });
    }

    // Extract all except the last item for regular formatting
    const text = entries.slice(0, entries.length - 1)
        .map(([muscleGroup, setsDone]) => i18n.t('sets_of_muscle_group', {
            muscleGroup: i18n.t(`muscle_groups.${muscleGroup}`).toLowerCase(),
            sets: setsDone,
        }));

    // Extract the last item and apply "and_text" to it
    const [lastMuscleGroup, lastSetsDone] = entries.at(-1) as [string, number];
    const lastText = i18n.t('and_text', {
        text: i18n.t('sets_of_muscle_group', {
            muscleGroup: i18n.t(`muscle_groups.${lastMuscleGroup}`).toLowerCase(),
            sets: lastSetsDone,
        }),
    });

    return i18n.t('you_have_completed_sets', {
        setsText: `${text.join(', ')}${lastText}`,
    });
};

