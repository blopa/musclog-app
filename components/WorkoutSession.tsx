import CompletionModal from '@/components/CompletionModal';
import CurrentWorkoutProgressModal from '@/components/CurrentWorkoutProgressModal';
import DifficultyModal from '@/components/DifficultyModal';
import EditSetModal from '@/components/EditSetModal';
import NextSetPreview from '@/components/NextSetPreview';
import RestTimer from '@/components/RestTimer';
import SetInfo from '@/components/SetInfo';
import SliderWithButtons from '@/components/SliderWithButtons';
import ThemedModal from '@/components/ThemedModal';
import {
    COUNTDOWN_START_TIME,
    CURRENT_WORKOUT_PROGRESS,
    IMPERIAL_SYSTEM,
    KILOGRAMS,
    POUNDS,
} from '@/constants/storage';
import { ICON_SIZE } from '@/constants/ui';
import useRestTimer from '@/hooks/useRestTimer';
import useUnit from '@/hooks/useUnit';
import useWorkoutImage from '@/hooks/useWorkoutImage';
import useWorkoutTimer from '@/hooks/useWorkoutTimer';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { getWorkoutWithExercisesRepsAndSetsDetails } from '@/utils/database';
import { formatTime } from '@/utils/date';
import {
    CurrentWorkoutProgressType,
    ExerciseReturnType,
    ExerciseWithSetsType,
    SetReturnType,
    WorkoutWithExercisesRepsAndSetsDetailsReturnType,
} from '@/utils/types';
import { getDisplayFormattedWeight, getSaveFormattedWeight } from '@/utils/unit';
import { resetWorkoutStorageData } from '@/utils/workout';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';

type WorkoutSessionProps = {
    exercise?: ExerciseReturnType;
    isFirstExercise?: boolean;
    isLastExercise?: boolean;
    onCancel: () => void;
    onFinish: (workoutScore?: number, exhaustionLevel?: number) => Promise<void>;
    sets: SetReturnType[];
    startTime: null | number;
    workoutDuration?: number;
    workoutId: number | undefined;
};

