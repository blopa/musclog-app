import { VOLUME_CALCULATION_TYPES } from '@/constants/exercises';
import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { EATING_PHASES, NUTRITION_TYPES } from '@/constants/nutrition';
import { COMPLETED_STATUS } from '@/constants/storage';
import i18n from '@/lang/lang';
import { getCurrentTimestampISOString } from '@/utils/date';
import { generateHash, normalizeName } from '@/utils/string';
import {
    ChatInsertType,
    ExerciseInsertType,
    ExerciseReturnType,
    ExerciseWithSetsType,
    ParsedPastNutrition,
    ParsedRecentWorkout,
    ParsedUserMetrics,
    SetInsertType,
    SetReturnType,
    UserMetricsInsertType,
    UserNutritionInsertType,
    WorkoutInsertType,
    WorkoutReturnType,
    WorkoutVolumeType,
} from '@/utils/types';

interface CommonFunctionsParams {
    addChatRaw: (chat: ChatInsertType) => Promise<number>;
    addExercise: (exercise: ExerciseInsertType) => Promise<number>;
    addSet: (set: SetInsertType) => Promise<number>;
    addSetting: (type: string, value: string) => Promise<number>;
    addUserMetrics: (userMetrics: UserMetricsInsertType) => Promise<number>;
    addUserNutrition: (userNutrition: UserNutritionInsertType) => Promise<number>;
    addWorkout: (workout: WorkoutInsertType) => Promise<number>;
    addWorkoutEvent: (event: any) => Promise<number>;
    countChatMessages: () => Promise<number>;
    countExercises: () => Promise<number>;
    getAllExercises: () => Promise<ExerciseReturnType[]>;
    getAllWorkoutsWithTrashed: () => Promise<WorkoutReturnType[]>;
    getExerciseById: (id: number) => Promise<ExerciseReturnType | undefined>;
    getSetById: (id: number) => Promise<null | SetReturnType | undefined>;
    getSetsByWorkoutId: (workoutId: number) => Promise<SetReturnType[]>;
    getUser: () => Promise<any>;
    getWorkoutByIdWithTrashed: (id: number) => Promise<undefined | WorkoutReturnType>;
    updateSet: (id: number, set: SetInsertType) => Promise<number>;
    updateWorkout: (id: number, workout: WorkoutInsertType) => Promise<number>;
}

