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
import { generateHash } from '@/utils/string';
import {
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
import * as Sentry from '@sentry/react-native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';

const CurrentWorkout = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const { t } = useTranslation();
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
    const [exercise, setExercise] = useState<ExerciseReturnType | null>(null);
    const [exercises, setExercises] = useState<{ exercise: ExerciseReturnType; sets: SetReturnType[] }[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [startTime, setStartTime] = useState<null | number>(null);
    const [workoutDuration, setWorkoutDuration] = useState(0);
    const [workout, setWorkout] = useState<WorkoutReturnType | undefined>();
    const [loading, setLoading] = useState(false);
    const [isAiEnabled, setIsAiEnabled] = useState(false);

    const { increaseUnreadMessages } = useUnreadMessages();
    const { addNewChat } = useChatData();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { unitSystem } = useUnit();
    const { getSettingByType } = useSettings();
    const { checkReadIsPermitted, getHealthData } = useHealthConnect();

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

                        // Sort sets for each exercise by setOrder
                        const sortedExerciseSets = validExercises.map((exercise) => ({
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
                            sets: standaloneSetsMap[exercise.id].sort(
                                (a, b) => a.setOrder - b.setOrder
                            ),
                            firstSetOrder: standaloneSetsMap[exercise.id][0]?.setOrder || 0,
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
                        setExercise(currentExercise.exercise);

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
                const nextExercise = exercises[currentExerciseIndex + 1].exercise;
                setCurrentExerciseIndex(currentExerciseIndex + 1);
                setExercise(nextExercise);
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
                            targetReps: item.targetReps,
                            targetWeight: item.targetWeight,
                            unitSystem,
                            weight: item.weight,
                            setOrder: item.setOrder,
                            workoutId: workout.id,
                            supersetName: item.supersetName,
                        };

                        exercise.sets.push(set);
                    }

                    const isPermitted = await checkReadIsPermitted(['Nutrition']);
                    if (isPermitted) {
                        const healthData = await getHealthData(1000, ['Nutrition']);
                        if (healthData) {
                            const todaysNutrition = healthData.nutritionRecords!.filter(
                                ({ startTime }) => startTime.startsWith(new Date().toISOString().split('T')[0])
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
                        new Date().toISOString().split('T')[0] + 'T00:00:00.000Z'
                    );

                    const totalCarbs = userNutritionFromToday.reduce((acc, item) => acc + item.carbohydrate, 0);
                    const totalCalories = userNutritionFromToday.reduce((acc, item) => acc + item.calories, 0);
                    const totalProteins = userNutritionFromToday.reduce((acc, item) => acc + item.protein, 0);
                    const totalFats = userNutritionFromToday.reduce((acc, item) => acc + item.fat, 0);

                    const recentWorkout: WorkoutEventInsertType = {
                        calories: totalCalories,
                        carbohydrate: totalCarbs,
                        date: new Date().toISOString(),
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
                                            message: messageToUser,
                                            misc: '',
                                            sender: 'assistant',
                                            type: 'text',
                                        });

                                        increaseUnreadMessages(1);
                                    }
                                }
                            } catch (error) {
                                console.error('Failed to calculate next workout volume:', error);
                                Sentry.captureException(error);
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
            <WorkoutSession
                exercise={exercise}
                isFirstExercise={currentExerciseIndex === 0}
                isLastExercise={currentExerciseIndex === exercises.length - 1}
                key={workout?.id}
                onCancel={handleCancelWorkout}
                onFinish={handleFinishExercise}
                sets={exercises[currentExerciseIndex].sets}
                startTime={startTime}
                workoutDuration={workoutDuration}
                workoutId={workout?.id}
                orderedExercises={exercises}
            />
        );
    }

    return (
        <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
        >
            <WorkoutModal
                onClose={() => {
                    setLoading(true);
                    fetchWorkout().then(() => {
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
                    {t('start_logging')}
                </Button>
            </View>
            {loading ? (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator color="#fff" size="large" />
                </View>
            ) : null}
        </ScrollView>
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
