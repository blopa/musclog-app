import CompletionModal from '@/components/CompletionModal';
import CustomTextInput from '@/components/CustomTextInput';
import DatePickerModal from '@/components/DatePickerModal';
import { Screen } from '@/components/Screen';
import SearchablePicker from '@/components/SearchablePicker';
import ThemedModal from '@/components/ThemedModal';
import TimePickerModal from '@/components/TimePickerModal';
import { COMPLETED_STATUS } from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import {
    addWorkoutEvent,
    getWorkoutEvent,
    getWorkoutsPaginated,
    getWorkoutWithExercisesRepsAndSetsDetails,
    updateWorkoutEvent,
} from '@/utils/database';
import { formatFloatNumericInputText, formatIntegerNumericInputText } from '@/utils/string';
import { ExerciseVolumeSetType, ExerciseVolumeType, WorkoutEventInsertType, WorkoutReturnType } from '@/utils/types';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, BackHandler, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Switch, Text, useTheme } from 'react-native-paper';

type LocalStateSetType = {
    exerciseId: number;
    exerciseName: string;
    id: number;
    isDropSet: boolean | undefined;
    reps: string;
    restTime: string;
    setOrder: number;
    supersetName: null | string;
    weight: string;
};

type RouteParams = {
    id?: string;
};