export const getCommonFunctions = ({
    addChatRaw,
    addExercise,
    addSet,
    addSetting,
    addUserMetrics,
    addUserNutrition,
    addWorkout,
    addWorkoutEvent,
    countChatMessages,
    countExercises,
    getAllExercises,
    getAllWorkoutsWithTrashed,
    getExerciseById,
    getSetById,
    getSetsByWorkoutId,
    getUser,
    getWorkoutByIdWithTrashed,
    updateSet,
    updateWorkout,
}: CommonFunctionsParams) => {
    const createFirstChat = async (): Promise<boolean> => {
        try {
            const count = await countChatMessages();
            if (count === 0) {
                const user = await getUser();
                const userName = user?.name ? user.name : i18n.t('default_name');
                const fitnessGoalMessage = user?.fitnessGoals ? i18n.t('goal_message', { fitnessGoals: i18n.t(user?.fitnessGoals) }) : '';

                await addChatRaw({
                    createdAt: getCurrentTimestampISOString(),
                    message: `${i18n.t('greeting_message', { name: userName })}${fitnessGoalMessage} ${i18n.t('ending_message')}`,
                    misc: '',
                    sender: 'assistant',
                    type: 'text',
                });

                return true;
            }
            return false;
        } catch (error) {
            console.error('Error creating first chat:', error);
            return false;
        }
    };

    const addChat = async (chat: ChatInsertType): Promise<number> => {
        try {
            return await addChatRaw(chat);
        } catch (error) {
            console.error('Error adding chat:', error);
            throw error;
        }
    };

    const findExistingWorkout = async (
        allExistingWorkouts: WorkoutReturnType[],
        exerciseIds: number[]
    ) => {
        try {
            for (const existingWorkout of allExistingWorkouts) {
                const sets = await getSetsByWorkoutId(existingWorkout.id);
                const existingExerciseIds = Array.from(new Set(sets.map((set) => set.exerciseId)));

                const containsAll = exerciseIds.every((id) => existingExerciseIds.includes(id));
                if (containsAll) {
                    return existingWorkout;
                }
            }

            return undefined;
        } catch (error) {
            console.error('Error finding existing workout:', error);
            throw error;
        }
    };

    const processRecentWorkouts = async (parsedRecentWorkouts: ParsedRecentWorkout[]): Promise<void> => {
        try {
            const existingExercises = await getAllExercises();
            const exerciseMap: { [name: string]: ExerciseReturnType } = {};

            for (const exercise of existingExercises) {
                if (exercise.name) {
                    exerciseMap[normalizeName(exercise.name)] = exercise;
                }
            }

            const allExistingWorkouts = await getAllWorkoutsWithTrashed();

            for (const [index, parsedWorkout] of parsedRecentWorkouts.entries()) {
                const exerciseIds: number[] = [];

                // Get or create exercises
                for (const exercise of parsedWorkout.exercises) {
                    let exerciseId: number | undefined = exerciseMap[normalizeName(exercise.name)]?.id;

                    if (!exerciseId) {
                        exerciseId = await addExercise({
                            description: exercise.name,
                            image: '',
                            muscleGroup: exercise.muscleGroup,
                            name: exercise.name,
                            type: exercise.type,
                        });

                        const newExercise = await getExerciseById(exerciseId);
                        if (newExercise) {
                            exerciseMap[normalizeName(exercise.name)] = newExercise;
                        }
                    }

                    exercise.exerciseId = exerciseId;
                    exerciseIds.push(exerciseId!);
                }

                let existingWorkout = await findExistingWorkout(allExistingWorkouts, exerciseIds);
                const foundWorkout = !!existingWorkout;

                let workoutId: number;
                if (!foundWorkout) {
                    const workoutData: WorkoutInsertType = {
                        createdAt: getCurrentTimestampISOString(),
                        description: parsedWorkout.description || '',
                        title: parsedWorkout.title,
                        volumeCalculationType: VOLUME_CALCULATION_TYPES.NONE,
                    };

                    workoutId = await addWorkout(workoutData);

                    let setOrder = 0;

                    for (const exercise of parsedWorkout.exercises) {
                        const exerciseId = exercise.exerciseId!;
                        // Save sets
                        for (const set of exercise.sets) {
                            await addSet({
                                createdAt: parsedWorkout.date,
                                exerciseId,
                                isDropSet: false, // or as appropriate
                                reps: set.reps,
                                restTime: 60, // or as appropriate
                                setOrder: setOrder++,
                                supersetName: '', // or as appropriate
                                weight: set.weight,
                                workoutId,
                            });
                        }
                    }
                    existingWorkout = await getWorkoutByIdWithTrashed(workoutId);
                } else {
                    workoutId = existingWorkout!.id;
                }

                const user = await getUser();
                await addWorkoutEvent({
                    bodyWeight: user?.metrics.weight || 0,
                    createdAt: getCurrentTimestampISOString(),
                    date: new Date(parsedWorkout.date).toISOString(),
                    description: existingWorkout?.description || '',
                    duration: Number(parsedWorkout.duration) || 60,
                    eatingPhase: user?.metrics.eatingPhase || EATING_PHASES.MAINTENANCE,
                    exerciseData: JSON.stringify(parsedWorkout.exercises),
                    exhaustionLevel: 5,
                    fatPercentage: user?.metrics.fatPercentage || 0,
                    status: COMPLETED_STATUS,
                    title: existingWorkout?.title || parsedWorkout.title || i18n.t('workout') + index,
                    workoutId: existingWorkout?.id!,
                    workoutScore: 5,
                });
            }
        } catch (error) {
            console.error('Error processing recent workouts:', error);
            throw error;
        }
    };

    const updateWorkoutSetsVolume = async (workoutVolume: WorkoutVolumeType[], workoutId?: number): Promise<void> => {
        try {
            if (!workoutId) {
                throw new Error('Workout ID is required to update sets volume');
            }

            for (const workout of workoutVolume) {
                const { exercises } = workout;

                const processedSetIds = new Set<number>();
                let setOrder = 0;

                for (const exercise of exercises) {
                    const { sets } = exercise;

                    for (const set of sets) {
                        if (set.setId && !processedSetIds.has(set.setId)) {
                            const originalSet = await getSetById(set.setId);

                            if (originalSet) {
                                const updatedSet: SetInsertType = {
                                    createdAt: originalSet.createdAt,
                                    exerciseId: originalSet.exerciseId,
                                    isDropSet: set.isDropSet !== undefined ? set.isDropSet : originalSet.isDropSet,
                                    reps: set.reps !== undefined ? set.reps : originalSet.reps,
                                    restTime: set.restTime !== undefined ? set.restTime : originalSet.restTime,
                                    setOrder: originalSet.setOrder,
                                    supersetName: set.supersetName || originalSet.supersetName,
                                    weight: set.weight !== undefined ? set.weight : originalSet.weight,
                                    workoutId: originalSet.workoutId,
                                };

                                await updateSet(set.setId, updatedSet);
                                processedSetIds.add(set.setId);
                            }
                        } else {
                            // New set
                            const newSet: SetInsertType = {
                                createdAt: getCurrentTimestampISOString(),
                                exerciseId: exercise.exerciseId,
                                isDropSet: set.isDropSet || false,
                                reps: set.reps,
                                restTime: set.restTime || 0,
                                setOrder: setOrder++,
                                supersetName: set.supersetName || '',
                                weight: set.weight,
                                workoutId: workoutId!,
                            };

                            await addSet(newSet);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error updating workout sets volume:', error);
            throw error;
        }
    };

    const getExercisesWithSetsFromWorkout = async (workoutId: number): Promise<ExerciseWithSetsType[]> => {
        try {
            const sets = await getSetsByWorkoutId(workoutId);

            // Group sets by exerciseId
            const setsByExerciseId = sets.reduce((acc, set) => {
                if (!acc[set.exerciseId]) {
                    acc[set.exerciseId] = [];
                }
                acc[set.exerciseId].push(set);
                return acc;
            }, {} as { [key: number]: SetReturnType[] });

            const exerciseIds = Object.keys(setsByExerciseId).map(Number);

            return await Promise.all(
                exerciseIds.map(async (exerciseId) => {
                    const exercise = await getExerciseById(exerciseId);
                    const exerciseSets = setsByExerciseId[exerciseId];
                    return { ...exercise!, sets: exerciseSets };
                })
            );
        } catch (error) {
            console.error('Error getting exercises with sets from workout:', error);
            throw error;
        }
    };

    const seedInitialData = async (): Promise<void> => {
        // TODO: Implement if necessary
    };

    const processUserMetrics = async (parsedUserMetrics: ParsedUserMetrics[]): Promise<void> => {
        try {
            for (const metric of parsedUserMetrics) {
                await addUserMetrics({
                    createdAt: getCurrentTimestampISOString(),
                    dataId: generateHash(),
                    date: metric.date,
                    fatPercentage: metric.fatPercentage,
                    height: metric.height,
                    source: USER_METRICS_SOURCES.USER_INPUT,
                    weight: metric.weight,
                });
            }
        } catch (error) {
            console.error('Error processing user metrics:', error);
            throw error;
        }
    };

    const processPastNutrition = async (
        parsedNutrition: ParsedPastNutrition[],
        fullDay = true
    ) => {
        try {
            if (fullDay) {
                const reducedNutrition = parsedNutrition.reduce((acc: {
                    [key: string]: UserNutritionInsertType;
                }, curr) => {
                    const date = new Date(curr.date).toISOString()
                        .split('T')[0];
                    if (!acc[date]) {
                        acc[date] = {
                            calories: 0,
                            carbohydrate: 0,
                            dataId: generateHash(),
                            date: curr.date,
                            fat: 0,
                            name: i18n.t('full_day'),
                            protein: 0,
                            type: NUTRITION_TYPES.FULL_DAY,
                        } as UserNutritionInsertType;
                    }

                    acc[date].calories += Number(curr.calories) || 0;
                    acc[date].carbohydrate += Number(curr.carbs) || 0;
                    acc[date].fat += Number(curr.fat) || 0;
                    acc[date].protein += Number(curr.protein) || 0;

                    return acc;
                }, {});

                for (const nutrition of Object.values(reducedNutrition)) {
                    await addUserNutrition({
                        calories: nutrition.calories,
                        carbohydrate: nutrition.carbohydrate,
                        createdAt: new Date(nutrition.date).toISOString()
                            .split('T')[0],
                        dataId: nutrition.dataId,
                        date: nutrition.date,
                        fat: nutrition.fat,
                        name: nutrition.name,
                        protein: nutrition.protein,
                        source: USER_METRICS_SOURCES.USER_INPUT,
                        type: NUTRITION_TYPES.FULL_DAY,
                        userId: 1, // TODO: Update user ID as appropriate
                    });
                }
            } else {
                for (const curr of parsedNutrition) {
                    await addUserNutrition({
                        calories: Number(curr.calories),
                        carbohydrate: Number(curr.carbs),
                        createdAt: new Date(curr.date).toISOString()
                            .split('T')[0],
                        dataId: generateHash(),
                        date: curr.date,
                        fat: Number(curr.fat),
                        name: curr.name || i18n.t('meal'),
                        protein: Number(curr.protein),
                        source: USER_METRICS_SOURCES.USER_INPUT,
                        type: NUTRITION_TYPES.MEAL,
                        userId: 1, // TODO: Update user ID as appropriate
                    });
                }
            }
        } catch (error) {
            console.error('Error processing past nutrition:', error);
            throw error;
        }
    };

    return {
        addChat,
        createFirstChat,
        getExercisesWithSetsFromWorkout,
        processPastNutrition,
        processRecentWorkouts,
        processUserMetrics,
        seedInitialData,
        updateWorkoutSetsVolume,
    };
};
