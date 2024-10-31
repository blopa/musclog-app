import { VOLUME_CALCULATION_TYPES } from '@/constants/exercises';
import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { EATING_PHASES, NUTRITION_TYPES } from '@/constants/nutrition';
import { COMPLETED_STATUS } from '@/constants/storage';
import i18n from '@/lang/lang';
import { getCurrentTimestamp } from '@/utils/date';
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
    WorkoutExerciseInsertType,
    WorkoutExerciseReturnType,
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
    addWorkoutEvent: (event: any) => Promise<number>;
    addWorkoutExercise: (exercise: WorkoutExerciseInsertType) => Promise<number>;
    addWorkoutWithExercises: (workout: WorkoutInsertType, exercises: WorkoutExerciseInsertType[]) => Promise<number>;
    countChatMessages: () => Promise<number>;
    countExercises: () => Promise<number>;
    getAllExercises: () => Promise<ExerciseReturnType[]>;
    getAllWorkoutsWithTrashed: () => Promise<WorkoutReturnType[]>;
    getExerciseById: (id: number) => Promise<ExerciseReturnType | undefined>;
    getSetById: (id: number) => Promise<SetReturnType | null | undefined>;
    getSetsByIds: (ids: number[]) => Promise<SetReturnType[]>;
    getUser: () => Promise<any>;
    getWorkoutByIdWithTrashed: (id: number) => Promise<WorkoutReturnType | undefined>;
    getWorkoutExerciseByWorkoutIdAndExerciseId: (workoutId: number, exerciseId: number) => Promise<WorkoutExerciseReturnType | undefined>;
    getWorkoutExercisesByWorkoutId: (workoutId: number) => Promise<WorkoutExerciseReturnType[]>;
    updateSet: (id: number, set: SetInsertType) => Promise<number>;
    updateWorkout: (id: number, workout: WorkoutInsertType) => Promise<number>;
    updateWorkoutExercise: (id: number, workoutExercise: WorkoutExerciseInsertType) => Promise<number>;
}

