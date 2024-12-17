import { Screen } from '@/components/Screen';
import WorkoutModal from '@/components/WorkoutModal';
import WorkoutSession from '@/components/WorkoutSession';
import { VOLUME_CALCULATION_TYPES } from '@/constants/exercises';
import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { NUTRITION_TYPES } from '@/constants/nutrition';
import {
    AI_SETTINGS_TYPE,
    COMPLETED_STATUS,
    CURRENT_EXERCISE_INDEX,
    CURRENT_WORKOUT_ID,
    CURRENT_WORKOUT_PROGRESS,
    EXERCISE_REPLACEMENTS,
    IMPERIAL_SYSTEM,
    POUNDS,
    WORKOUT_START_TIME,
} from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { useChatData } from '@/storage/ChatProvider';
import { useHealthConnect } from '@/storage/HealthConnectProvider';
import { useSettings } from '@/storage/SettingsContext';
import { useUnreadMessages } from '@/storage/UnreadMessagesProvider';
import { calculateNextWorkoutVolume, getAiApiVendor } from '@/utils/ai';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import {
    addUserNutrition,
    addWorkoutEvent,
    getExerciseById,
    getRecentWorkoutsByWorkoutId,
    getSetById,
    getSetsByWorkoutId,
    getUserNutritionFromDate,
    getWorkoutById,
    updateSet,
    updateWorkoutSetsVolume,
} from '@/utils/database';
import {
    getCurrentTimestampISOString,
    getDaysAgoTimestampISOString,
    getStartOfDayTimestampISOString,
} from '@/utils/date';
import { captureException } from '@/utils/sentry';
import { generateHash } from '@/utils/string';
import {
    CurrentWorkoutExercise,
    CurrentWorkoutProgressType,
    ExerciseReturnType,
    ExerciseVolumeType,
    SetReturnType,
    WorkoutEventInsertType,
    WorkoutReturnType,
} from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';
import { calculateNextWorkoutRepsAndSets, resetWorkoutStorageData } from '@/utils/workout';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationProp } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';

const getCurrentExercises = async (
    originalExercises: CurrentWorkoutExercise[],
    workoutId: number
): Promise<(CurrentWorkoutExercise | undefined)[]> => {
    try {
        const newExercises = originalExercises.map(async (exercise) => {
            return await getCurrentExercise(exercise, workoutId);
        });

        return Promise.all(newExercises);
    } catch (error) {
        console.error('Error fetching current exercise:', error);
        return originalExercises;
    }
};

const getCurrentExercise = async (
    originalExercise: CurrentWorkoutExercise,
    workoutId: number
): Promise<CurrentWorkoutExercise> => {
    try {
        // Fetch replacements from AsyncStorage
        const storedReplacements = await AsyncStorage.getItem(EXERCISE_REPLACEMENTS);
        const replacements = storedReplacements ? JSON.parse(storedReplacements) : {};

        // Check if there's a replacement for the current exercise
        const newExerciseId = replacements[workoutId]?.[originalExercise.id];
        if (newExerciseId) {
            const newExercise = await getExerciseById(newExerciseId);
            if (newExercise) {
                return { ...newExercise, isReplacement: true };
            }

            return originalExercise;
        }

        return originalExercise;
    } catch (error) {
        console.error('Error fetching current exercise:', error);
        return originalExercise;
    }
};