export default function CreateRecentWorkout({ navigation }: { navigation: NavigationProp<any> }) {
    const route = useRoute();
    const { id } = (route.params as RouteParams) || {};
    const { t } = useTranslation();

    const [workoutTitle, setWorkoutTitle] = useState('');
    const [workoutId, setWorkoutId] = useState<null | number>(null);
    const [workoutDescription, setWorkoutDescription] = useState('');
    const [workoutDate, setWorkoutDate] = useState(new Date());
    const [workoutTime, setWorkoutTime] = useState(new Date());
    const [sets, setSets] = useState<LocalStateSetType[]>([]);
    const [workoutDuration, setWorkoutDuration] = useState<string>('');
    const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [setToDeleteIndex, setSetToDeleteIndex] = useState<null | number>(null);
    const [allWorkouts, setAllWorkouts] = useState<WorkoutReturnType[]>([]);
    const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
    const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);

    const { weightUnit } = useUnit();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const loadWorkouts = useCallback(async () => {
        try {
            const loadedWorkouts = await getWorkoutsPaginated(0, 20);
            setAllWorkouts(loadedWorkouts);
        } catch (error) {
            console.error(t('failed_to_load_workouts'), error);
        }
    }, [t]);

    useFocusEffect(
        useCallback(() => {
            loadWorkouts();
        }, [loadWorkouts])
    );

    const resetScreenData = useCallback(() => {
        setWorkoutTitle('');
        setWorkoutDescription('');
        setSets([]);
        setWorkoutDuration('');
        setWorkoutId(null);
        setWorkoutDate(new Date());
        setWorkoutTime(new Date());
    }, []);

    useFocusEffect(
        useCallback(() => {
            return () => {
                resetScreenData();
            };
        }, [resetScreenData])
    );

    const loadWorkoutEventForEdit = useCallback(async () => {
        if (!id) {
            return;
        }

        try {
            const workoutEvent = await getWorkoutEvent(Number(id));
            if (!workoutEvent) {
                console.error(t('failed_to_load_workout_event'));
                return;
            }

            // Set WorkoutEvent details to state
            const workoutDateTime = new Date(workoutEvent.date);
            setWorkoutDate(workoutDateTime);
            setWorkoutTime(workoutDateTime);
            setWorkoutDescription(workoutEvent.description || '');
            setWorkoutDuration((workoutEvent?.duration || 0).toString());
            setWorkoutId(workoutEvent.workoutId);
            setWorkoutTitle(workoutEvent.title);

            // Load the associated Workout and its exercises/sets
            const workoutDetails = await getWorkoutWithExercisesRepsAndSetsDetails(workoutEvent.workoutId);
            if (workoutDetails) {
                const updatedSets = workoutDetails.exercises.flatMap((exercise, exerciseIndex) =>
                    exercise.sets.map((set, index) => {
                        const exerciseData: ExerciseVolumeType[] = workoutEvent.exerciseData ? JSON.parse(workoutEvent.exerciseData) : [];
                        const matchingExercise = exerciseData.find((e) => e.exerciseId === exercise.id);
                        const matchingVolumeSet = matchingExercise?.sets.find((s) => s.setId === set.id);

                        return {
                            exerciseId: exercise.id,
                            exerciseName: exercise.name,
                            id: set.id,
                            isDropSet: set.isDropSet,
                            reps: matchingVolumeSet ? matchingVolumeSet.reps.toString() : set.reps.toString(),
                            restTime: matchingVolumeSet ? matchingVolumeSet.restTime.toString() : set.restTime.toString(),
                            setOrder: exerciseIndex + index + 1,
                            supersetName: set.supersetName || null,
                            weight: matchingVolumeSet ? matchingVolumeSet.weight.toString() : set.weight.toString(),
                        };
                    })
                );

                setSets(updatedSets);
            }
        } catch (error) {
            console.error(t('failed_to_load_workout_event'), error);
        }
    }, [id, t]);

    useFocusEffect(
        useCallback(() => {
            if (id) {
                loadWorkoutEventForEdit();
            }
        }, [id, loadWorkoutEventForEdit])
    );

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                navigation.navigate('recentWorkouts');
                return true;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => {
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            };
        }, [navigation])
    );

    const handleSelectWorkout = useCallback(async (workoutId: string) => {
        try {
            const workoutDetails = await getWorkoutWithExercisesRepsAndSetsDetails(Number(workoutId));
            if (workoutDetails) {
                setWorkoutId(workoutDetails.id);
                setWorkoutTitle(workoutDetails.title);
                setWorkoutDescription(workoutDetails.description || '');
                setSets(workoutDetails.exercises.flatMap((exercise, exerciseIndex) =>
                    exercise.sets.map((set, setIndex) => ({
                        exerciseId: exercise.id,
                        exerciseName: exercise.name,
                        id: set.id,
                        isDropSet: set.isDropSet,
                        reps: set.reps.toString(),
                        restTime: set.restTime.toString(),
                        setOrder: exerciseIndex + setIndex + 1,
                        supersetName: set.supersetName || null,
                        weight: set.weight.toString(),
                    }))
                ));
            }
        } catch (error) {
            console.error(t('failed_to_load_workout_details'), error);
        }
    }, [t]);

    const confirmDeleteSet = useCallback((setIndex: number) => {
        setSetToDeleteIndex(setIndex);
        setIsDeleteModalVisible(true);
    }, []);

    const handleDeleteSet = useCallback(() => {
        if (setToDeleteIndex !== null) {
            setSets((prevSets) => prevSets.filter((_, index) => index !== setToDeleteIndex));
            setIsDeleteModalVisible(false);
            setSetToDeleteIndex(null);
        }
    }, [setToDeleteIndex]);

    const handleFormatNumericText = useCallback((set: LocalStateSetType, text: string, key: 'reps' | 'restTime' | 'weight') => {
        const formattedText = key === 'weight'
            ? formatFloatNumericInputText(text)
            : formatIntegerNumericInputText(text);

        if (formattedText || !text) {
            setSets((prevSets) =>
                prevSets.map((s) => (s === set ? { ...s, [key]: formattedText } : s))
            );
        }
    }, []);

    const handleSupersetNameChange = useCallback((set: LocalStateSetType, text: string) => {
        setSets((prevSets) =>
            prevSets.map((s) => (s === set ? { ...s, supersetName: text } : s))
        );
    }, []);

    const handleFormatDurationText = useCallback((text: string) => {
        const formattedText = formatIntegerNumericInputText(text);

        if (formattedText || !text) {
            setWorkoutDuration(formattedText || '');
        }
    }, []);

    const handleSaveWorkout = useCallback(async () => {
        if (!workoutTitle.trim()) {
            Alert.alert(t('validation_error'), t('workout_title_required'));
            return;
        }

        if (!workoutDuration.trim() || isNaN(Number(workoutDuration))) {
            Alert.alert(t('validation_error'), t('workout_duration_required'));
            return;
        }

        if (sets.length === 0 || sets.some((set) => !set.exerciseId)) {
            Alert.alert(t('validation_error'), t('at_least_one_exercise_required'));
            return;
        }

        setIsSaving(true);

        try {
            const exerciseData: ExerciseVolumeType[] = sets.reduce((acc: ExerciseVolumeType[], set) => {
                const exerciseIndex = acc.findIndex((e) => e.exerciseId === set.exerciseId);
                const setObject: ExerciseVolumeSetType = {
                    exerciseId: set.exerciseId,
                    id: set.id,
                    isDropSet: set.isDropSet,
                    reps: Number(set.reps),
                    restTime: Number(set.restTime),
                    setId: set.id,
                    setOrder: set.setOrder,
                    supersetName: set.supersetName || '',
                    weight: Number(set.weight),
                    workoutId: workoutId!,
                };

                if (exerciseIndex >= 0) {
                    acc[exerciseIndex].sets.push(setObject);
                } else {
                    acc.push({
                        exerciseId: set.exerciseId,
                        sets: [setObject],
                    });
                }

                return acc;
            }, []);

            const workoutDateTime = new Date(workoutDate);
            workoutDateTime.setHours(workoutTime.getHours());
            workoutDateTime.setMinutes(workoutTime.getMinutes());

            const workoutData: WorkoutEventInsertType = {
                date: workoutDateTime.toISOString(),
                description: workoutDescription,
                duration: Number(workoutDuration),
                exerciseData: JSON.stringify(exerciseData),
                status: COMPLETED_STATUS,
                title: workoutTitle,
                workoutId: workoutId ? Number(workoutId) : 0,
            };

            if (id) {
                await updateWorkoutEvent(Number(id), workoutData);
            } else {
                await addWorkoutEvent(workoutData);
            }

            setIsSaveModalVisible(true);
        } catch (error) {
            console.error(t('failed_to_save_workout'), error);
        } finally {
            setIsSaving(false);
        }
    }, [workoutTitle, workoutDuration, sets, t, workoutDate, workoutDescription, workoutId, workoutTime, id]);

    const handleModalClose = useCallback(() => {
        setIsSaveModalVisible(false);

        // TODO: Navigate to the workout details screen instead
        navigation.navigate('recentWorkouts');
    }, [navigation]);

    return (
        <Screen style={styles.container}>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.container}>
                <CompletionModal
                    buttonText={t('ok')}
                    isModalVisible={isSaveModalVisible}
                    onClose={handleModalClose}
                    title={t(id ? 'workout_updated_successfully' : 'workout_created_successfully')}
                />
                <ThemedModal
                    cancelText={t('no')}
                    confirmText={t('yes')}
                    onClose={() => setIsDeleteModalVisible(false)}
                    onConfirm={handleDeleteSet}
                    title={t('delete_set_confirmation')}
                    visible={isDeleteModalVisible}
                />
                <DatePickerModal
                    onChangeDate={setWorkoutDate}
                    onClose={() => setIsDatePickerVisible(false)}
                    selectedDate={workoutDate}
                    visible={isDatePickerVisible}
                />
                <TimePickerModal
                    onChangeTime={setWorkoutTime}
                    onClose={() => setIsTimePickerVisible(false)}
                    selectedTime={workoutTime}
                    visible={isTimePickerVisible}
                />
                <Appbar.Header mode="small" statusBarHeight={0} style={styles.appbarHeader}>
                    <Appbar.Content title={t(id ? 'edit_recent_workout' : 'create_recent_workout')} titleStyle={styles.appbarTitle} />
                    <Button
                        mode="outlined"
                        onPress={() => {
                            resetScreenData();
                            navigation.navigate('recentWorkouts');
                        }}
                        textColor={colors.onPrimary}
                    >
                        {t('cancel')}
                    </Button>
                </Appbar.Header>
                <View style={styles.content}>
                    <SearchablePicker
                        items={allWorkouts.map((workout) => ({
                            label: workout.title,
                            value: workout.id.toString(),
                        }))}
                        label={t('select_workout')}
                        onValueChange={(itemValue) => handleSelectWorkout(itemValue)}
                        selectedValue={workoutId ? workoutId.toString() : ''}
                    />
                    <View style={styles.datePickerWrapper}>
                        <Text style={styles.label}>{t('workout_date')}</Text>
                        <Button
                            mode="outlined"
                            onPress={() => setIsDatePickerVisible(true)}
                            style={styles.inputButton}
                        >
                            {workoutDate.toLocaleDateString()}
                        </Button>
                    </View>
                    <View style={styles.datePickerWrapper}>
                        <Text style={styles.label}>{t('workout_time')}</Text>
                        <Button
                            mode="outlined"
                            onPress={() => setIsTimePickerVisible(true)}
                            style={styles.inputButton}
                        >
                            {workoutTime.toLocaleTimeString()}
                        </Button>
                    </View>
                    <CustomTextInput
                        keyboardType="numeric"
                        label={t('workout_duration')}
                        onChangeText={handleFormatDurationText}
                        placeholder={t('enter_workout_duration')}
                        value={workoutDuration}
                    />
                    {sets.map((set, index) => (
                        <View key={index} style={styles.setForm}>
                            <Text style={styles.exerciseLabel}>{t('exercise')}: {set.exerciseName}</Text>
                            {/*<Text style={styles.exerciseLabel}>{t('set_order')}: {set.setOrder}</Text>*/}
                            <View style={styles.row}>
                                <CustomTextInput
                                    keyboardType="numeric"
                                    label={t('weight', { weightUnit })}
                                    onChangeText={(text) => handleFormatNumericText(set, text, 'weight')}
                                    placeholder={t('enter_weight')}
                                    value={set.weight}
                                    wrapperStyle={styles.input}
                                />
                                <CustomTextInput
                                    keyboardType="numeric"
                                    label={t('reps')}
                                    onChangeText={(text) => handleFormatNumericText(set, text, 'reps')}
                                    placeholder={t('enter_reps')}
                                    value={set.reps}
                                    wrapperStyle={styles.input}
                                />
                            </View>
                            <View style={styles.row}>
                                <CustomTextInput
                                    keyboardType="numeric"
                                    label={t('rest_time_sec')}
                                    onChangeText={(text) => handleFormatNumericText(set, text, 'restTime')}
                                    placeholder={t('enter_rest_time')}
                                    value={set.restTime}
                                    wrapperStyle={styles.input}
                                />
                            </View>
                            <CustomTextInput
                                label={t('superset_name')}
                                onChangeText={(text) => handleSupersetNameChange(set, text)}
                                placeholder={t('enter_superset_name')}
                                value={set.supersetName || ''}
                                wrapperStyle={styles.input}
                            />
                            <View style={[styles.row, styles.alignCenter]}>
                                <Text style={styles.labelToggleSwitch}>{t('is_drop_set')}</Text>
                                <Switch
                                    onValueChange={(value) => {
                                        setSets((prevSets) =>
                                            prevSets.map((s, i) => (i === index ? { ...s, isDropSet: value } : s))
                                        );
                                    }}
                                    style={styles.toggleSwitch}
                                    value={set.isDropSet}
                                />
                            </View>
                            <Button
                                mode="outlined"
                                onPress={() => confirmDeleteSet(index)}
                                style={styles.deleteButton}
                            >
                                {t('delete_set')}
                            </Button>
                        </View>
                    ))}
                    <Button
                        disabled={isSaving}
                        mode="contained"
                        onPress={handleSaveWorkout}
                        style={[styles.button, styles.saveButton]}
                    >
                        {t('save_workout')}
                    </Button>
                </View>
            </ScrollView>
        </Screen>
    );
}

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    alignCenter: {
        alignItems: 'center',
    },
    appbarHeader: {
        backgroundColor: colors.primary,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    appbarTitle: {
        color: colors.onPrimary,
        fontSize: Platform.OS === 'web' ? 20 : 26,
    },
    button: {
        marginVertical: 10,
    },
    container: {
        backgroundColor: colors.background,
        flexGrow: 1,
    },
    content: {
        padding: 16,
    },
    datePickerWrapper: {
        marginVertical: 16,
    },
    deleteButton: {
        backgroundColor: colors.tertiary,
        marginTop: 8,
    },
    exerciseLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    input: {
        flex: 1,
        marginLeft: 8,
    },
    inputButton: {
        backgroundColor: colors.surface,
        borderColor: colors.onSurface,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.onSurface,
        paddingLeft: 10,
        width: '100%',
    },
    label: {
        color: colors.onSurface,
        fontSize: 16,
        marginBottom: 8,
    },
    labelToggleSwitch: {
        color: colors.onSurface,
        fontSize: 16,
        fontWeight: '600',
    },
    row: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    saveButton: {
        marginHorizontal: 'auto',
        width: '80%',
    },
    setForm: {
        borderColor: colors.onSurface,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    toggleSwitch: {
        marginLeft: 8,
    },
});
