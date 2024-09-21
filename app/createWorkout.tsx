import CompletionModal from '@/components/CompletionModal';
import CustomPicker from '@/components/CustomPicker';
import CustomTextArea from '@/components/CustomTextArea';
import CustomTextInput from '@/components/CustomTextInput';
import SearchablePicker from '@/components/SearchablePicker';
import ThemedModal from '@/components/ThemedModal';
import { VOLUME_CALCULATION_TYPES, VOLUME_CALCULATION_TYPES_VALUES } from '@/constants/exercises';
import {
    FRIDAY,
    IMPERIAL_SYSTEM,
    MONDAY,
    POUNDS,
    SATURDAY,
    SUNDAY,
    THURSDAY,
    TUESDAY,
    WEDNESDAY,
} from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import {
    addSet,
    addWorkoutWithExercises,
    getAllExercises,
    getExerciseById,
    getSetsByIds,
    getWorkoutById,
    getWorkoutExercisesByWorkoutId,
    updateWorkoutExerciseOrder,
} from '@/utils/database';
import { formatFloatNumericInputText, formatIntegerNumericInputText } from '@/utils/string';
import {
    ExerciseReturnType,
    SetReturnType,
    VolumeCalculationTypeType,
    WorkoutExerciseInsertType,
    WorkoutInsertType,
    WorkoutReturnType,
} from '@/utils/types';
import { getSaveFormattedWeight } from '@/utils/unit';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Animated, BackHandler, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, IconButton, Switch, Text, useTheme } from 'react-native-paper';

const daysOfWeek = [
    { label: 'Monday', value: MONDAY },
    { label: 'Tuesday', value: TUESDAY },
    { label: 'Wednesday', value: WEDNESDAY },
    { label: 'Thursday', value: THURSDAY },
    { label: 'Friday', value: FRIDAY },
    { label: 'Saturday', value: SATURDAY },
    { label: 'Sunday', value: SUNDAY },
];

type RouteParams = {
    id?: string;
};

type LocalStateSetType = {
    exerciseId: null | number;
    isDropSet: boolean | undefined;
    reps: string;
    restTime: string;
    weight: string;
};