const CurrentWorkout = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const { t } = useTranslation();
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
    const [exercise, setExercise] = useState<CurrentWorkoutExercise | null>(null);
    const [exercises, setExercises] = useState<{ exercise: CurrentWorkoutExercise; sets: SetReturnType[] }[]>([]);
    const [orderedExercises, setOrderedExercises] = useState<{ exercise: CurrentWorkoutExercise; sets: SetReturnType[] }[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [startTime, setStartTime] = useState<null | number>(null);
    const [workoutDuration, setWorkoutDuration] = useState(0);
    const [workout, setWorkout] = useState<undefined | WorkoutReturnType>();
    const [loading, setLoading] = useState(false);
    const [isAiEnabled, setIsAiEnabled] = useState(false);

    const { increaseUnreadMessages } = useUnreadMessages();
    const { addNewChat } = useChatData();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { unitSystem } = useUnit();
    const { getSettingByType } = useSettings();
    const { checkReadIsPermitted, getHealthData } = useHealthConnect();

    useEffect(() => {
        const fetchNewExercisesList = async () => {
            const newExercises = await getCurrentExercises(exercises.map((ex) => ex.exercise), workout?.id || 0);
            setOrderedExercises(
                exercises.map((ex, index) => ({
                    exercise: newExercises[index] || ex.exercise,
                    sets: ex.sets,
                }))
            );
        };

        fetchNewExercisesList();
    }, [exercises, workout?.id]);

    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    const fetchWorkout = useCallback(async () => {
        try {
            setLoading(true);
            const storedWorkoutDayId = await AsyncStorage.getItem(CURRENT_WORKOUT_ID);

            if (storedWorkoutDayId) {
                const workoutId = JSON.parse(storedWorkoutDayId);
                const workout = await getWorkoutById(workoutId);
                setWorkout(workout);

                if (workout) {
                    // Fetch all sets associated with this workout
                    const sets = await getSetsByWorkoutId(workoutId);

                    // Initialize maps to group sets by supersetName and exerciseId
                    const supersetsMap: { [supersetName: string]: { [exerciseId: number]: SetReturnType[] } } = {};
                    const standaloneSetsMap: { [exerciseId: number]: SetReturnType[] } = {};

                    // Group sets into supersets and standalone exercises
                    sets.forEach((set) => {
                        const supersetName = set.supersetName || null;
                        if (supersetName) {
                            if (!supersetsMap[supersetName]) {
                                supersetsMap[supersetName] = {};
                            }

                            if (!supersetsMap[supersetName][set.exerciseId]) {
                                supersetsMap[supersetName][set.exerciseId] = [];
                            }

                            supersetsMap[supersetName][set.exerciseId].push(set);
                        } else {
                            if (!standaloneSetsMap[set.exerciseId]) {
                                standaloneSetsMap[set.exerciseId] = [];
                            }

                            standaloneSetsMap[set.exerciseId].push(set);
                        }
                    });

                    const orderedExercises: { exercise: ExerciseReturnType; sets: SetReturnType[] }[] = [];

                    // Process Supersets: Interleave sets from exercises within the same superset
                    for (const supersetName of Object.keys(supersetsMap)) {
                        const exercisesInSuperset = supersetsMap[supersetName];
                        const exerciseIds = Object.keys(exercisesInSuperset).map((id) => parseInt(id, 10));

                        // Fetch all exercises within the current superset
                        const exercisesData = await Promise.all(
                            exerciseIds.map(async (id) => {
                                const ex = await getExerciseById(id);
                                if (!ex) {
                                    console.warn(`Exercise with id ${id} not found.`);
                                }

                                return ex;
                            })
                        );

                        // Filter out any null or undefined exercises
                        const validExercises = exercisesData.filter(
                            (ex): ex is ExerciseReturnType => ex !== null && ex !== undefined
                        );

                        const sortedValidExercises = validExercises.sort((a, b) => {
                            const aFirstSetOrder = exercisesInSuperset[a.id][0]?.setOrder || 0;
                            const bFirstSetOrder = exercisesInSuperset[b.id][0]?.setOrder || 0;
                            return aFirstSetOrder - bFirstSetOrder;
                        });

                        // Sort sets for each exercise by setOrder
                        const sortedExerciseSets = sortedValidExercises.map((exercise) => ({
                            exercise,
                            sets: exercisesInSuperset[exercise.id].sort((a, b) => a.setOrder - b.setOrder),
                        }));

                        // Determine the maximum number of sets among the exercises in the superset
                        const maxSets = Math.max(...sortedExerciseSets.map((ex) => ex.sets.length));

                        // Interleave sets from each exercise within the superset
                        for (let i = 0; i < maxSets; i++) {
                            sortedExerciseSets.forEach((ex) => {
                                if (i < ex.sets.length) {
                                    orderedExercises.push({
                                        exercise: ex.exercise,
                                        // Each entry has a single set for interleaving
                                        sets: [ex.sets[i]],
                                    });
                                }
                            });
                        }
                    }

                    // Process Standalone Exercises: Add their sets sequentially
                    const standaloneExerciseIds = Object.keys(standaloneSetsMap).map((id) =>
                        parseInt(id, 10)
                    );

                    // Fetch standalone exercises sorted by the earliest setOrder to maintain order
                    const standaloneExercisesData = await Promise.all(
                        standaloneExerciseIds.map(async (id) => {
                            const ex = await getExerciseById(id);
                            if (!ex) {
                                console.warn(`Exercise with id ${id} not found.`);
                            }
                            return ex;
                        })
                    );

                    // Filter out any null or undefined exercises
                    const validStandaloneExercises = standaloneExercisesData.filter(
                        (ex): ex is ExerciseReturnType => ex !== null && ex !== undefined
                    );

                    // Sort standalone exercises by the setOrder of their first set to maintain intended order
                    const sortedStandaloneExercises = validStandaloneExercises
                        .map((exercise) => ({
                            exercise,
                            firstSetOrder: standaloneSetsMap[exercise.id][0]?.setOrder || 0,
                            sets: standaloneSetsMap[exercise.id].sort(
                                (a, b) => a.setOrder - b.setOrder
                            ),
                        }))
                        .sort((a, b) => a.firstSetOrder - b.firstSetOrder)
                        .map(({ exercise, sets }) => ({
                            exercise,
                            sets,
                        }));

                    // Append standalone exercises to the ordered list
                    orderedExercises.push(...sortedStandaloneExercises);

                    // Update the exercises state with the ordered list
                    setExercises(orderedExercises);

                    // Determine the current exercise index from AsyncStorage
                    if (orderedExercises.length > 0) {
                        const storedCurrentIndex = await AsyncStorage.getItem(
                            CURRENT_EXERCISE_INDEX
                        );
                        let currentIndex = storedCurrentIndex
                            ? parseInt(storedCurrentIndex, 10)
                            : 0;

                        // Validate currentIndex to prevent out-of-bounds errors
                        if (currentIndex >= orderedExercises.length) {
                            currentIndex = orderedExercises.length - 1;
                        }

                        if (currentIndex < 0) {
                            currentIndex = 0;
                        }

                        setCurrentExerciseIndex(currentIndex);

                        const currentExercise = orderedExercises[currentIndex];
                        const fetchedExercise = await getCurrentExercise(currentExercise.exercise, workoutId);
                        if (fetchedExercise) {
                            setExercise(fetchedExercise);
                        } else {
                            setExercise(currentExercise.exercise);
                        }

                        // Persist the current exercise index
                        await AsyncStorage.setItem(
                            CURRENT_EXERCISE_INDEX,
                            currentIndex.toString()
                        );
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load exercise day:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const checkAiInsightsAvailability = useCallback(async () => {
        const vendor = await getAiApiVendor();
        const isAiSettingsEnabled = await getSettingByType(AI_SETTINGS_TYPE);

        const hasAiEnabled = Boolean(vendor) && isAiSettingsEnabled?.value === 'true';
        setIsAiEnabled(hasAiEnabled);
    }, [getSettingByType]);

    useFocusEffect(
        useCallback(() => {
            fetchWorkout();
            checkAiInsightsAvailability();
        }, [checkAiInsightsAvailability, fetchWorkout])
    );

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                navigation.navigate('index');
                return true;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => {
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            };
        }, [navigation])
    );

    const handleFinishExercise = useCallback(async (workoutScore?: number, exhaustionLevel?: number) => {
        try {
            const endTime = Date.now();
            const duration = (endTime - startTime!) / 1000;
            setWorkoutDuration(duration);

            if (currentExerciseIndex + 1 < exercises.length) {
                setCurrentExerciseIndex(currentExerciseIndex + 1);

                const nextExercise = exercises[currentExerciseIndex + 1].exercise;
                if (workout?.id) {
                    setExercise(await getCurrentExercise(nextExercise, workout.id) || nextExercise);
                } else {
                    setExercise(nextExercise);
                }

                await AsyncStorage.setItem(CURRENT_EXERCISE_INDEX, (currentExerciseIndex + 1).toString());
            } else {
                // Finish the workout
                // const workoutId = await AsyncStorage.getItem(CURRENT_WORKOUT_ID);
                if (workout) {
                    const existingProgress = await AsyncStorage.getItem(CURRENT_WORKOUT_PROGRESS);
                    const { completed: completedProgress = [], skipped = [] } = JSON.parse(existingProgress || '{}') as CurrentWorkoutProgressType;

                    for (const progress of completedProgress) {
                        if (progress.setId) {
                            const set = await getSetById(progress.setId);

                            if (set) {
                                await updateSet(progress.setId, {
                                    ...set,
                                    difficultyLevel: progress.difficultyLevel || set.difficultyLevel,
                                    reps: progress.reps || set.reps,
                                    weight: getDisplayFormattedWeight(progress.weight, POUNDS, isImperial),
                                });
                            }
                        }
                    }

                    const exerciseData: ExerciseVolumeType[] = [];
                    for (const item of completedProgress) {
                        let exercise = exerciseData.find((ex) => ex.exerciseId === item.exerciseId);

                        if (!exercise) {
                            exercise = {
                                exerciseId: item.exerciseId!,
                                isReplacement: item.isReplacement,
                                sets: [],
                            };

                            exerciseData.push(exercise);
                        }

                        const set = {
                            difficultyLevel: item.difficultyLevel,
                            exerciseId: item.exerciseId!,
                            id: item.setId,
                            isDropSet: item.isDropSet,
                            reps: item.reps,
                            restTime: item.restTime,
                            setId: item.setId,
                            setOrder: item.setOrder,
                            supersetName: item.supersetName,
                            targetReps: item.targetReps,
                            targetWeight: item.targetWeight,
                            unitSystem,
                            weight: item.weight,
                            workoutId: workout.id,
                        };

                        exercise.sets.push(set);
                    }

                    const isPermitted = await checkReadIsPermitted(['Nutrition']);
                    if (isPermitted) {
                        const healthData = await getHealthData(
                            getDaysAgoTimestampISOString(1),
                            getCurrentTimestampISOString(),
                            1000,
                            ['Nutrition']
                        );

                        if (healthData) {
                            const todaysNutrition = healthData.nutritionRecords!.filter(
                                ({ startTime }) => startTime.startsWith(getCurrentTimestampISOString().split('T')[0])
                            );

                            for (const nutrition of todaysNutrition) {
                                await addUserNutrition({
                                    calories: nutrition.energy?.inKilocalories || 0,
                                    carbohydrate: nutrition.totalCarbohydrate?.inGrams || 0,
                                    createdAt: nutrition.startTime,
                                    dataId: nutrition?.metadata?.id || generateHash(),
                                    date: nutrition.startTime,
                                    fat: nutrition?.totalFat?.inGrams || 0,
                                    fiber: nutrition?.dietaryFiber?.inGrams || 0,
                                    monounsaturatedFat: nutrition?.monounsaturatedFat?.inGrams || 0,
                                    name: nutrition?.name || '',
                                    polyunsaturatedFat: nutrition?.polyunsaturatedFat?.inGrams || 0,
                                    protein: nutrition?.protein?.inGrams || 0,
                                    saturatedFat: nutrition?.saturatedFat?.inGrams || 0,
                                    source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                                    sugar: nutrition?.sugar?.inGrams || 0,
                                    transFat: nutrition?.transFat?.inGrams || 0,
                                    type: NUTRITION_TYPES.MEAL,
                                    unsaturatedFat: nutrition?.unsaturatedFat?.inGrams || 0,
                                });
                            }
                        }
                    }

                    const userNutritionFromToday = await getUserNutritionFromDate(
                        getStartOfDayTimestampISOString(getCurrentTimestampISOString())
                    );

                    const totalCarbs = userNutritionFromToday.reduce((acc, item) => acc + item.carbohydrate, 0);
                    const totalCalories = userNutritionFromToday.reduce((acc, item) => acc + item.calories, 0);
                    const totalProteins = userNutritionFromToday.reduce((acc, item) => acc + item.protein, 0);
                    const totalFats = userNutritionFromToday.reduce((acc, item) => acc + item.fat, 0);

                    const recentWorkout: WorkoutEventInsertType = {
                        calories: totalCalories,
                        carbohydrate: totalCarbs,
                        date: getCurrentTimestampISOString(),
                        description: workout.description, // TODO: add option for user to add description
                        duration: Math.floor(duration / 60),
                        exerciseData: JSON.stringify(exerciseData),
                        exhaustionLevel,
                        fat: totalFats,
                        protein: totalProteins,
                        recurringOnWeek: workout.recurringOnWeek,
                        status: COMPLETED_STATUS,
                        title: workout.title,
                        workoutId: workout.id!,
                        workoutScore,
                    };

                    await AsyncStorage.removeItem(CURRENT_WORKOUT_PROGRESS);
                    const recentWorkoutId = await addWorkoutEvent(recentWorkout);

                    const randomNum = Math.floor(Math.random() * 10) + 1;
                    const genericMessageToUser = t(`great_job_on_workout_${randomNum}`);

                    if (isAiEnabled) {
                        await addNewChat({
                            message: '',
                            misc: JSON.stringify({ recentWorkoutId }),
                            sender: 'user',
                            type: 'recentWorkout',
                        });

                        increaseUnreadMessages(1);
                    }

                    if (workout.volumeCalculationType === VOLUME_CALCULATION_TYPES.AI_GENERATED) {
                        // Start the long-running task in a setTimeout to prevent blocking the UI
                        setTimeout(async () => {
                            try {
                                const response = await calculateNextWorkoutVolume(workout);
                                if (response) {
                                    const { messageToUser = genericMessageToUser, workoutVolume = [] } = response;
                                    await updateWorkoutSetsVolume(workoutVolume, workout.id);

                                    if (messageToUser) {
                                        await addNewChat({
                                            // remove quote
                                            message: messageToUser.replace(/^"([^"]+)"$/, '$1'),
                                            misc: '',
                                            sender: 'assistant',
                                            type: 'text',
                                        });

                                        increaseUnreadMessages(1);
                                    }
                                }
                            } catch (error) {
                                console.error('Failed to calculate next workout volume:', error);
                                captureException(error);
                            }
                        }, 10);
                    } else {
                        await addNewChat({
                            message: genericMessageToUser,
                            misc: '',
                            sender: 'assistant',
                            type: 'text',
                        });

                        increaseUnreadMessages(1);

                        if (workout.volumeCalculationType === VOLUME_CALCULATION_TYPES.ALGO_GENERATED) {
                            const recentWorkouts = await getRecentWorkoutsByWorkoutId(Number(workout.id));
                            await calculateNextWorkoutRepsAndSets(workout, recentWorkouts);
                        }
                    }
                }

                setCurrentExerciseIndex(0);
                setExercise(null);
                await resetWorkoutStorageData();
            }
        } catch (error) {
            console.error('Failed to finish exercise:', error);
        }
    }, [startTime, currentExerciseIndex, exercises, workout, checkReadIsPermitted, t, isAiEnabled, isImperial, unitSystem, getHealthData, addNewChat, increaseUnreadMessages]);

    const handleReplaceExercise = useCallback(
        async (newExerciseId: number) => {
            if (!workout?.id || !exercise?.id) {
                return;
            }

            try {
                // Get the existing replacements from AsyncStorage
                const existingReplacements = await AsyncStorage.getItem(EXERCISE_REPLACEMENTS);
                const parsedReplacements = existingReplacements
                    ? JSON.parse(existingReplacements)
                    : {};

                // Update the replacements with the new exercise
                const updatedReplacements = {
                    ...parsedReplacements,
                    [workout.id]: {
                        ...parsedReplacements[workout.id],
                        [exercise.id]: newExerciseId,
                    },
                };

                // Save the updated replacements
                await AsyncStorage.setItem(
                    EXERCISE_REPLACEMENTS,
                    JSON.stringify(updatedReplacements)
                );

                // Refresh the current exercise
                const newExercise = await getCurrentExercise(exercise, workout.id);
                if (newExercise) {
                    setExercise(newExercise);
                }

                console.log('Exercise replaced successfully:', updatedReplacements);
            } catch (error) {
                console.error('Failed to replace exercise:', error);
            }
        },
        [exercise, workout?.id]
    );

    useEffect(() => {
        const checkStartingTime = async () => {
            const storedStartTime = Number(await AsyncStorage.getItem(WORKOUT_START_TIME));
            if (storedStartTime) {
                setStartTime(storedStartTime);
            } else if (exercise && currentExerciseIndex === 0) {
                setStartTime(Date.now());
            }
        };

        checkStartingTime();
    }, [currentExerciseIndex, exercise]);

    const handleCancelWorkout = useCallback(async () => {
        try {
            setExercise(null);
            setExercises([]);
            setWorkout(undefined);
            setStartTime(null);
            setWorkoutDuration(0);

            await resetWorkoutStorageData();

            navigation.navigate('index');
        } catch (error) {
            console.error('Failed to cancel workout:', error);
        }
    }, [navigation]);

    if (exercise && exercises?.[currentExerciseIndex]?.sets.length) {
        return (
            <Screen>
                <WorkoutSession
                    exercise={exercise}
                    isFirstExercise={currentExerciseIndex === 0}
                    isLastExercise={currentExerciseIndex === exercises.length - 1}
                    key={workout?.id}
                    onCancel={handleCancelWorkout}
                    onFinish={handleFinishExercise}
                    onReplaceExercise={handleReplaceExercise}
                    orderedExercises={orderedExercises}
                    sets={exercises[currentExerciseIndex].sets}
                    startTime={startTime}
                    workoutDuration={workoutDuration}
                    workoutId={workout?.id}
                />
            </Screen>
        );
    }

    return (
        <Screen style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >
                <WorkoutModal
                    onClose={() => {
                        setLoading(true);
                        fetchWorkout().finally(() => {
                            setLoading(false);
                            setModalVisible(false);
                        }).catch((err) => {
                            console.error('Failed to close workout modal:', err);
                            setLoading(false);
                            setModalVisible(false);
                        });
                    }}
                    visible={modalVisible}
                />
                <View style={styles.section}>
                    <Text style={styles.header}>{t('no_ongoing_workout')}</Text>
                    <Button
                        mode="contained"
                        onPress={() => setModalVisible(true)}
                        style={styles.startLoggingButton}
                    >
                        {t('start_a_workout')}
                    </Button>
                </View>
                {loading ? (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator color="#fff" size="large" />
                    </View>
                ) : null}
            </ScrollView>
        </Screen>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    container: {
        alignItems: 'center',
        backgroundColor: colors.background,
        flexGrow: 1,
        justifyContent: 'center',
        padding: 16,
    },
    header: {
        color: colors.onBackground,
        fontSize: 28,
        fontWeight: 'bold',
        lineHeight: 40,
        textAlign: 'center',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        zIndex: 1000,
    },
    section: {
        backgroundColor: 'transparent',
        marginBottom: 32,
    },
    startLoggingButton: {
        marginTop: 16,
    },
});

export default CurrentWorkout;