const WorkoutSession = ({
    exercise,
    isFirstExercise,
    isLastExercise,
    onCancel,
    onFinish,
    sets,
    startTime,
    workoutDuration,
    workoutId,
}: WorkoutSessionProps) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [isSkipConfirmVisible, setIsSkipConfirmVisible] = useState(false);
    const [currentSetIndex, setCurrentSetIndex] = useState(0);

    const [weightLifted, setWeightLifted] = useState('0');
    const [completedReps, setCompletedReps] = useState('0');
    const [tempWeightLifted, setTempWeightLifted] = useState('0');
    const [tempCompletedReps, setTempCompletedReps] = useState('0');
    const [globalWeightLifted, setGlobalWeightLifted] = useState('0');
    const [globalCompletedReps, setGlobalCompletedReps] = useState('0');

    const [isFinishWorkoutModalVisible, setIsFinishWorkoutModalVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isDifficultyModalVisible, setIsDifficultyModalVisible] = useState(false);
    const [isCancelConfirmVisible, setIsCancelConfirmVisible] = useState(false);
    const [workoutScore, setWorkoutScore] = useState<number>(5);
    const [exhaustionLevel, setExhaustionLevel] = useState<number>(5);
    const [setDifficulty, setSetDifficulty] = useState<number>(5);
    const [skippedSets, setSkippedSets] = useState<number[]>([]);
    const [remainingWorkoutData, setRemainingWorkoutData] = useState<ExerciseWithSetsType[]>([]);
    const [workoutDetails, setWorkoutDetails] = useState<WorkoutWithExercisesRepsAndSetsDetailsReturnType | undefined>(undefined);

    const { unitSystem, weightUnit } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(300)).current;
    const finishButtonText = currentSetIndex + 1 === sets.length ? (isLastExercise ? t('finish_workout') : t('finish_exercise')) : t('finish_set');

    const { imageUrl } = useWorkoutImage(exercise);
    const { intervalTimer, workoutTime } = useWorkoutTimer(startTime);

    useKeepAwake();

    const {
        forceStartCountdown,
        handleAddTime,
        handleSubtractTime,
        resetRestTime,
        restTime,
    } = useRestTimer();

    const isResting = restTime > 0;

    const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
    const [completedWorkoutData, setCompletedWorkoutData] = useState<CurrentWorkoutProgressType[]>([]);

    useEffect(() => {
        clearInterval(intervalTimer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workoutId]);

    useEffect(() => {
        if (currentSetIndex < sets.length) {
            if (Number(globalWeightLifted) > 0) {
                setWeightLifted(globalWeightLifted);
            }

            if (Number(globalCompletedReps) > 0) {
                setCompletedReps(globalCompletedReps);
            }
        }
    }, [currentSetIndex, globalWeightLifted, globalCompletedReps, sets.length]);

    const updateNewSetData = useCallback(async () => {
        const currentSet = sets[currentSetIndex];
        const weight = currentSet?.weight;
        const reps = currentSet?.reps;

        if (weight) {
            setWeightLifted((getDisplayFormattedWeight(Number(weight), KILOGRAMS, isImperial)).toString());
            setTempWeightLifted((getDisplayFormattedWeight(Number(weight), KILOGRAMS, isImperial)).toString());
            setGlobalWeightLifted('0');
        }

        if (reps) {
            setCompletedReps(reps.toString());
            setTempCompletedReps(reps.toString());
            setGlobalCompletedReps('0');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isImperial, currentSetIndex, exercise?.id, sets]);

    useEffect(() => {
        updateNewSetData();
        // this will run every time the updateNewSetData function changes
        // which then will change every time setIndex or exercise is changed
    }, [updateNewSetData]);

    useEffect(() => {
        const checkCurrentWorkoutProgress = async () => {
            const existingProgress = await AsyncStorage.getItem(CURRENT_WORKOUT_PROGRESS);
            const progressArray = JSON.parse(existingProgress || '[]') as CurrentWorkoutProgressType[];
            let currentSetIndex = 0;

            if (progressArray.length) {
                const set = progressArray.pop();
                if (set && set.exerciseId === exercise?.id) {
                    currentSetIndex = set.setIndex;
                }
            }

            const countdownStartTime = await AsyncStorage.getItem(COUNTDOWN_START_TIME);
            setCurrentSetIndex(currentSetIndex);
            if (countdownStartTime) {
                const currentSet = sets[currentSetIndex];
                await forceStartCountdown(Math.max(currentSet.restTime + 1, 5), Number(countdownStartTime) || Date.now());
            }
        };

        const fetchRemainingWorkoutData = async () => {
            if (workoutId) {
                const workoutDetails = await getWorkoutWithExercisesRepsAndSetsDetails(workoutId);
                setWorkoutDetails(workoutDetails);
            }
        };

        checkCurrentWorkoutProgress();
        fetchRemainingWorkoutData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const getRemainingExercises = async () => {
            if (workoutDetails) {
                const existingProgress = await AsyncStorage.getItem(CURRENT_WORKOUT_PROGRESS);
                const progressArray = JSON.parse(existingProgress || '[]') as CurrentWorkoutProgressType[];

                const completedSetIds = new Set(progressArray.map((set) => set.setId));
                const remainingExercises = workoutDetails.exercises.map((exercise) => ({
                    ...exercise,
                    sets: exercise.sets.filter((set) => !completedSetIds.has(set.id) && !skippedSets.includes(set.id)),
                })).filter((exercise) => exercise.sets.length > 0);

                setRemainingWorkoutData(remainingExercises);
            }
        };

        getRemainingExercises();
    }, [workoutDetails, currentSetIndex, skippedSets]);

    const handleStartCountdown = useCallback(async (newSetIndex: number) => {
        setCurrentSetIndex(newSetIndex);
        const currentSet = sets[newSetIndex];
        await forceStartCountdown(Math.max(currentSet.restTime + 1, 5));
    }, [forceStartCountdown, sets]);

    const finishExercise = useCallback(async () => {
        await onFinish(workoutScore, exhaustionLevel);
        await handleStartCountdown(0);
    }, [onFinish, workoutScore, exhaustionLevel, handleStartCountdown]);

    const handleFinishExercise = useCallback(async () => {
        setLoading(true);

        if (isLastExercise) {
            // Finish the workout
            setIsFinishWorkoutModalVisible(true);
            setWorkoutScore(5);
            setExhaustionLevel(5);

            Animated.parallel([
                Animated.timing(fadeAnim, {
                    duration: 300,
                    toValue: 1,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    duration: 300,
                    toValue: 0,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            await finishExercise();
            setLoading(false);
        }
    }, [fadeAnim, finishExercise, isLastExercise, slideAnim]);

    const handleFinishSet = useCallback(async () => {
        setLoading(true);
        setIsDifficultyModalVisible(true);

        Animated.parallel([
            Animated.timing(fadeAnim, {
                duration: 300,
                toValue: 1,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                duration: 300,
                toValue: 0,
                useNativeDriver: true,
            }),
        ]).start();

        setLoading(false);
    }, [fadeAnim, slideAnim]);

    const handleSaveSetDifficulty = useCallback(async () => {
        const currentSet = sets[currentSetIndex];
        setLoading(true);
        const setData = {
            difficultyLevel: setDifficulty,
            exerciseId: exercise?.id,
            name: exercise?.name,
            reps: Number(completedReps),
            restTime: currentSet.restTime,
            setId: currentSet.id,
            setIndex: currentSetIndex + 1,
            targetReps: currentSet.reps,
            targetWeight: currentSet.weight,
            weight: getSaveFormattedWeight(Number(weightLifted), POUNDS, isImperial),
            workoutDuration,
        } as CurrentWorkoutProgressType;

        try {
            const existingProgress = await AsyncStorage.getItem(CURRENT_WORKOUT_PROGRESS);
            const progressArray = JSON.parse(existingProgress || '[]') as CurrentWorkoutProgressType[];

            if (!progressArray.some(
                (entry: CurrentWorkoutProgressType) => entry.setIndex === setData.setIndex && entry.setId === setData.setId && entry.exerciseId === setData.exerciseId)
            ) {
                progressArray.push(setData);

                await AsyncStorage.setItem(CURRENT_WORKOUT_PROGRESS, JSON.stringify(progressArray));
            }
        } catch (error) {
            console.error('Failed to save set data:', error);
        }

        setIsDifficultyModalVisible(false);

        if (currentSetIndex + 1 < sets.length) {
            // Move to next set
            const newIndex = Math.min(currentSetIndex + 1, sets.length - 1);
            await handleStartCountdown(newIndex);
        } else {
            // Move to next exercise
            await handleStartCountdown(0);
            await handleFinishExercise();
        }

        setSetDifficulty(5);
        setLoading(false);
    }, [
        handleStartCountdown,
        handleFinishExercise,
        currentSetIndex,
        workoutDuration,
        exercise?.name,
        setDifficulty,
        completedReps,
        exercise?.id,
        weightLifted,
        isImperial,
        sets,
    ]);

    const handleFinishWorkout = useCallback(() => {
        setLoading(true);
        // finish the exercise and the workout
        finishExercise().then(async () => {
            await resetWorkoutStorageData();

            setIsFinishWorkoutModalVisible(false);
            setLoading(false);

            Animated.parallel([
                Animated.timing(fadeAnim, {
                    duration: 300,
                    toValue: 0,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    duration: 300,
                    toValue: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        });
    }, [fadeAnim, finishExercise, slideAnim]);

    const handleSkipRest = useCallback(async () => {
        await resetRestTime();
    }, [resetRestTime]);

    const handleOpenEditModal = useCallback(() => {
        setTempWeightLifted(weightLifted);
        setTempCompletedReps(completedReps);
        setIsEditModalVisible(true);

        Animated.parallel([
            Animated.timing(fadeAnim, {
                duration: 300,
                toValue: 1,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                duration: 300,
                toValue: 0,
                useNativeDriver: true,
            }),
        ]).start();
    }, [completedReps, fadeAnim, slideAnim, weightLifted]);

    const handleCloseEditModal = useCallback(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                duration: 300,
                toValue: 0,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                duration: 300,
                toValue: 300,
                useNativeDriver: true,
            }),
        ]).start(() => setIsEditModalVisible(false));
    }, [fadeAnim, slideAnim]);

    const handleSaveEdit = useCallback(() => {
        setWeightLifted(tempWeightLifted);
        setCompletedReps(tempCompletedReps);
        setGlobalWeightLifted(tempWeightLifted);
        setGlobalCompletedReps(tempCompletedReps);
        handleCloseEditModal();
    }, [handleCloseEditModal, tempCompletedReps, tempWeightLifted]);

    const handleSkipSet = useCallback(() => {
        setIsSkipConfirmVisible(true);
    }, []);

    const handleConfirmSkip = useCallback(async () => {
        setLoading(true);
        setIsSkipConfirmVisible(false);
        setSkippedSets((prevState) => [...prevState, sets[currentSetIndex].id]);

        if (currentSetIndex + 1 < sets.length) {
            await handleStartCountdown(Math.min(currentSetIndex + 1, sets.length - 1));
        } else {
            await handleStartCountdown(0);
            handleFinishExercise();
        }

        setLoading(false);
    }, [currentSetIndex, handleFinishExercise, handleStartCountdown, sets]);

    const handleCancelWorkout = useCallback(() => {
        onCancel();
    }, [onCancel]);

    const handleOpenInfoModal = useCallback(async () => {
        const existingProgress = await AsyncStorage.getItem(CURRENT_WORKOUT_PROGRESS);
        const progressArray = JSON.parse(existingProgress || '[]') as CurrentWorkoutProgressType[];

        setCompletedWorkoutData(progressArray);
        setIsInfoModalVisible(true);
    }, []);

    return (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <TouchableOpacity
                onPress={() => setIsCancelConfirmVisible(true)}
                style={styles.closeButton}
            >
                <Ionicons color={colors.onBackground} name="close" size={ICON_SIZE} />
            </TouchableOpacity>
            <TouchableOpacity
                onPress={handleOpenInfoModal}
                style={styles.infoButton}
            >
                <Ionicons color={colors.onBackground} name="information-circle-outline" size={ICON_SIZE} />
            </TouchableOpacity>
            <Text style={styles.totalTime}>
                {t('total_workout_time', { time: formatTime(workoutTime, false) })}
            </Text>
            <CompletionModal
                buttonText={t('lets_go')}
                isLoading={loading}
                isModalVisible={isFinishWorkoutModalVisible}
                onClose={handleFinishWorkout}
                title={t('well_done')}
            >
                <View>
                    <SliderWithButtons
                        label={t('workout_score_out_of', { score: workoutScore })}
                        onValueChange={setWorkoutScore}
                        value={workoutScore}
                    />
                    <SliderWithButtons
                        label={t('exhaustion_level_out_of', { level: exhaustionLevel })}
                        onValueChange={setExhaustionLevel}
                        value={exhaustionLevel}
                    />
                </View>
            </CompletionModal>
            <ThemedModal
                cancelText={t('cancel')}
                confirmText={t('skip')}
                onClose={() => setIsSkipConfirmVisible(false)}
                onConfirm={handleConfirmSkip}
                title={t('are_you_sure_you_want_to_skip')}
                visible={isSkipConfirmVisible}
            />
            <ThemedModal
                cancelText={t('no')}
                confirmText={t('yes')}
                onClose={() => setIsCancelConfirmVisible(false)}
                onConfirm={handleCancelWorkout}
                title={t('are_you_sure_you_want_to_cancel_workout')}
                visible={isCancelConfirmVisible}
            />
            <DifficultyModal
                handleSaveSetDifficulty={handleSaveSetDifficulty}
                loading={loading}
                onClose={() => setIsDifficultyModalVisible(false)}
                setDifficulty={setDifficulty}
                setSetDifficulty={setSetDifficulty}
                visible={isDifficultyModalVisible}
            />
            <EditSetModal
                handleCloseEditModal={handleCloseEditModal}
                handleSaveEdit={handleSaveEdit}
                reps={tempCompletedReps}
                setReps={setTempCompletedReps}
                setWeight={setTempWeightLifted}
                visible={isEditModalVisible}
                weight={tempWeightLifted}
            />
            <CurrentWorkoutProgressModal
                completedWorkoutData={completedWorkoutData}
                isVisible={isInfoModalVisible}
                onClose={() => setIsInfoModalVisible(false)}
                remainingWorkoutData={remainingWorkoutData}
            />
            {isResting ? (
                <RestTimer
                    onAddTime={handleAddTime}
                    onSkipRest={handleSkipRest}
                    onSubtractTime={handleSubtractTime}
                    restTime={restTime}
                />
            ) : (
                <SetInfo
                    completedReps={completedReps}
                    currentSetIndex={currentSetIndex}
                    exercise={exercise}
                    imageUrl={imageUrl}
                    setsLength={sets.length}
                    weightLifted={weightLifted}
                    weightUnit={weightUnit}
                />
            )}
            {!isResting && (
                <>
                    <Button
                        disabled={loading}
                        mode="contained"
                        onPress={handleSkipSet}
                        style={styles.buttonSpacing}
                    >
                        {t('skip_set')}
                    </Button>
                    <Button
                        disabled={loading}
                        mode="contained"
                        onPress={handleOpenEditModal}
                        style={styles.buttonSpacing}
                    >
                        {t('edit_set')}
                    </Button>
                    <Button
                        disabled={loading}
                        mode="contained"
                        onPress={handleFinishSet}
                        style={styles.buttonSpacing}
                    >
                        {finishButtonText}
                    </Button>
                </>
            )}
            {isResting ? (
                <NextSetPreview
                    exercise={exercise}
                    // We only show this if we are resting
                    // and when resting, the currentSetIndex is the next set
                    nextSet={sets[currentSetIndex]}
                    style={styles.nextSetPreview}
                    weightUnit={weightUnit}
                />
            ) : null}
        </ScrollView>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    buttonSpacing: {
        marginTop: 16,
        width: '100%',
    },
    closeButton: {
        position: 'absolute',
        right: 16,
        top: 16,
        zIndex: 1,
    },
    container: {
        alignItems: 'center',
        backgroundColor: colors.background,
        flexGrow: 1,
        justifyContent: 'center',
        padding: 16,
    },
    infoButton: {
        left: 16,
        position: 'absolute',
        top: 16,
        zIndex: 1,
    },
    nextSetPreview: {
        bottom: 10,
        position: 'absolute',
    },
    totalTime: {
        color: colors.onBackground,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
});

export default WorkoutSession;