export const getCommonFunctions = ({
    addChatRaw,
    addExercise,
    addSet,
    addSetting,
    addUserMetrics,
    addUserNutrition,
    addWorkoutEvent,
    addWorkoutExercise,
    addWorkoutWithExercises,
    countChatMessages,
    countExercises,
    getAllExercises,
    getAllWorkoutsWithTrashed,
    getExerciseById,
    getSetById,
    getSetsByIds,
    getUser,
    getWorkoutByIdWithTrashed,
    getWorkoutExerciseByWorkoutIdAndExerciseId,
    getWorkoutExercisesByWorkoutId,
    updateSet,
    updateWorkout,
    updateWorkoutExercise,
}: CommonFunctionsParams) => {
    const createFirstChat = async (): Promise<boolean> => {
        try {
            const count = await countChatMessages();
            if (count === 0) {
                const user = await getUser();
                const userName = user?.name ? user.name : i18n.t('default_name');
                const fitnessGoalMessage = user?.fitnessGoals ? i18n.t('goal_message', { fitnessGoals: i18n.t(user?.fitnessGoals) }) : '';

                await addChatRaw({
                    createdAt: getCurrentTimestamp(),
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
            // await createFirstChat();
            return await addChatRaw(chat);
        } catch (error) {
            console.error('Error adding chat:', error);
            throw error;
        }
    };

    const findExistingWorkout = async (allExistingWorkouts: WorkoutReturnType[], workoutExercises: WorkoutExerciseInsertType[]) => {
        try {
            const existingWorkoutExercisesId = workoutExercises.map((ex) => ex.exerciseId);

            for (const existingWorkout of allExistingWorkouts) {
                // TODO: get all the sets and then all exercises from sets
                const exercises = [] as ExerciseReturnType[];
                const exerciseIds = exercises.map((e) => e.id);

                const containsAll = existingWorkoutExercisesId.every((id) => exerciseIds.includes(id));
                if (containsAll) {
                    return existingWorkout;
                }
            }

            return undefined;
        } catch (error) {
            console.error('Error finding existing workout:', error);
            throw error;
        }
    }

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
                const workoutExercises: WorkoutExerciseInsertType[] = [];

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
                    const setIds: number[] = [];
                    for (const set of exercise.sets) {
                        const setId = await addSet({
                            createdAt: parsedWorkout.date,
                            difficultyLevel: 5,
                            exerciseId: exerciseId!,
                            isDropSet: false,
                            reps: set.reps,
                            restTime: 60,
                            weight: set.weight,
                            setOrder: 0, // TODO: fix this?
                            workoutId: 0, // TODO: fix this?
                            supersetName: '', // TODO: fix this?
                        });
                        setIds.push(setId);
                    }

                    workoutExercises.push({
                        createdAt: parsedWorkout.date,
                        exerciseId: exerciseId!,
                        order: workoutExercises.length,
                        setIds,
                        workoutId: 0,
                    });
                }

                let existingWorkout = await findExistingWorkout(allExistingWorkouts, workoutExercises);
                const foundWorkout = !!existingWorkout;

                if (!foundWorkout) {
                    const workoutId = await addWorkoutWithExercises({
                        createdAt: getCurrentTimestamp(),
                        // deletedAt: getCurrentTimestamp(),
                        description: parsedWorkout.description || '',
                        title: parsedWorkout.title,
                        volumeCalculationType: VOLUME_CALCULATION_TYPES.NONE,
                    }, workoutExercises);

                    existingWorkout = await getWorkoutByIdWithTrashed(workoutId);
                }

                const user = await getUser();
                await addWorkoutEvent({
                    // TODO: get the weight from the date of the workout
                    bodyWeight: user?.metrics.weight || 0,
                    createdAt: getCurrentTimestamp(),
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
            for (const workout of workoutVolume) {
                const { exercises } = workout;

                const processedSetIds = new Set<number>();

                for (const exercise of exercises) {
                    const { sets } = exercise;

                    let workoutExercise: WorkoutExerciseReturnType | undefined;
                    if (workoutId) {
                        workoutExercise = await getWorkoutExerciseByWorkoutIdAndExerciseId(
                            workoutId,
                            exercise.exerciseId
                        );
                    }

                    const newSetIds: number[] = [];
                    for (const set of sets) {
                        const originalSet = await getSetById(set.setId);

                        if (originalSet && !processedSetIds.has(set.setId)) {
                            const updatedSet: SetInsertType = {
                                exerciseId: originalSet.exerciseId,
                                isDropSet: set.isDropSet !== undefined ? set.isDropSet : originalSet.isDropSet,
                                reps: set.reps || originalSet.reps,
                                restTime: set.restTime || originalSet.restTime,
                                weight: set.weight || originalSet.weight,
                                setOrder: set.setOrder || originalSet.setOrder,
                                workoutId: set.workoutId || originalSet.workoutId,
                                supersetName: set.supersetName || originalSet.supersetName,
                            };

                            await updateSet(set.setId, updatedSet);
                            processedSetIds.add(set.setId);
                        } else {
                            const newSet: SetInsertType = {
                                exerciseId: exercise.exerciseId,
                                isDropSet: set.isDropSet || false,
                                reps: set.reps,
                                restTime: set.restTime || 0,
                                weight: set.weight,
                                setOrder: set.setOrder,
                                workoutId: set.workoutId,
                                supersetName: set.supersetName,
                            };

                            const newSetId = await addSet(newSet);
                            newSetIds.push(newSetId);
                        }
                    }

                    if (workoutExercise) {
                        workoutExercise.setIds = workoutExercise.setIds.concat(newSetIds);
                        await updateWorkoutExercise(workoutExercise.id!, workoutExercise);
                    } else if (workoutId) {
                        const newWorkoutExercise: WorkoutExerciseInsertType = {
                            exerciseId: exercise.exerciseId,
                            order: 0,
                            setIds: newSetIds,
                            workoutId: workoutId,
                        };

                        await addWorkoutExercise(newWorkoutExercise);
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
            const workoutExercises = await getWorkoutExercisesByWorkoutId(workoutId);

            return await Promise.all(
                workoutExercises.map(async (workoutExercise) => {
                    const exercise = await getExerciseById(workoutExercise.exerciseId);
                    const sets = await getSetsByIds(workoutExercise.setIds);
                    return { ...exercise!, sets };
                })
            );
        } catch (error) {
            console.error('Error getting exercises with sets from workout:', error);
            throw error;
        }
    };

    const seedInitialData = async (): Promise<void> => {
        // TODO: do we still need this?
    };

    const processUserMetrics = async (parsedUserMetrics: ParsedUserMetrics[]): Promise<void> => {
        try {
            for (const metric of parsedUserMetrics) {
                await addUserMetrics({
                    createdAt: getCurrentTimestamp(),
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
        fullDay = true,
    ) => {
        try {
            if (fullDay) {
                const reducedNutrition = parsedNutrition.reduce((acc: {
                    [key: string]: UserNutritionInsertType;
                }, curr) => {
                    const date = new Date(curr.date).toISOString().split('T')[0];
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
                        createdAt: new Date(nutrition.date).toISOString().split('T')[0],
                        dataId: nutrition.dataId,
                        date: nutrition.date,
                        fat: nutrition.fat,
                        name: nutrition.name,
                        protein: nutrition.protein,
                        source: USER_METRICS_SOURCES.USER_INPUT,
                        type: NUTRITION_TYPES.FULL_DAY,
                        userId: 1, // TODO: user ID is always 1 for now
                    });
                }
            } else {
                for (const curr of parsedNutrition) {
                    await addUserNutrition({
                        calories: Number(curr.calories),
                        carbohydrate: Number(curr.carbs),
                        createdAt: new Date(curr.date).toISOString().split('T')[0],
                        dataId: generateHash(),
                        date: curr.date,
                        fat: Number(curr.fat),
                        name: curr.name || i18n.t('meal'),
                        protein: Number(curr.protein),
                        source: USER_METRICS_SOURCES.USER_INPUT,
                        type: NUTRITION_TYPES.MEAL,
                        userId: 1, // TODO: user ID is always 1 for now
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
