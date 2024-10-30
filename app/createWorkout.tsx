import CompletionModal from '@/components/CompletionModal';
import CustomPicker from '@/components/CustomPicker';
import CustomTextInput from '@/components/CustomTextInput';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { NavigationProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    View,
    ScrollView,
    StyleSheet,
    Platform,
    Alert,
    BackHandler,
    TextInput as RNTextInput,
} from 'react-native';
import {
    ActivityIndicator,
    Appbar,
    Button,
    Dialog,
    Portal,
    Checkbox,
    IconButton,
    useTheme,
    Text,
} from 'react-native-paper';

type Exercise = {
    name: string;
    muscleGroup: string;
    type: string;
    description: string;
};

type Set = {
    reps: number;
    weight: number;
};

type WorkoutExercise = {
    exercise: Exercise;
    sets: Set[];
    supersetName: string | null;
};

const exerciseList: Exercise[] = [
    { name: 'Bench Press', muscleGroup: 'chest', type: 'compound', description: 'A chest exercise where you press a barbell upwards while lying on a bench.' },
    { name: 'Inclined Bench Press', muscleGroup: 'chest', type: 'compound', description: 'A variation of the bench press performed on an inclined bench to target the upper chest.' },
    { name: 'Declined Bench Press', muscleGroup: 'chest', type: 'compound', description: 'A variation of the bench press performed on a declined bench to target the lower chest.' },
    { name: 'Overhead Shoulder Press', muscleGroup: 'shoulders', type: 'compound', description: 'A shoulder exercise where you press a weight overhead while standing or seated.' },
    { name: 'Deadlift', muscleGroup: 'back', type: 'compound', description: 'A full-body exercise that involves lifting a barbell from the ground to a standing position.' },
    { name: 'Pec Fly Machine', muscleGroup: 'chest', type: 'machine', description: 'A machine exercise that isolates the chest muscles by mimicking the motion of a fly.' },
    { name: 'Leg Extension Machine', muscleGroup: 'legs', type: 'machine', description: 'A machine exercise that targets the quadriceps by extending the legs from a seated position.' },
    { name: 'Squat', muscleGroup: 'legs', type: 'compound', description: 'A lower body exercise where you bend your knees and hips to lower your body, then stand back up.' },
    { name: 'Barbell Back Squat', muscleGroup: 'legs', type: 'compound', description: 'A lower body exercise where you bend your knees and hips to lower your body, with a barbell placed across your upper back, then stand back up.' },
    { name: 'Leg Press Machine', muscleGroup: 'legs', type: 'machine', description: 'A machine exercise where you push a weight away from you using your legs.' },
    { name: 'Lat Pulldown', muscleGroup: 'back', type: 'machine', description: 'A machine exercise that targets the upper back by pulling a bar down towards your chest.' },
    { name: 'Pull-Up', muscleGroup: 'back', type: 'bodyweight', description: 'An upper body exercise where you lift your body up to a bar using your back and arm muscles.' },
    { name: 'Seated Row', muscleGroup: 'back', type: 'machine', description: 'A machine exercise that targets the back muscles by pulling a handle towards your torso while seated.' },
    { name: 'Bicep Curl', muscleGroup: 'arms', type: 'isolation', description: 'An arm exercise that targets the biceps by lifting a weight towards your shoulder.' },
    { name: 'Tricep Overhead Extension', muscleGroup: 'arms', type: 'isolation', description: 'An arm exercise that targets the triceps by extending the arm at the elbow.' },
];

const muscleGroups = Array.from(
    new Set(exerciseList.map((ex) => ex.muscleGroup))
);

