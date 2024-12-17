import AddExerciseModal from '@/components/AddExerciseModal';
import CompletionModal from '@/components/CompletionModal';
import CustomPicker from '@/components/CustomPicker';
import CustomTextArea from '@/components/CustomTextArea';
import CustomTextInput from '@/components/CustomTextInput';
import { Screen } from '@/components/Screen';
import { VOLUME_CALCULATION_TYPES, VOLUME_CALCULATION_TYPES_VALUES } from '@/constants/exercises';
import { IMPERIAL_SYSTEM } from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import {
    addSet,
    addWorkout,
    deleteSet,
    deleteWorkout,
    getAllExercises,
    getWorkoutDetails,
    updateSet,
    updateWorkout,
} from '@/utils/database';
import {
    ExerciseReturnType, ExerciseWithSetsType,
    SetInsertType,
    VolumeCalculationTypeType,
    WorkoutInsertType,
    WorkoutReturnType,
} from '@/utils/types';
import { NavigationProp, useFocusEffect, useRoute } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    BackHandler,
    Platform,
    TextInput as RNTextInput,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import {
    ActivityIndicator,
    Appbar,
    Button,
    Checkbox,
    Dialog,
    IconButton,
    List,
    Portal,
    Switch,
    Text,
    useTheme,
} from 'react-native-paper';

type SetLocalType = {
    exerciseId: number;
    id?: number;
    isDropSet?: boolean;
    isNew?: boolean;
    reps: number;
    restTime: number;
    setOrder?: number;
    supersetName?: null | string;
    weight: number;
};

type WorkoutWithExercisesAndSets = {
    description?: string;
    exercise: ExerciseReturnType;
    sets: SetLocalType[];
    supersetName: null | string;
};

const daysOfWeek = [
    { label: 'Monday', value: 'Monday' },
    { label: 'Tuesday', value: 'Tuesday' },
    { label: 'Wednesday', value: 'Wednesday' },
    { label: 'Thursday', value: 'Thursday' },
    { label: 'Friday', value: 'Friday' },
    { label: 'Saturday', value: 'Saturday' },
    { label: 'Sunday', value: 'Sunday' },
];

type RouteParams = {
    id?: string;
};