export default function CreateWorkout({ navigation }: { navigation: NavigationProp<any> }) {
    const route = useRoute();
    const { id } = (route.params as RouteParams) || {};
    const { t } = useTranslation();

    const [allExercises, setAllExercises] = useState<ExerciseReturnType[]>([]);
    const [workoutTitle, setWorkoutTitle] = useState('');
    const [workoutDescription, setWorkoutDescription] = useState('');
    const [recurringOnWeek, setRecurringOnWeek] = useState<WorkoutReturnType['recurringOnWeek'] | undefined>(undefined);
    const [repeatWeekly, setRepeatWeekly] = useState(false);
    const [sets, setSets] = useState<LocalStateSetType[]>([]);
    const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [recentlyCreatedWorkoutId, setRecentlyCreatedWorkoutId] = useState<null | number>(null);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [setToDeleteIndex, setSetToDeleteIndex] = useState<null | number>(null);
    const [volumeCalculationType, setVolumeCalculationType] = useState<VolumeCalculationTypeType | null>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(300)).current;

    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { unitSystem, weightUnit } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    const loadWorkout = useCallback(async () => {
        try {
            const workout = await getWorkoutById(Number(id));
            if (workout) {
                setWorkoutTitle(workout.title);
                setWorkoutDescription(workout.description || '');
                if (workout.recurringOnWeek) {
                    setRepeatWeekly(true);
                    setRecurringOnWeek(workout.recurringOnWeek);
                }

                const workoutExercises = await getWorkoutExercisesByWorkoutId(Number(id));
                workoutExercises.sort((a, b) => a.order - b.order);

                const loadedExercises = await Promise.all(
                    workoutExercises.map(async (we) => {
                        const exercise = await getExerciseById(we.exerciseId);
                        const sets = await getSetsByIds(we.setIds);
                        return {
                            id: we.exerciseId,
                            name: exercise?.name || '',
                            sets: sets.filter((set) => set !== undefined) as SetReturnType[],
                        };
                    })
                );

                const setsForEdit = workoutExercises.flatMap((we, weIndex) =>
                    we.setIds.map((setId, setIndex) => {
                        const exerciseSet = loadedExercises.find((ex) => ex.id === we.exerciseId)?.sets.find((s) => s.id === setId);
                        if (exerciseSet) {
                            return {
                                exerciseId: we.exerciseId,
                                isDropSet: exerciseSet.isDropSet,
                                order: weIndex,
                                reps: exerciseSet.reps.toString(),
                                restTime: exerciseSet.restTime.toString(),
                                weight: exerciseSet.weight.toString(),
                            };
                        }
                        return null;
                    })
                ).filter((set) => set !== null) as LocalStateSetType[];

                setSets(setsForEdit);
            }
        } catch (error) {
            console.error(t('failed_to_load_workout'), error);
        }
    }, [id, t]);

    useFocusEffect(
        useCallback(() => {
            if (id) {
                loadWorkout();
            }
        }, [id, loadWorkout])
    );

    const loadExercises = useCallback(async () => {
        try {
            const loadedExercises = await getAllExercises();
            setAllExercises(loadedExercises);
        } catch (error) {
            console.error(t('failed_to_load_exercises'), error);
        }
    }, [t]);

    useFocusEffect(
        useCallback(() => {
            loadExercises();
        }, [loadExercises])
    );

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                navigation.navigate('listWorkouts');
                return true;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => {
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            };
        }, [navigation])
    );

    const resetScreenData = useCallback(() => {
        setWorkoutTitle('');
        setWorkoutDescription('');
        setRepeatWeekly(false);
        setRecurringOnWeek(undefined);
        setSets([]);
    }, []);

    const handleRepeatWeekly = useCallback((value: boolean) => {
        setRepeatWeekly(value);

        if (!value) {
            setRecurringOnWeek(undefined);
        }
    }, [])

    const handleAddExercise = useCallback(() => {
        const newSet = {
            exerciseId: null,
            isDropSet: false,
            reps: '',
            restTime: '60',
            weight: '',
        };
        setSets((prevSets) => {
            const newSets = [...prevSets];
            newSets.push(newSet);
            return newSets;
        });
    }, []);

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

    const showModal = useCallback(() => {
        setIsSaveModalVisible(true);
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
    }, [fadeAnim, slideAnim]);

    const handleSaveWorkout = useCallback(async () => {
        if (!workoutTitle.trim()) {
            Alert.alert(t('validation_error'), t('workout_title_required'));
            return;
        }

        if (sets.length === 0 || sets.some((set) => !set.exerciseId)) {
            Alert.alert(t('validation_error'), t('at_least_one_exercise_required'));
            return;
        }

        setIsSaving(true);

        const workoutData: WorkoutInsertType = {
            description: workoutDescription,
            recurringOnWeek: recurringOnWeek || undefined,
            title: workoutTitle,
            volumeCalculationType: volumeCalculationType || VOLUME_CALCULATION_TYPES.NONE,
            workoutExerciseIds: [],
        };

        try {
            const workoutExercises: WorkoutExerciseInsertType[] = [];
            const exercisesMap = new Map<number, { id: number; name: string; sets: SetReturnType[] }>();

            for (const set of sets) {
                if (!set.exerciseId) {
                    continue;
                }

                let exercise = exercisesMap.get(set.exerciseId);
                if (!exercise) {
                    const exerciseData = await getExerciseById(set.exerciseId);
                    exercise = {
                        id: set.exerciseId,
                        name: exerciseData?.name || '',
                        sets: [],
                    };
                    exercisesMap.set(set.exerciseId, exercise);
                }

                const newSet = {
                    exerciseId: set.exerciseId,
                    isDropSet: set.isDropSet,
                    reps: Number(set.reps),
                    restTime: Number(set.restTime),
                    weight: getSaveFormattedWeight(Number(set.weight), POUNDS, isImperial),
                };

                const setId = await addSet(newSet);

                exercise.sets.push({ id: setId, ...newSet } as SetReturnType);
            }

            let order = 0;
            for (const [exerciseId, exercise] of exercisesMap.entries()) {
                const setIds = exercise.sets.map((set) => set.id);
                workoutExercises.push({
                    exerciseId,
                    order: order++,
                    setIds,
                    workoutId: id ? Number(id) : 0,
                });
            }

            let workoutId;
            if (id) {
                await addWorkoutWithExercises(workoutData, workoutExercises, Number(id));
                workoutId = Number(id);
            } else {
                workoutId = await addWorkoutWithExercises(workoutData, workoutExercises);
                setRecentlyCreatedWorkoutId(workoutId);
            }

            await updateWorkoutExerciseOrder(workoutId, workoutExercises);

            // if (recurringOnWeek) {
            //     const nextWorkoutDate = getNextDayOfWeekDate(recurringOnWeek);
            //     const newWorkoutEvent: WorkoutEventInsertType = {
            //         date: nextWorkoutDate.toISOString(),
            //         description: workoutDescription,
            //         duration: 0,
            //         exerciseData: '[]',
            //         recurringOnWeek,
            //         status: SCHEDULED_STATUS,
            //         title: workoutTitle,
            //         workoutId: workoutId,
            //     };
            //
            //     await addWorkoutEvent(newWorkoutEvent);
            // }

            showModal();
        } catch (error) {
            console.error(t('failed_to_save_workout'), error);
        } finally {
            setIsSaving(false);
        }
    }, [id, recurringOnWeek, sets, showModal, workoutTitle, workoutDescription, t, isImperial, volumeCalculationType]);

    const handleModalClose = useCallback(() => {
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
        ]).start(() => {
            setIsSaveModalVisible(false);
            resetScreenData();

            const workoutId = recentlyCreatedWorkoutId || id;
            if (workoutId) {
                navigation.navigate('workoutDetails', { id: workoutId });
            } else {
                navigation.navigate('listWorkouts');
            }
        });
    }, [fadeAnim, id, navigation, recentlyCreatedWorkoutId, resetScreenData, slideAnim]);

    useFocusEffect(
        useCallback(() => {
            return () => {
                resetScreenData();
            };
        }, [resetScreenData])
    );

    const moveSet = useCallback((index: number, direction: number) => {
        setSets((prevSets) => {
            const newSets = [...prevSets];
            const targetIndex = index + direction;

            if (
                targetIndex < 0 ||
                targetIndex >= newSets.length ||
                newSets[targetIndex].exerciseId !== newSets[index].exerciseId
            ) {
                return prevSets;
            }

            const [movedSet] = newSets.splice(index, 1);
            newSets.splice(targetIndex, 0, movedSet);

            return newSets;
        });
    }, []);

    const groupContiguousSets = useCallback((sets: LocalStateSetType[]) => {
        const groupedSets: LocalStateSetType[][] = [];
        let currentGroup: LocalStateSetType[] = [];

        for (let i = 0; i < sets.length; i++) {
            if (i === 0 || sets[i].exerciseId === sets[i - 1].exerciseId) {
                currentGroup.push(sets[i]);
            } else {
                groupedSets.push(currentGroup);
                currentGroup = [sets[i]];
            }
        }

        if (currentGroup.length > 0) {
            groupedSets.push(currentGroup);
        }

        return groupedSets;
    }, []);

    const moveGroup = useCallback((groupIndex: number, direction: number) => {
        setSets((prevSets) => {
            const groupedSets = groupContiguousSets(prevSets);
            const targetIndex = groupIndex + direction;

            if (targetIndex < 0 || targetIndex >= groupedSets.length) {
                return prevSets;
            }

            const newGroupedSets = [...groupedSets];
            const [movedGroup] = newGroupedSets.splice(groupIndex, 1);
            newGroupedSets.splice(targetIndex, 0, movedGroup);

            return newGroupedSets.flat();
        });
    }, [groupContiguousSets]);

    const updateGroupExercise = useCallback((groupIndex: number, exerciseId: number) => {
        setSets((prevSets) => {
            const groupedSets = groupContiguousSets(prevSets);
            const newGroupedSets = groupedSets.map((group, index) => {
                if (index === groupIndex) {
                    return group.map((set) => ({ ...set, exerciseId }));
                }
                return group;
            });
            return newGroupedSets.flat();
        });
    }, [groupContiguousSets]);

    const handleFormatNumericText = useCallback((set: LocalStateSetType, text: string, key: 'reps' | 'restTime' | 'weight') => {
        const formattedText =
            key === 'weight'
                ? formatFloatNumericInputText(text)
                : formatIntegerNumericInputText(text);

        if (formattedText || !text) {
            setSets((prevSets) =>
                prevSets.map((s) => (s === set ? { ...s, [key]: formattedText } : s))
            );
        }
    }, []);

    const renderGroupedSets = useCallback(() => {
        const groupedSets = groupContiguousSets(sets);

        return groupedSets.map((group, groupIndex) => (
            <View key={groupIndex} style={styles.setGroup}>
                <View style={styles.groupHeader}>
                    <SearchablePicker
                        items={allExercises.map((exercise) => ({
                            label: exercise.name,
                            value: exercise.id.toString(),
                        }))}
                        label={t('exercise')}
                        onValueChange={(itemValue) => updateGroupExercise(groupIndex, Number(itemValue))}
                        selectedValue={group[0].exerciseId ? group[0].exerciseId.toString() : ''}
                        wrapperStyle={styles.exercisePicker}
                    />
                    <View style={styles.groupMoveButtons}>
                        <IconButton
                            disabled={groupIndex === 0}
                            icon="arrow-up"
                            onPress={() => moveGroup(groupIndex, -1)}
                        />
                        <IconButton
                            disabled={groupIndex === groupedSets.length - 1}
                            icon="arrow-down"
                            onPress={() => moveGroup(groupIndex, 1)}
                        />
                    </View>
                </View>
                {group.map((set, index) => (
                    <View key={index} style={styles.setForm}>
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
                        <View style={[styles.row, styles.alignCenter]}>
                            <Text style={styles.labelToggleSwitch}>{t('is_drop_set')}</Text>
                            <Switch
                                onValueChange={(value) => {
                                    setSets((prevSets) =>
                                        prevSets.map((s, i) => (i === sets.indexOf(set) ? { ...s, isDropSet: value } : s))
                                    );
                                }}
                                style={styles.toggleSwitch}
                                value={set.isDropSet}
                            />
                        </View>
                        <View style={styles.row}>
                            <IconButton
                                disabled={sets.indexOf(set) === 0 || sets[sets.indexOf(set) - 1].exerciseId !== set.exerciseId}
                                icon="arrow-up"
                                onPress={() => moveSet(sets.indexOf(set), -1)}
                            />
                            <IconButton
                                disabled={sets.indexOf(set) === sets.length - 1 || sets[sets.indexOf(set) + 1].exerciseId !== set.exerciseId}
                                icon="arrow-down"
                                onPress={() => moveSet(sets.indexOf(set), 1)}
                            />
                        </View>
                        <Button
                            mode="outlined"
                            onPress={() => confirmDeleteSet(sets.indexOf(set))}
                            style={styles.deleteButton}
                        >
                            {t('delete_set')}
                        </Button>
                    </View>
                ))}
                <Button
                    mode="outlined"
                    onPress={() => {
                        const newSet = {
                            exerciseId: group[0].exerciseId,
                            isDropSet: false,
                            reps: '',
                            restTime: '60',
                            weight: '',
                        };
                        setSets((prevSets) => {
                            const newSets = [...prevSets];
                            newSets.splice(sets.indexOf(group[group.length - 1]) + 1, 0, newSet);
                            return newSets;
                        });
                    }}
                    style={styles.addButton}
                >
                    {t('add_set')}
                </Button>
            </View>
        ));
    }, [
        groupContiguousSets,
        sets,
        styles.setGroup,
        styles.groupHeader,
        styles.groupMoveButtons,
        styles.addButton,
        styles.setForm,
        styles.row,
        styles.exercisePicker,
        styles.input,
        styles.alignCenter,
        styles.labelToggleSwitch,
        styles.toggleSwitch,
        styles.deleteButton,
        allExercises,
        t,
        moveGroup,
        weightUnit,
        moveSet,
        confirmDeleteSet,
        updateGroupExercise,
        handleFormatNumericText,
    ]);

    return (
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.container}>
            <CompletionModal
                buttonText={t('ok')}
                isModalVisible={isSaveModalVisible}
                onClose={handleModalClose}
                title={t(`workout_${id ? 'updated' : 'created'}_successfully`)}
            />
            <ThemedModal
                cancelText={t('no')}
                confirmText={t('yes')}
                onClose={() => setIsDeleteModalVisible(false)}
                onConfirm={handleDeleteSet}
                title={t('delete_set_confirmation')}
                visible={isDeleteModalVisible}
            />
            <Appbar.Header mode="small" statusBarHeight={0} style={styles.appbarHeader}>
                <Appbar.Content title={t(id ? 'edit_workout' : 'create_workout')} titleStyle={styles.appbarTitle} />
                <Button
                    mode="outlined"
                    onPress={() => {
                        resetScreenData();
                        navigation.navigate('listWorkouts');
                    }}
                    textColor={colors.onPrimary}
                >
                    {t('cancel')}
                </Button>
            </Appbar.Header>
            <View style={styles.content}>
                <CustomTextInput
                    label={t('workout_title')}
                    onChangeText={setWorkoutTitle}
                    placeholder={t('enter_workout_title')}
                    value={workoutTitle}
                />
                <CustomTextArea
                    label={t('workout_description')}
                    onChangeText={setWorkoutDescription}
                    placeholder={t('enter_workout_description')}
                    value={workoutDescription}
                />
                <CustomPicker
                    items={VOLUME_CALCULATION_TYPES_VALUES.map((level) => ({ label: t(level), value: level }))}
                    label={t('volume_calculation_type')}
                    onValueChange={(value) => setVolumeCalculationType(value as VolumeCalculationTypeType)}
                    selectedValue={volumeCalculationType || ''}
                />
                <View style={[styles.row, styles.formGroupToggleSwitch]}>
                    <Text style={styles.labelToggleSwitch}>{t('repeat_weekly')}</Text>
                    <Switch
                        onValueChange={handleRepeatWeekly}
                        style={styles.toggleSwitch}
                        value={repeatWeekly}
                    />
                </View>
                {repeatWeekly && (
                    <CustomPicker
                        items={[
                            { label: t('none'), value: '' },
                            ...daysOfWeek.map((day) => ({
                                label: t(day.label.toLowerCase()),
                                value: day.value,
                            })),
                        ]}
                        label={t('repeat_on_day_of_week')}
                        onValueChange={(itemValue) =>
                            setRecurringOnWeek((itemValue || undefined) as WorkoutReturnType['recurringOnWeek'])
                        }
                        selectedValue={recurringOnWeek || ''}
                    />
                )}
                <View style={styles.divider} />
                {renderGroupedSets()}
                <Button mode="outlined" onPress={handleAddExercise} style={styles.addButton}>
                    {t('add_exercise')}
                </Button>
            </View>
            {sets.length > 0 && (
                <Button
                    disabled={isSaving}
                    mode="contained"
                    onPress={handleSaveWorkout}
                    style={[styles.button, styles.saveButton]}
                >
                    {t('save_workout')}
                </Button>
            )}
        </ScrollView>
    );
}

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    addButton: {
        marginTop: 16,
    },
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
    deleteButton: {
        backgroundColor: colors.tertiary,
        flex: 1,
        marginTop: 8,
    },
    divider: {
        borderBottomColor: colors.shadow,
        borderBottomWidth: 1,
        marginBottom: 16,
    },
    exercisePicker: {
        flex: 1,
        marginLeft: 8,
    },
    formGroupToggleSwitch: {
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'row',
        marginBottom: 16,
        padding: 8,
    },
    groupHeader: {
        alignItems: 'center',
        borderBottomColor: colors.onSurface,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 8,
    },
    groupMoveButtons: {
        flexDirection: 'row',
    },
    input: {
        flex: 1,
        marginLeft: 8,
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
    setGroup: {
        backgroundColor: colors.background,
        borderColor: colors.onSurface,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 16,
        padding: 8,
    },
    toggleSwitch: {
        marginLeft: 8,
    },
});