const CreateWorkout = () => {
    const navigation = useNavigation<NavigationProp<any>>();
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [workout, setWorkout] = useState<WorkoutExercise[]>([{ exercise:{ name:'Declined Bench Press',muscleGroup:'chest',type:'compound',description:'A variation of the bench press performed on a declined bench to target the lower chest.' },sets:[],supersetName:'ppp' },{ exercise:{ name:'Pec Fly Machine',muscleGroup:'chest',type:'machine',description:'A machine exercise that isolates the chest muscles by mimicking the motion of a fly.' },sets:[],supersetName:'ppp' },{ exercise:{ name:'Bench Press',muscleGroup:'chest',type:'compound',description:'A chest exercise where you press a barbell upwards while lying on a bench.' },sets:[],supersetName:'www' },{ exercise:{ name:'Inclined Bench Press',muscleGroup:'chest',type:'compound',description:'A variation of the bench press performed on an inclined bench to target the upper chest.' },sets:[],supersetName:'www' },{ exercise:{ name:'Overhead Shoulder Press',muscleGroup:'shoulders',type:'compound',description:'A shoulder exercise where you press a weight overhead while standing or seated.' },sets:[],supersetName:null }]);
    const [supersetName, setSupersetName] = useState('');
    const [selectedExercises, setSelectedExercises] = useState<number[]>([]);
    const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null);
    const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
    const [isSupersetModalOpen, setIsSupersetModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);

    const resetScreenData = useCallback(() => {
        setWorkout([]);
        setSupersetName('');
        setSelectedExercises([]);
        setSelectedMuscleGroup(null);
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

    const addExerciseToWorkout = (exercise: Exercise) => {
        setWorkout((prevWorkout) => [
            ...prevWorkout,
            { exercise, sets: [], supersetName: null },
        ]);
        setIsExerciseModalOpen(false);
        setSelectedMuscleGroup(null);
    };

    const addSetToExercise = (exerciseIndex: number) => {
        setWorkout((prevWorkout) => {
            const newWorkout = [...prevWorkout];
            const updatedExercise = { ...newWorkout[exerciseIndex] };
            updatedExercise.sets = [...updatedExercise.sets, { reps: 0, weight: 0 }];
            newWorkout[exerciseIndex] = updatedExercise;
            return newWorkout;
        });
    };

    const toggleExerciseSelection = (index: number) => {
        setSelectedExercises((prev) =>
            prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
        );
    };

    const createSuperset = () => {
        if (selectedExercises.length < 2 || !supersetName) {
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
        if (workout.length === 0) {
            Alert.alert(t('validation_error'), t('workout_must_have_exercises'));
            return;
        }

        setIsSaving(true);

        try {
            // Save workout logic here
            // await addWorkout(workout);
            setIsModalVisible(true);
        } catch (error) {
            console.error(t('failed_to_save_workout'), error);
        } finally {
            setIsSaving(false);
        }
    }, [workout, t]);

    const handleModalClose = useCallback(() => {
        setIsModalVisible(false);
        resetScreenData();
        navigation.navigate('listWorkouts');
    }, [navigation, resetScreenData]);

    const moveExercise = (fromIndex: number, direction: 'up' | 'down') => {
        setWorkout((prevWorkout) => {
            const newWorkout = [...prevWorkout];
            const movedExercise = newWorkout[fromIndex];
            const isSupersetExercise = !!movedExercise.supersetName;

            const findSupersetBounds = (index: number) => {
                let start = index;
                let end = index;
                const supersetName = newWorkout[index].supersetName;

                if (supersetName) {
                    while (start > 0 && newWorkout[start - 1].supersetName === supersetName) {
                        start--;
                    }
                    while (end < newWorkout.length - 1 && newWorkout[end + 1].supersetName === supersetName) {
                        end++;
                    }
                }
                return { start, end };
            };

            if (isSupersetExercise) {
                const { start, end } = findSupersetBounds(fromIndex);

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
                        const { start, end } = findSupersetBounds(targetIndex);
                        const newIndex = direction === 'up' ? start : end + 1;
                        newWorkout.splice(fromIndex, 1);
                        newWorkout.splice(newIndex, 0, movedExercise);
                    } else {
                        // Normal movement
                        newWorkout.splice(fromIndex, 1);
                        newWorkout.splice(targetIndex, 0, movedExercise);
                    }
                }
            }

            return newWorkout;
        });
    };

    const moveSuperset = (fromIndex: number, direction: 'up' | 'down') => {
        setWorkout((prevWorkout) => {
            const newWorkout = [...prevWorkout];
            const supersetName = newWorkout[fromIndex].supersetName;
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
                        newWorkout.findLast((ex) => ex.supersetName === itemBelow.supersetName) ?? {} as WorkoutExercise
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

    const renderWorkoutExercises = () => {
        return workout.reduce(
            (acc: any[], workoutExercise: WorkoutExercise, exerciseIndex: number) => {
                const isSuperset = !!workoutExercise.supersetName;
                const isFirstInSuperset =
                    isSuperset &&
                    (exerciseIndex === 0 ||
                        workout[exerciseIndex - 1].supersetName !==
                        workoutExercise.supersetName);

                if (isFirstInSuperset) {
                    acc.push(
                        <View key={`superset-${exerciseIndex}`} style={styles.supersetContainer}>
                            <View style={styles.supersetHeader}>
                                <View>
                                    <Text>
                                        {t('superset')}: {workoutExercise.supersetName || ''}
                                    </Text>
                                </View>
                                <View style={styles.supersetButtons}>
                                    <IconButton
                                        icon="arrow-up"
                                        onPress={() => moveSuperset(exerciseIndex, 'up')}
                                        disabled={exerciseIndex === 0}
                                    />
                                    <IconButton
                                        icon="arrow-down"
                                        onPress={() => moveSuperset(exerciseIndex, 'down')}
                                        disabled={exerciseIndex >= workout.length - workout.filter((ex) => ex.supersetName === workoutExercise.supersetName).length}
                                    />
                                </View>
                            </View>
                            {renderExercise(workoutExercise, exerciseIndex)}
                        </View>
                    );
                } else if (isSuperset) {
                    const lastSuperset = acc[acc.length - 1];
                    acc[acc.length - 1] = React.cloneElement(
                        lastSuperset,
                        {},
                        [...lastSuperset.props.children, renderExercise(workoutExercise, exerciseIndex)]
                    );
                } else {
                    acc.push(renderExercise(workoutExercise, exerciseIndex));
                }
                return acc;
            },
            []
        );
    };

    function renderExercise(workoutExercise: WorkoutExercise, exerciseIndex: number) {
        const isSuperset = !!workoutExercise.supersetName;

        return (
            <View key={exerciseIndex} style={styles.exerciseContainer}>
                <View style={styles.exerciseHeader}>
                    <Text style={styles.exerciseTitle}>{workoutExercise.exercise.name}</Text>
                    <IconButton
                        icon="close"
                        size={20}
                        onPress={() => removeExercise(exerciseIndex)}
                    />
                </View>
                <Text style={styles.exerciseDescription}>
                    {workoutExercise.exercise.description}
                </Text>
                {workoutExercise.sets.map((set, setIndex) => (
                    <View key={setIndex} style={styles.setContainer}>
                        <Text style={styles.setText}>
                            {t('set')} {setIndex + 1}:
                        </Text>
                        <RNTextInput
                            style={styles.smallInput}
                            keyboardType="numeric"
                            value={set.reps.toString()}
                            onChangeText={(text) =>
                                updateSet(exerciseIndex, setIndex, 'reps', parseInt(text))
                            }
                            placeholder={t('reps')}
                        />
                        <RNTextInput
                            style={styles.smallInput}
                            keyboardType="numeric"
                            value={set.weight.toString()}
                            onChangeText={(text) =>
                                updateSet(exerciseIndex, setIndex, 'weight', parseInt(text))
                            }
                            placeholder={t('weight')}
                        />
                        <IconButton
                            icon="remove"
                            size={20}
                            onPress={() => removeSet(exerciseIndex, setIndex)}
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

                <View style={styles.moveButtonsContainer}>
                    <IconButton
                        icon="arrow-up"
                        onPress={() => moveExercise(exerciseIndex, 'up')}
                        disabled={isSuperset ? (exerciseIndex === workout.findIndex((ex) => ex.supersetName === workoutExercise.supersetName)) : exerciseIndex === 0}
                    />
                    <IconButton
                        icon="arrow-down"
                        onPress={() => moveExercise(exerciseIndex, 'down')}
                        disabled={isSuperset ? (exerciseIndex === workout.length - 1 || exerciseIndex === workout.findIndex((ex) => ex.supersetName === workoutExercise.supersetName) + workout.filter((ex) => ex.supersetName === workoutExercise.supersetName).length - 1) : exerciseIndex === workout.length - 1}
                    />
                </View>
            </View>
        );
    }

    function updateSet(
        exerciseIndex: number,
        setIndex: number,
        field: 'reps' | 'weight',
        value: number
    ) {
        setWorkout((prevWorkout) => {
            const newWorkout = [...prevWorkout];
            const updatedExercise = { ...newWorkout[exerciseIndex] };
            const updatedSets = [...updatedExercise.sets];
            updatedSets[setIndex] = {
                ...updatedSets[setIndex],
                [field]: isNaN(value) ? 0 : value,
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
                        ex.supersetName === removedExercise.supersetName
                            ? { ...ex, supersetName: null }
                            : ex
                    );
                }
            }

            return newWorkout;
        });
    }

    return (
        <View style={styles.container}>
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
                {/* Exercise Modal */}
                <Dialog
                    visible={isExerciseModalOpen}
                    onDismiss={() => setIsExerciseModalOpen(false)}
                >
                    <Dialog.Title>{t('add_exercise')}</Dialog.Title>
                    <Dialog.Content>
                        <CustomPicker
                            items={[
                                { label: t('select_muscle_group'), value: '' },
                                ...muscleGroups.map((group) => ({
                                    label: t(
                                        group.charAt(0).toUpperCase() + group.slice(1)
                                    ),
                                    value: group,
                                })),
                            ]}
                            label={t('muscle_group')}
                            onValueChange={(value) => setSelectedMuscleGroup(value)}
                            selectedValue={selectedMuscleGroup || ''}
                        />
                        {selectedMuscleGroup ? (
                            <CustomPicker
                                items={[
                                    { label: t('select_exercise'), value: '' },
                                    ...exerciseList
                                        .filter(
                                            (ex) => ex.muscleGroup === selectedMuscleGroup
                                        )
                                        .map((exercise) => ({
                                            label: exercise.name,
                                            value: exercise.name,
                                        })),
                                ]}
                                label={t('exercise')}
                                onValueChange={(value) => {
                                    const exercise = exerciseList.find(
                                        (ex) => ex.name === value
                                    );
                                    if (exercise) {
                                        addExerciseToWorkout(exercise);
                                    }
                                }}
                                selectedValue=""
                            />
                        ) : null}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setIsExerciseModalOpen(false)}>
                            {t('cancel')}
                        </Button>
                    </Dialog.Actions>
                </Dialog>

                {/* Superset Modal */}
                <Dialog
                    visible={isSupersetModalOpen}
                    onDismiss={() => setIsSupersetModalOpen(false)}
                >
                    <Dialog.Title>{t('create_superset')}</Dialog.Title>
                    <Dialog.Content>
                        <CustomTextInput
                            label={t('superset_name')}
                            placeholder={t('enter_superset_name')}
                            value={supersetName}
                            onChangeText={setSupersetName}
                        />
                        <Text style={styles.label}>{t('select_exercises')}</Text>
                        {workout.map((exercise, index) => (
                            <View key={index} style={styles.checkboxContainer}>
                                <Checkbox
                                    status={
                                        selectedExercises.includes(index)
                                            ? 'checked'
                                            : 'unchecked'
                                    }
                                    onPress={() => toggleExerciseSelection(index)}
                                />
                                <Text>{exercise.exercise.name}</Text>
                            </View>
                        ))}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button
                            onPress={createSuperset}
                            disabled={selectedExercises.length < 2 || !supersetName}
                        >
                            {t('create_superset')}
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            <ScrollView contentContainerStyle={styles.content}>
                <Button
                    mode="contained"
                    onPress={() => setIsExerciseModalOpen(true)}
                    style={styles.button}
                >
                    {t('add_exercise')}
                </Button>

                <Button
                    mode="contained"
                    onPress={() => setIsSupersetModalOpen(true)}
                    style={styles.button}
                    disabled={workout.length < 2}
                >
                    {t('create_superset')}
                </Button>

                <View style={styles.workoutContainer}>{renderWorkoutExercises()}</View>
            </ScrollView>

            <View style={styles.footer}>
                <Button
                    disabled={isSaving}
                    mode="contained"
                    onPress={handleSaveWorkout}
                    style={styles.button}
                >
                    {t('save_workout')}
                </Button>
            </View>

            {(isSaving || isLoading) && (
                <View style={styles.overlay}>
                    <ActivityIndicator color={colors.primary} size="large" />
                </View>
            )}
        </View>
    );
};

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
    exerciseDescription: {
        color: colors.onSurface,
        marginBottom: 8,
    },
    exerciseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    exerciseTitle: {
        color: colors.primary,
        fontSize: 18,
        fontWeight: 'bold',
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
    setContainer: {
        alignItems: 'center',
        flexDirection: 'row',
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
    workoutContainer: {
        paddingBottom: 32,
    },
});

export default CreateWorkout;