export default function CreateWorkout({ navigation }: { navigation: NavigationProp<any> }) {
    const route = useRoute();
    const { id } = (route.params as RouteParams) || {};
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [workoutTitle, setWorkoutTitle] = useState('');
    const [workoutDescription, setWorkoutDescription] = useState('');
    const [recurringOnWeek, setRecurringOnWeek] = useState('');
    const [volumeCalculationType, setVolumeCalculationType] = useState<VolumeCalculationTypeType>('');

    const [workout, setWorkout] = useState<WorkoutWithExercisesAndSets[]>([]);
    const [workoutDetails, setWorkoutDetails] = useState<null | { exercisesWithSets: ExerciseWithSetsType[]; workout: WorkoutReturnType; }>(null);
    const [supersetName, setSupersetName] = useState('');
    const [selectedExercises, setSelectedExercises] = useState<number[]>([]);
    const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
    const [isSupersetModalOpen, setIsSupersetModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);

    const [allExercises, setAllExercises] = useState<ExerciseReturnType[]>([]);
    const { unitSystem, weightUnit } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    const loadWorkout = useCallback(async () => {
        try {
            const workoutData = await getWorkoutDetails(Number(id));
            if (workoutData) {
                setWorkoutDetails(workoutData);

                const { exercisesWithSets, workout } = workoutData;
                setWorkoutTitle(workout.title || '');
                setWorkoutDescription(workout.description || '');
                setRecurringOnWeek(workout.recurringOnWeek || '');
                setVolumeCalculationType(workout.volumeCalculationType || '');

                const workoutExercises = exercisesWithSets.map((exercise) => ({
                    description: exercise.description || '',
                    exercise: {
                        description: exercise.description,
                        id: exercise.id,
                        muscleGroup: exercise.muscleGroup,
                        name: exercise.name,
                    },
                    sets: exercise.sets.map((set) => ({
                        exerciseId: exercise.id,
                        id: set.id,
                        isDropSet: set.isDropSet,
                        reps: set.reps,
                        restTime: set.restTime,
                        setOrder: set.setOrder,
                        supersetName: set.supersetName,
                        weight: set.weight,
                    })),
                    supersetName: exercise.sets.find((set) => set.supersetName)?.supersetName || null,
                }));

                setWorkout(workoutExercises);
            }
        } catch (error) {
            console.error(t('failed_to_load_workout'), error);
            Alert.alert(t('error'), t('failed_to_load_workout'));
        } finally {
            setIsLoading(false);
        }
    }, [id, t]);

    useFocusEffect(
        useCallback(() => {
            if (id) {
                loadWorkout();
            }
        }, [id, loadWorkout])
    );

    const resetScreenData = useCallback(() => {
        setWorkout([]);
        setSupersetName('');
        setSelectedExercises([]);
        setWorkoutTitle('');
        setWorkoutDescription('');
        setRecurringOnWeek('');
        setVolumeCalculationType('');
    }, []);

    useFocusEffect(
        useCallback(() => {
            return () => {
                resetScreenData();
            };
        }, [resetScreenData])
    );

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                navigation.goBack();
                return true;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => {
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            };
        }, [navigation])
    );

    useFocusEffect(
        useCallback(() => {
            const loadExercises = async () => {
                try {
                    setIsLoading(true);
                    const exercises = await getAllExercises();
                    setAllExercises(exercises);
                } catch (error) {
                    console.error(t('failed_to_load_exercises'), error);
                    Alert.alert(t('error'), t('failed_to_load_exercises'));
                } finally {
                    setIsLoading(false);
                }
            };

            loadExercises();
        }, [t])
    );

    const addExerciseToWorkout = (exerciseId: number) => {
        const exercise = allExercises.find((ex) => ex.id === exerciseId);
        if (exercise) {
            setWorkout((prevWorkout) => [
                ...prevWorkout,
                { exercise, sets: [], supersetName: null },
            ]);
        }
        setIsExerciseModalOpen(false);
    };

    const addSetToExercise = (exerciseIndex: number) => {
        setWorkout((prevWorkout) => {
            const newWorkout = [...prevWorkout];
            const updatedExercise = { ...newWorkout[exerciseIndex] };
            updatedExercise.sets = [
                ...updatedExercise.sets,
                {
                    exerciseId: updatedExercise.exercise.id,
                    isDropSet: false,
                    isNew: true,
                    reps: 0,
                    restTime: 60,
                    weight: 0,
                },
            ];
            newWorkout[exerciseIndex] = updatedExercise;
            return newWorkout;
        });
    };

    const toggleExerciseSelection = (index: number) => {
        setSelectedExercises((prev) =>
            (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index])
        );
    };

    const createSuperset = () => {
        if (selectedExercises.length < 2 || !supersetName) {
            Alert.alert(t('validation_error'), t('superset_requires_min_exercises'));
            return;
        }

        const existingSupersetNames = workout
            .filter((ex) => ex.supersetName)
            .map((ex) => ex.supersetName?.toLowerCase());

        if (existingSupersetNames.includes(supersetName.toLowerCase())) {
            Alert.alert(t('validation_error'), t('superset_name_exists'));
            return;
        }

        setWorkout((prevWorkout) => {
            const newWorkout = [...prevWorkout];
            const supersetExercises = selectedExercises.map(
                (index) => newWorkout[index]
            );

            selectedExercises
                .sort((a, b) => b - a)
                .forEach((index) => {
                    newWorkout.splice(index, 1);
                });

            const insertIndex = Math.min(...selectedExercises);
            supersetExercises.forEach((exercise, index) => {
                newWorkout.splice(insertIndex + index, 0, {
                    ...exercise,
                    supersetName,
                });
            });

            return newWorkout;
        });

        setSupersetName('');
        setSelectedExercises([]);
        setIsSupersetModalOpen(false);
    };

    const handleSaveWorkout = useCallback(async () => {
        if (!workoutTitle.trim()) {
            Alert.alert(t('validation_error'), t('workout_title_required'));
            return;
        }

        if (workout.length === 0) {
            Alert.alert(t('validation_error'), t('workout_must_have_exercises'));
            return;
        }

        const exercisesWithoutSets = workout.filter((ex) => ex.sets.length === 0);
        if (exercisesWithoutSets.length > 0) {
            Alert.alert(
                t('validation_error'),
                t('all_exercises_must_have_at_least_one_set')
            );

            return;
        }

        setIsSaving(true);

        try {
            const workoutData: WorkoutInsertType = {
                description: workoutDescription,
                recurringOnWeek: (recurringOnWeek || undefined) as WorkoutReturnType['recurringOnWeek'],
                title: workoutTitle,
                volumeCalculationType: volumeCalculationType || VOLUME_CALCULATION_TYPES.NONE,
            };

            let workoutId: number;

            if (id) {
                workoutId = Number(id);
                await updateWorkout(workoutId, workoutData);

                const { exercisesWithSets = [] } = workoutDetails || {};
                const originalSetIds = exercisesWithSets.flatMap((exercise) =>
                    exercise.sets.map((set) => set.id)
                );

                let setOrder = 0;
                for (const workoutWithExercisesAndSets of workout) {
                    for (const set of workoutWithExercisesAndSets.sets) {
                        const setData: SetInsertType = {
                            exerciseId: workoutWithExercisesAndSets.exercise.id,
                            isDropSet: set.isDropSet,
                            reps: set.reps,
                            restTime: set.restTime,
                            setOrder: setOrder++,
                            supersetName: workoutWithExercisesAndSets.supersetName || '',
                            weight: set.weight,
                            workoutId,
                        };

                        if (set.isNew) {
                            await addSet(setData);
                        } else {
                            await updateSet(set.id!, setData);
                        }
                    }
                }

                // Identify sets to delete
                const currentSetIds = workout.flatMap((exercise) =>
                    exercise.sets.map((set) => set.id)
                );

                const setsToDelete = originalSetIds.filter(
                    (originalId) => !currentSetIds.includes(originalId)
                );

                for (const setId of setsToDelete) {
                    await deleteSet(setId);
                }
            } else {
                workoutId = await addWorkout(workoutData);

                let setOrder = 0;
                for (const workoutWithExercisesAndSets of workout) {
                    for (const set of workoutWithExercisesAndSets.sets) {
                        const setData: SetInsertType = {
                            exerciseId: workoutWithExercisesAndSets.exercise.id,
                            isDropSet: set.isDropSet,
                            reps: set.reps,
                            restTime: set.restTime,
                            setOrder: setOrder++,
                            supersetName: workoutWithExercisesAndSets.supersetName || '',
                            weight: set.weight,
                            workoutId,
                        };

                        await addSet(setData);
                    }
                }
            }

            setIsModalVisible(true);
        } catch (error) {
            console.error(t('failed_to_save_workout'), error);
            Alert.alert(t('error'), t('failed_to_save_workout'));
        } finally {
            setIsSaving(false);
        }
    }, [workoutDetails, workoutTitle, workout, t, workoutDescription, recurringOnWeek, volumeCalculationType, id]);

    const handleDeleteWorkout = useCallback(async () => {
        if (id) {
            try {
                await deleteWorkout(Number(id));
                navigation.navigate('listWorkouts');
            } catch (error) {
                console.error(t('failed_to_delete_workout'), error);
                Alert.alert(t('error'), t('failed_to_delete_workout'));
            }
        }
    }, [id, t, navigation]);

    const handleModalClose = useCallback(() => {
        setIsModalVisible(false);
        resetScreenData();
        navigation.navigate('listWorkouts');
    }, [navigation, resetScreenData]);

    const moveExercise = (fromIndex: number, direction: 'down' | 'up') => {
        setWorkout((prevWorkout) => {
            const newWorkout = [...prevWorkout];
            const movedExercise = newWorkout[fromIndex];
            const isSupersetExercise = !!movedExercise.supersetName;

            const findSupersetBounds = (index: number) => {
                let start = index;
                let end = index;
                const { supersetName } = newWorkout[index];

                if (supersetName) {
                    while (start > 0 && newWorkout[start - 1].supersetName === supersetName) {
                        start--;
                    }
                    while (end < newWorkout.length - 1 && newWorkout[end + 1].supersetName === supersetName) {
                        end++;
                    }
                }

                return { end, start };
            };

            if (isSupersetExercise) {
                const { end, start } = findSupersetBounds(fromIndex);

                // If moving up within the superset
                if (direction === 'up' && fromIndex > start) {
                    const targetIndex = fromIndex - 1;
                    [newWorkout[fromIndex], newWorkout[targetIndex]] = [newWorkout[targetIndex], newWorkout[fromIndex]];
                }
                // If moving down within the superset
                else if (direction === 'down' && fromIndex < end) {
                    const targetIndex = fromIndex + 1;
                    [newWorkout[fromIndex], newWorkout[targetIndex]] = [newWorkout[targetIndex], newWorkout[fromIndex]];
                }
            } else {
                // For exercises not in a superset, follow the existing movement logic
                const targetIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;

                // Ensure we're not going out of bounds
                if (targetIndex >= 0 && targetIndex < newWorkout.length) {
                    const nextItem = newWorkout[targetIndex];

                    if (nextItem && nextItem.supersetName) {
                        // Move past the entire superset if the target is within one
                        const { end, start } = findSupersetBounds(targetIndex);
                        let newIndex = direction === 'up' ? start : end + 1;

                        // Remove the exercise
                        newWorkout.splice(fromIndex, 1);

                        // Adjust newIndex if necessary
                        if (newIndex > fromIndex) {
                            newIndex -= 1;
                        }

                        // Insert the exercise at the new index
                        newWorkout.splice(newIndex, 0, movedExercise);
                    } else {
                        // Normal movement
                        newWorkout.splice(fromIndex, 1);

                        // Adjust targetIndex if necessary
                        let adjustedTargetIndex = targetIndex;
                        if (targetIndex > fromIndex) {
                            adjustedTargetIndex -= 1;
                        }

                        newWorkout.splice(adjustedTargetIndex, 0, movedExercise);
                    }
                }
            }

            return newWorkout;
        });
    };

    const moveSuperset = (fromIndex: number, direction: 'down' | 'up') => {
        setWorkout((prevWorkout) => {
            const newWorkout = [...prevWorkout];
            const { supersetName } = newWorkout[fromIndex];
            if (!supersetName) {
                return newWorkout;
            }

            const supersetExercises = newWorkout.filter(
                (ex) => ex.supersetName === supersetName
            );
            const firstIndex = newWorkout.findIndex(
                (ex) => ex.supersetName === supersetName
            );
            const lastIndex = firstIndex + supersetExercises.length - 1;

            if (direction === 'up' && firstIndex > 0) {
                const targetIndex = Math.max(0, firstIndex - 1);
                const moveLength = lastIndex - firstIndex + 1;
                const itemAbove = newWorkout[targetIndex - 1];

                if (itemAbove && itemAbove.supersetName && itemAbove.supersetName !== supersetName) {
                    // Check entire superset length above and adjust
                    const aboveSupersetStart = newWorkout.findIndex(
                        (ex) => ex.supersetName === itemAbove.supersetName
                    );

                    newWorkout.splice(firstIndex, moveLength);
                    newWorkout.splice(aboveSupersetStart, 0, ...supersetExercises);
                } else {
                    // Normal move up
                    newWorkout.splice(firstIndex, moveLength);
                    newWorkout.splice(targetIndex, 0, ...supersetExercises);
                }
            } else if (direction === 'down' && lastIndex < newWorkout.length - 1) {
                const targetIndex = Math.min(newWorkout.length - 1, lastIndex + 1);
                const moveLength = lastIndex - firstIndex + 1;
                const itemBelow = newWorkout[targetIndex + 1];

                if (itemBelow && itemBelow.supersetName && itemBelow.supersetName !== supersetName) {
                    // Check entire superset length below and adjust
                    const belowSupersetEnd = newWorkout.lastIndexOf(
                        newWorkout.findLast((ex) => ex.supersetName === itemBelow.supersetName) ?? {} as WorkoutWithExercisesAndSets
                    );
                    const belowSupersetCount = newWorkout.filter(
                        (ex) => ex.supersetName === itemBelow.supersetName
                    ).length;

                    newWorkout.splice(firstIndex, moveLength);
                    newWorkout.splice(belowSupersetEnd + 1 - belowSupersetCount, 0, ...supersetExercises);
                } else {
                    // Normal move down
                    newWorkout.splice(firstIndex, moveLength);
                    newWorkout.splice(targetIndex - moveLength + 1, 0, ...supersetExercises);
                }
            }

            return newWorkout;
        });
    };

    const renderWorkoutWithExercisesAndSetss = () => {
        return workout.reduce(
            (acc: any[], workoutWithExercisesAndSets: WorkoutWithExercisesAndSets, exerciseIndex: number) => {
                const isSuperset = !!workoutWithExercisesAndSets.supersetName;
                const isFirstInSuperset = isSuperset
                    && (exerciseIndex === 0
                        || workout[exerciseIndex - 1].supersetName
                        !== workoutWithExercisesAndSets.supersetName);

                if (isFirstInSuperset) {
                    acc.push(
                        <View key={`superset-${exerciseIndex}`} style={styles.supersetContainer}>
                            <View style={styles.supersetHeader}>
                                <View>
                                    <Text style={styles.supersetTitle}>
                                        {t('superset')}: {workoutWithExercisesAndSets.supersetName || ''}
                                    </Text>
                                </View>
                                <View style={styles.supersetButtons}>
                                    <IconButton
                                        disabled={exerciseIndex === 0}
                                        icon="arrow-up"
                                        onPress={() => moveSuperset(exerciseIndex, 'up')}
                                    />
                                    <IconButton
                                        disabled={
                                            exerciseIndex
                                            >= workout.length - workout.filter((ex) => ex.supersetName === workoutWithExercisesAndSets.supersetName).length
                                        }
                                        icon="arrow-down"
                                        onPress={() => moveSuperset(exerciseIndex, 'down')}
                                    />
                                </View>
                            </View>
                            {renderExercise(workoutWithExercisesAndSets, exerciseIndex)}
                        </View>
                    );
                } else if (isSuperset) {
                    const lastSuperset = acc[acc.length - 1];
                    acc[acc.length - 1] = React.cloneElement(
                        lastSuperset,
                        {},
                        [...lastSuperset.props.children, renderExercise(workoutWithExercisesAndSets, exerciseIndex)]
                    );
                } else {
                    acc.push(renderExercise(workoutWithExercisesAndSets, exerciseIndex));
                }
                return acc;
            },
            []
        );
    };

    function renderExercise(workoutWithExercisesAndSets: WorkoutWithExercisesAndSets, exerciseIndex: number) {
        const isSuperset = !!workoutWithExercisesAndSets.supersetName;
        const canMoveUp = isSuperset
            ? workout[exerciseIndex - 1]?.supersetName === workoutWithExercisesAndSets.supersetName
            : exerciseIndex !== 0;

        const canMoveDown = isSuperset
            ? workout[exerciseIndex + 1]?.supersetName === workoutWithExercisesAndSets.supersetName
            : exerciseIndex !== workout.length - 1;

        return (
            <View key={exerciseIndex} style={styles.exerciseContainer}>
                <View style={styles.moveButtonsContainer}>
                    <IconButton
                        icon="delete"
                        onPress={() => removeExercise(exerciseIndex)}
                        size={20}
                    />
                    <IconButton
                        disabled={!canMoveUp}
                        icon="arrow-up"
                        onPress={() => moveExercise(exerciseIndex, 'up')}
                    />
                    <IconButton
                        disabled={!canMoveDown}
                        icon="arrow-down"
                        onPress={() => moveExercise(exerciseIndex, 'down')}
                    />
                </View>
                <List.Accordion
                    description={workoutWithExercisesAndSets.exercise.description}
                    left={(props) => <List.Icon {...props} icon="dumbbell" />}
                    title={workoutWithExercisesAndSets.exercise.name}
                >
                    {workoutWithExercisesAndSets.sets.map((set, setIndex) => (
                        <View key={setIndex} style={styles.setContainer}>
                            <Text style={styles.setText}>
                                {t('set')} {setIndex + 1}:
                            </Text>
                            <RNTextInput
                                keyboardType="numeric"
                                onChangeText={(text) =>
                                    updateLocalSet(exerciseIndex, setIndex, 'reps', parseInt(text))
                                }
                                placeholder={t('reps')}
                                style={styles.smallInput}
                                value={set.reps.toString()}
                            />
                            <RNTextInput
                                keyboardType="numeric"
                                onChangeText={(text) =>
                                    updateLocalSet(exerciseIndex, setIndex, 'weight', parseFloat(text))
                                }
                                placeholder={t('weight')}
                                style={styles.smallInput}
                                value={set.weight.toString()}
                            />
                            <RNTextInput
                                keyboardType="numeric"
                                onChangeText={(text) =>
                                    updateLocalSet(exerciseIndex, setIndex, 'restTime', parseInt(text))
                                }
                                placeholder={t('rest_time_sec')}
                                style={styles.smallInput}
                                value={set.restTime.toString()}
                            />
                            <View style={styles.row}>
                                <Text style={styles.labelToggleSwitch}>{t('is_drop_set')}</Text>
                                <Switch
                                    onValueChange={(value) =>
                                        updateLocalSet(exerciseIndex, setIndex, 'isDropSet', value)
                                    }
                                    value={!!set.isDropSet}
                                />
                            </View>
                            <IconButton
                                icon="delete"
                                onPress={() => removeSet(exerciseIndex, setIndex)}
                                size={20}
                            />
                        </View>
                    ))}
                    <Button
                        mode="text"
                        onPress={() => addSetToExercise(exerciseIndex)}
                        style={styles.addSetButton}
                    >
                        {t('add_set')}
                    </Button>
                </List.Accordion>
            </View>
        );
    }

    function updateLocalSet(
        exerciseIndex: number,
        setIndex: number,
        field: keyof SetLocalType,
        value: any
    ) {
        setWorkout((prevWorkout) => {
            const newWorkout = [...prevWorkout];
            const updatedExercise = { ...newWorkout[exerciseIndex] };
            const updatedSets = [...updatedExercise.sets];
            updatedSets[setIndex] = {
                ...updatedSets[setIndex],
                [field]: field === 'isDropSet' ? value : isNaN(value) ? 0 : value,
            };
            updatedExercise.sets = updatedSets;
            newWorkout[exerciseIndex] = updatedExercise;
            return newWorkout;
        });
    }

    function removeSet(exerciseIndex: number, setIndex: number) {
        setWorkout((prevWorkout) => {
            const newWorkout = [...prevWorkout];
            const updatedExercise = { ...newWorkout[exerciseIndex] };
            updatedExercise.sets = updatedExercise.sets.filter(
                (_, idx) => idx !== setIndex
            );
            newWorkout[exerciseIndex] = updatedExercise;
            return newWorkout;
        });
    }

    function removeExercise(exerciseIndex: number) {
        setWorkout((prevWorkout) => {
            let newWorkout = prevWorkout.filter((_, idx) => idx !== exerciseIndex);
            const removedExercise = prevWorkout[exerciseIndex];

            if (removedExercise.supersetName) {
                const remainingSupersetExercises = newWorkout.filter(
                    (ex) => ex.supersetName === removedExercise.supersetName
                );
                if (remainingSupersetExercises.length < 2) {
                    newWorkout = newWorkout.map((ex) =>
                        (ex.supersetName === removedExercise.supersetName
                            ? { ...ex, supersetName: null }
                            : ex)
                    );
                }
            }

            return newWorkout;
        });
    }

    const canSaveWorkout = useMemo(() => {
        if (!workoutTitle.trim()) {
            return false;
        }

        if (workout.length === 0) {
            return false;
        }

        for (const ex of workout) {
            if (ex.sets.length === 0) {
                return false;
            }
        }

        return true;
    }, [workoutTitle, workout]);

    return (
        <Screen style={styles.container}>
            <CompletionModal
                buttonText={t('ok')}
                isModalVisible={isModalVisible}
                onClose={handleModalClose}
                title={t('workout_saved_successfully')}
            />
            <Appbar.Header
                mode="small"
                statusBarHeight={0}
                style={styles.appbarHeader}
            >
                <Appbar.Content
                    title={t('create_workout')}
                    titleStyle={styles.appbarTitle}
                />
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
            <Portal>
                <AddExerciseModal
                    isVisible={isExerciseModalOpen}
                    onClose={() => setIsExerciseModalOpen(false)}
                    onExerciseSelected={addExerciseToWorkout}
                />
                <Dialog
                    onDismiss={() => setIsSupersetModalOpen(false)}
                    visible={isSupersetModalOpen}
                >
                    <Dialog.Title>{t('create_superset')}</Dialog.Title>
                    <Dialog.Content>
                        <CustomTextInput
                            label={t('superset_name')}
                            onChangeText={setSupersetName}
                            placeholder={t('enter_superset_name')}
                            value={supersetName}
                        />
                        <Text style={styles.label}>{t('select_exercises')}</Text>
                        {workout.map((exercise, index) => (
                            <View key={index} style={styles.checkboxContainer}>
                                <Checkbox
                                    onPress={() => toggleExerciseSelection(index)}
                                    status={
                                        selectedExercises.includes(index)
                                            ? 'checked'
                                            : 'unchecked'
                                    }
                                />
                                <Text>{exercise.exercise.name}</Text>
                            </View>
                        ))}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button
                            onPress={() => {
                                setSupersetName('');
                                setSelectedExercises([]);
                                setIsSupersetModalOpen(false);
                            }}
                        >
                            {t('cancel')}
                        </Button>
                        <Button
                            disabled={selectedExercises.length < 2 || !supersetName}
                            onPress={createSuperset}
                        >
                            {t('create_superset')}
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
            <ScrollView contentContainerStyle={styles.content}>
                <List.Accordion
                    left={(props) => <List.Icon {...props} icon="information-outline" />}
                    title={t('workout_details')}
                >
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
                        items={VOLUME_CALCULATION_TYPES_VALUES.map((value) => ({
                            label: t(value),
                            value,
                        }))}
                        label={t('volume_calculation_type')}
                        onValueChange={(value) =>
                            setVolumeCalculationType(value as VolumeCalculationTypeType)
                        }
                        selectedValue={volumeCalculationType}
                    />
                    <CustomPicker
                        items={[
                            { label: t('none'), value: '' },
                            ...daysOfWeek.map((day) => ({
                                label: t(day.label.toLowerCase()),
                                value: day.value,
                            })),
                        ]}
                        label={t('repeat_on_day_of_week')}
                        onValueChange={(value) => setRecurringOnWeek(value)}
                        selectedValue={recurringOnWeek}
                    />
                </List.Accordion>
                <Button
                    mode="contained"
                    onPress={() => setIsExerciseModalOpen(true)}
                    style={styles.button}
                >
                    {t('add_exercise')}
                </Button>
                <Button
                    disabled={workout.length < 2}
                    mode="contained"
                    onPress={() => setIsSupersetModalOpen(true)}
                    style={styles.button}
                >
                    {t('create_superset')}
                </Button>
                <View style={styles.workoutContainer}>{renderWorkoutWithExercisesAndSetss()}</View>
            </ScrollView>
            <View style={styles.footer}>
                <Button
                    disabled={isSaving || isLoading || !canSaveWorkout}
                    mode="contained"
                    onPress={handleSaveWorkout}
                    style={styles.button}
                >
                    {isSaving ? t('saving') : t('save_workout')}
                </Button>
                {id ? (
                    <Button
                        mode="contained"
                        onPress={handleDeleteWorkout}
                        style={styles.button}
                    >
                        {t('delete_workout')}
                    </Button>
                ) : null}
            </View>
            {(isSaving || isLoading) && (
                <View style={styles.overlay}>
                    <ActivityIndicator color={colors.primary} size="large" />
                </View>
            )}
        </Screen>
    );
}

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    addSetButton: {
        marginBottom: 8,
        marginTop: 12,
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
    checkboxContainer: {
        alignItems: 'center',
        flexDirection: 'row',
        marginVertical: 8,
    },
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    content: {
        padding: 16,
    },
    exerciseContainer: {
        backgroundColor: colors.surface,
        borderColor: colors.primary,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    footer: {
        alignItems: 'center',
        borderTopColor: colors.shadow,
        borderTopWidth: 1,
        padding: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    labelToggleSwitch: {
        color: colors.onSurface,
        fontSize: 16,
        fontWeight: '600',
    },
    moveButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        flex: 1,
        justifyContent: 'center',
    },
    row: {
        alignItems: 'center',
        flexDirection: 'row',
        marginVertical: 8,
    },
    setContainer: {
        alignItems: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 8,
    },
    setText: {
        color: colors.onSurface,
        marginRight: 8,
    },
    smallInput: {
        backgroundColor: colors.surface,
        borderColor: colors.onSurface,
        borderRadius: 4,
        borderWidth: 1,
        color: colors.onSurface,
        marginHorizontal: 4,
        marginVertical: 4,
        padding: 4,
        textAlign: 'center',
        width: 60,
    },
    supersetButtons: {
        flexDirection: 'row',
    },
    supersetContainer: {
        borderColor: colors.primary,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 16,
        padding: 8,
    },
    supersetHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    supersetTitle: {
        color: colors.onSurface,
        fontSize: 16,
        fontWeight: '600',
    },
    workoutContainer: {
        paddingBottom: 32,
    },
});
