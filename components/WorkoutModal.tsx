import ThemeCard from '@/components/ThemedCard';
import ThemedModal from '@/components/ThemedModal';
import {
    CURRENT_WORKOUT_ID,
    IMPERIAL_SYSTEM,
    KILOGRAMS,
} from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { getAllExercises, getAllWorkouts, getWorkoutDetails } from '@/utils/database';
import { ExerciseReturnType, SetReturnType, WorkoutReturnType } from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';
import { resetWorkoutStorageData } from '@/utils/workout';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'react-native-paper';

type WorkoutModalProps = {
    onClose: () => void;
    visible: boolean;
};

const ESTIMATED_ITEM_SIZE = 100;

const WorkoutModal = ({ onClose, visible }: WorkoutModalProps) => {
    const navigation = useNavigation();
    const { t } = useTranslation();
    const [isVisible, setIsVisible] = useState(visible);
    const [selectedWorkout, setSelectedWorkout] = useState<null | WorkoutReturnType>(null);
    const [workoutDays, setWorkoutDays] = useState<WorkoutReturnType[]>([]);
    const [exercises, setExercises] = useState<ExerciseReturnType[]>([]);
    const [exerciseSets, setExerciseSets] = useState<{ exerciseId: number; sets: SetReturnType[] }[]>([]);
    const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark, exerciseSets.length);
    const { unitSystem, weightUnit } = useUnit();
    const windowHeight = Dimensions.get('window').height;

    const fetchWorkoutDays = useCallback(async () => {
        try {
            const workouts = await getAllWorkouts();
            setWorkoutDays(workouts);
        } catch (error) {
            console.error('Failed to load workout days:', error);
        }
    }, []);

    const fetchExercises = useCallback(async () => {
        try {
            const loadedExercises = await getAllExercises();
            setExercises(loadedExercises);
        } catch (error) {
            console.error('Failed to load exercises:', error);
        }
    }, []);

    useEffect(() => {
        if (visible) {
            setIsVisible(true);
            fetchWorkoutDays();
            fetchExercises();
        } else {
            setIsVisible(false);
        }
    }, [fetchExercises, fetchWorkoutDays, visible]);

    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    const handleWorkoutDaySelect = useCallback(async (workout: WorkoutReturnType) => {
        setSelectedWorkout(workout);

        const workoutDetails = await getWorkoutDetails(workout.id!);
        if (!workoutDetails) {
            return;
        }

        // Compute the minimum setOrder for each exercise and sort exercises accordingly
        const exerciseOrderArray = workoutDetails.exercisesWithSets.map(
            (exerciseWithSets) => {
                const { id: exerciseId, sets } = exerciseWithSets;
                const minSetOrder = Math.min(...sets.map((set) => set.setOrder));
                return { exerciseId: exerciseId!, minSetOrder, sets };
            }
        );

        // Sort exercises by their minimum setOrder
        exerciseOrderArray.sort((a, b) => a.minSetOrder - b.minSetOrder);

        // Prepare the setsByExercise array
        const setsByExercise = exerciseOrderArray.map(({ exerciseId, sets }) => ({
            exerciseId,
            sets: sets.sort((a, b) => a.setOrder - b.setOrder),
        }));

        setExerciseSets(setsByExercise);
    }, []);

    const handleClose = useCallback(() => {
        setSelectedWorkout(null);
        onClose();
    }, [onClose]);

    const handleStartWorkout = useCallback(async () => {
        if (selectedWorkout) {
            try {
                const ongoingWorkout = await AsyncStorage.getItem(CURRENT_WORKOUT_ID);
                if (ongoingWorkout) {
                    setConfirmationModalVisible(true);
                    return;
                }

                await resetWorkoutStorageData();
                await AsyncStorage.setItem(CURRENT_WORKOUT_ID, JSON.stringify(selectedWorkout.id));

                handleClose();
                (navigation.navigate as any)('index', { screen: 'workout' });
            } catch (error) {
                console.error('Failed to save current workout day:', error);
            }
        }
    }, [handleClose, navigation, selectedWorkout]);

    const handleConfirmStartNewWorkout = useCallback(async () => {
        if (selectedWorkout) {
            try {
                await resetWorkoutStorageData();
                await AsyncStorage.setItem(CURRENT_WORKOUT_ID, JSON.stringify(selectedWorkout.id));

                handleClose();
                (navigation.navigate as any)('index', { screen: 'workout' });
            } catch (error) {
                console.error('Failed to save current workout day:', error);
            } finally {
                setConfirmationModalVisible(false);
            }
        }
    }, [handleClose, navigation, selectedWorkout]);

    const renderExercise = ({ index, item }: { index: number, item: { exerciseId: number; sets: SetReturnType[] } }) => {
        const exercise = exercises.find((ex) => ex.id === item.exerciseId);
        const sets = item.sets || [];

        if (exercise && sets.length > 0) {
            const averageWeight = sets.reduce((total, set) => total + set.weight, 0) / sets.length;
            const averageReps = sets.reduce((total, set) => total + set.reps, 0) / sets.length;

            return (
                <ThemeCard key={`${exercise.id}-${index}`} style={styles.cardContainer}>
                    <Card.Content>
                        <Text style={styles.cardTitle}>{exercise.name}</Text>
                        <Text style={styles.cardSubtitle}>
                            {getDisplayFormattedWeight(averageWeight, KILOGRAMS, isImperial)} {weightUnit} ({t('avg')})
                        </Text>
                        <Text style={styles.cardDetails}>
                            {sets.length} {t('sets')} x {averageReps.toFixed(1)} {t('reps')} ({t('avg')})
                        </Text>
                    </Card.Content>
                </ThemeCard>
            );
        }

        return null;
    };

    return (
        <ThemedModal
            onClose={handleClose}
            onConfirm={handleStartWorkout}
            visible={isVisible}
        >
            <View style={[styles.mainWrapper, { maxHeight: windowHeight * 0.8 }]}>
                {!selectedWorkout ? (
                    workoutDays.length === 0 ? (
                        <View style={styles.noWorkoutsContainer}>
                            <Text style={styles.noWorkoutsText}>{t('no_workouts')}</Text>
                            <Button
                                mode="contained"
                                onPress={() => {
                                    (navigation.navigate as any)('createWorkout');
                                    setIsVisible(false);
                                }}
                                style={styles.createWorkoutButton}
                            >
                                {t('create_workout')}
                            </Button>
                        </View>
                    ) : (
                        <>
                            <Text style={styles.modalTitle}>{t('select_workout')}</Text>
                            <Text style={styles.modalDescription}>{t('choose_predefined_workout')}</Text>
                            <ScrollView style={styles.buttonContainer}>
                                {workoutDays.map((workoutDay, index) => (
                                    <Button
                                        key={index}
                                        mode="outlined"
                                        onPress={() => handleWorkoutDaySelect(workoutDay)}
                                        style={styles.buttonSpacing}
                                    >
                                        {workoutDay.title}
                                    </Button>
                                ))}
                            </ScrollView>
                            <Button mode="contained" onPress={handleClose} style={styles.buttonSpacing}>
                                {t('cancel')}
                            </Button>
                        </>
                    )
                ) : (
                    <>
                        <Text style={styles.dialogTitle}>{selectedWorkout.title} {t('workout')}</Text>
                        <Text style={styles.dialogDescription}>
                            {t('push_limits', { workoutTitle: selectedWorkout.title.toLowerCase() })}
                        </Text>
                        <View style={styles.listWrapper}>
                            <FlashList
                                contentContainerStyle={styles.cardsContainer}
                                data={exerciseSets}
                                estimatedItemSize={ESTIMATED_ITEM_SIZE}
                                keyExtractor={(item, index) => `${item.exerciseId}-${index}`}
                                renderItem={renderExercise}
                            />
                        </View>
                        <View style={styles.dialogFooter}>
                            <Button
                                mode="outlined"
                                onPress={() => setSelectedWorkout(null)}
                                style={styles.buttonSpacing}
                            >
                                {t('return')}
                            </Button>
                            <Button
                                mode="contained"
                                onPress={handleStartWorkout}
                                style={styles.buttonSpacing}
                            >
                                {t('start')}
                            </Button>
                        </View>
                    </>
                )}
            </View>
            <ThemedModal
                cancelText={t('no')}
                confirmText={t('yes')}
                onClose={() => setConfirmationModalVisible(false)}
                onConfirm={handleConfirmStartNewWorkout}
                title={t('confirm_start_new_workout')}
                visible={confirmationModalVisible}
            />
        </ThemedModal>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean, listQty: number) => StyleSheet.create({
    buttonContainer: {
        marginBottom: 16,
        width: '100%',
    },
    buttonSpacing: {
        marginVertical: 4,
    },
    cardContainer: {
        marginBottom: 12,
    },
    cardDetails: {
        color: colors.onBackground,
        fontSize: 14,
        marginTop: 8,
    },
    cardsContainer: {
        paddingBottom: 16,
        paddingHorizontal: 20,
    },
    cardSubtitle: {
        color: colors.onBackground,
        fontSize: 14,
        marginTop: 8,
    },
    cardTitle: {
        color: colors.onSurface,
        fontSize: 18,
        fontWeight: 'bold',
    },
    createWorkoutButton: {
        marginTop: 16,
    },
    dialogDescription: {
        color: colors.onBackground,
        fontSize: 14,
        marginBottom: 16,
        textAlign: 'center',
    },
    dialogFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        width: '100%',
    },
    dialogTitle: {
        color: colors.onSurface,
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    listWrapper: {
        height: listQty * (ESTIMATED_ITEM_SIZE + 20),
        maxHeight: '80%',
        width: '100%',
    },
    mainWrapper: {
        backgroundColor: colors.background,
        borderRadius: 8,
        padding: 16,
    },
    modalDescription: {
        color: colors.onBackground,
        fontSize: 14,
        marginBottom: 16,
        textAlign: 'center',
    },
    modalTitle: {
        color: colors.onSurface,
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    noWorkoutsContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    noWorkoutsText: {
        color: colors.onBackground,
        fontSize: 16,
        marginBottom: 16,
        textAlign: 'center',
    },
});

export default WorkoutModal;
