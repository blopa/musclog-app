import AppHeader from '@/components/AppHeader';
import LineChart from '@/components/Charts/LineChart';
import CustomPicker from '@/components/CustomPicker';
import FABWrapper from '@/components/FABWrapper';
import Filters from '@/components/Filters';
import { Screen } from '@/components/Screen';
import ThemedCard from '@/components/ThemedCard';
import ThemedModal from '@/components/ThemedModal';
import WorkoutExerciseDetail from '@/components/WorkoutExerciseDetail';
import {
    AI_SETTINGS_TYPE,
    CURRENT_WORKOUT_ID,
    IMPERIAL_SYSTEM,
    KILOGRAMS,
} from '@/constants/storage';
import { ICON_SIZE } from '@/constants/ui';
import useUnit from '@/hooks/useUnit';
import { useChatData } from '@/storage/ChatProvider';
import { useSettings } from '@/storage/SettingsContext';
import { useSnackbar } from '@/storage/SnackbarProvider';
import { useUnreadMessages } from '@/storage/UnreadMessagesProvider';
import {
    getAiApiVendor,
    getWorkoutInsights,
    getWorkoutVolumeInsights,
} from '@/utils/ai';
import { addTransparency, CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { calculatePastWorkoutsWeeklyAverages } from '@/utils/data';
import {
    getClosestWeightUserMetric,
    getExerciseById,
    getRecentWorkoutsByWorkoutId,
    getSetsByWorkoutId,
    getWorkoutById,
} from '@/utils/database';
import { formatDate } from '@/utils/date';
import { exportWorkout } from '@/utils/file';
import {
    ExerciseReturnType,
    ExerciseVolumeType,
    ExtendedLineChartDataType,
    LineChartDataType,
    SetReturnType,
    WorkoutEventReturnType,
    WorkoutReturnType,
} from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';
import { calculateWorkoutVolume, resetWorkoutStorageData } from '@/utils/workout';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationProp, useFocusEffect, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';

type RouteParams = {
    id?: string;
};

interface WorkoutDetailsProps {
    navigation: NavigationProp<any>;
}

const WHOLE_WORKOUT = 'wholeWorkout';

interface ExerciseGroup {
    exercises: {
        exercise: ExerciseReturnType;
        sets: SetReturnType[];
    }[];
    supersetName?: string;
}

const WorkoutDetails: React.FC<WorkoutDetailsProps> = ({ navigation }) => {
    const { t } = useTranslation();
    const [workout, setWorkout] = useState<undefined | WorkoutReturnType>();
    const [exerciseGroups, setExerciseGroups] = useState<ExerciseGroup[]>([]);
    const [exercisesMap, setExercisesMap] = useState<Map<number, ExerciseReturnType>>(new Map());
    const [exercisesPicker, setExercisesPicker] = useState<{ label: string; value: string }[]>([]);

    const [recentWorkouts, setRecentWorkouts] = useState<WorkoutEventReturnType[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
    const [chartData, setChartData] = useState<LineChartDataType[]>([]);
    const [selectedChartData, setSelectedChartData] = useState<string>(WHOLE_WORKOUT);

    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
    const route = useRoute();

    const { id } = (route.params as RouteParams) || {};
    const { unitSystem, weightUnit } = useUnit();
    const { addNewChat } = useChatData();

    const [timeRange, setTimeRange] = useState('30');
    const [showWeeklyAverages, setShowWeeklyAverages] = useState(false);

    const [isAiEnabled, setIsAiEnabled] = useState(false);
    const { getSettingByType } = useSettings();

    const { increaseUnreadMessages } = useUnreadMessages();
    const { showSnackbar } = useSnackbar();

    useEffect(() => {
        if (!id) {
            navigation.goBack();
        }
    }, [id, navigation]);

    useFocusEffect(
        useCallback(() => {
            const checkAiInsightsAvailability = async () => {
                const vendor = await getAiApiVendor();
                const isAiSettingsEnabled = await getSettingByType(AI_SETTINGS_TYPE);

                const hasAiEnabled = Boolean(vendor) && isAiSettingsEnabled?.value === 'true';
                setIsAiEnabled(hasAiEnabled);
            };

            checkAiInsightsAvailability();
        }, [getSettingByType])
    );

    const fetchWorkoutDetails = useCallback(async () => {
        try {
            const workoutDetails = await getWorkoutById(Number(id));
            setWorkout(workoutDetails);

            const recentWorkoutsData = await getRecentWorkoutsByWorkoutId(Number(id));
            setRecentWorkouts(
                recentWorkoutsData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            );

            // Fetch all sets for this workout, ordered by setOrder
            const sets = await getSetsByWorkoutId(Number(id));
            const orderedSets = sets.sort((a, b) => a.setOrder - b.setOrder);

            // Fetch all exercises involved in these sets
            const exerciseIds = Array.from(new Set(sets.map((set) => set.exerciseId)));
            const exercisesPromises = exerciseIds.map((exerciseId) => getExerciseById(exerciseId));
            const exercises = await Promise.all(exercisesPromises);

            const newExercisesMap = new Map<number, ExerciseReturnType>();
            exercises.forEach((exercise) => {
                if (exercise) {
                    newExercisesMap.set(exercise.id!, exercise);
                }
            });

            setExercisesMap(newExercisesMap);
            setExercisesPicker([
                { label: t('whole_workout'), value: WHOLE_WORKOUT },
                ...Array.from(newExercisesMap.values()).map((ex) => ({
                    label: ex.name || '',
                    value: ex.id!.toString() || '',
                })),
            ]);

            // Group sets by exerciseId
            const exerciseSetsMap: { [exerciseId: number]: SetReturnType[] } = {};
            orderedSets.forEach((set) => {
                if (!exerciseSetsMap[set.exerciseId]) {
                    exerciseSetsMap[set.exerciseId] = [];
                }
                exerciseSetsMap[set.exerciseId].push(set);
            });

            // Create a list of exercises with their sets and earliest setOrder
            const exercisesWithSets = Array.from(newExercisesMap.entries()).map(([exerciseId, exercise]) => ({
                earliestSetOrder: Math.min(...(exerciseSetsMap[exerciseId]?.map((set) => set.setOrder) || [Infinity])),
                exercise,
                sets: exerciseSetsMap[exerciseId] || [],
            }));

            // Sort exercises by earliestSetOrder
            exercisesWithSets.sort((a, b) => a.earliestSetOrder - b.earliestSetOrder);

            // Group exercises into supersets based on supersetName
            const groupedExercises: ExerciseGroup[] = [];
            let currentSupersetName: string | undefined;
            let currentGroup: ExerciseGroup | null = null;

            exercisesWithSets.forEach(({ exercise, sets }) => {
                const supersetNames = Array.from(new Set(sets.map((set) => set.supersetName).filter(Boolean))) as string[];

                if (supersetNames.length > 0) {
                    // Assuming all sets of an exercise have the same supersetName
                    const supersetName = supersetNames[0];
                    if (currentSupersetName !== supersetName) {
                        // Start a new superset group
                        currentGroup = {
                            exercises: [],
                            supersetName,
                        };
                        groupedExercises.push(currentGroup);
                        currentSupersetName = supersetName;
                    }
                    currentGroup?.exercises.push({ exercise, sets });
                } else {
                    // Standalone exercise
                    groupedExercises.push({
                        exercises: [{ exercise, sets }],
                    });
                    currentSupersetName = undefined;
                }
            });

            setExerciseGroups(groupedExercises);
        } catch (error) {
            console.error(t('failed_to_load_workout_details'), error);
            showSnackbar(t('failed_to_load_workout_details'), t('retry'), fetchWorkoutDetails);
        } finally {
            setLoading(false);
        }
    }, [id, t, showSnackbar]);

    const resetScreenData = useCallback(() => {
        setRecentWorkouts([]);
        setModalVisible(false);
        setConfirmationModalVisible(false);
        setLoading(false);
        setWorkout(undefined);
        setExerciseGroups([]);
        setExercisesMap(new Map());
        setShowWeeklyAverages(false);
        setTimeRange('30');
        setIsAiEnabled(false);
        setSelectedChartData(WHOLE_WORKOUT);
        setChartData([]);
        setLoading(true);
    }, []);

    useFocusEffect(
        useCallback(() => {
            if (id) {
                fetchWorkoutDetails();
            }

            return () => {
                resetScreenData();
            };
        }, [fetchWorkoutDetails, id, resetScreenData])
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

    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    useEffect(() => {
        const getChartData = async () => {
            const filteredWorkouts = recentWorkouts.slice(-parseInt(timeRange));
            const data: ExtendedLineChartDataType[] = [];

            for (const [index, recentWorkout] of filteredWorkouts.entries()) {
                const exerciseData = JSON.parse(recentWorkout?.exerciseData || '[]') as ExerciseVolumeType[];
                const replacementExercises = exerciseData.filter((ex) => ex.isReplacement);

                for (const replacementExerciseVol of replacementExercises) {
                    const replacementExerciseData = await getExerciseById(replacementExerciseVol.exerciseId);
                    if (replacementExerciseData) {
                        // check if exercisesMap already has this exercise
                        if (!exercisesMap.has(replacementExerciseData.id!)) {
                            exercisesMap.set(replacementExerciseData.id!, replacementExerciseData);
                            setExercisesMap(new Map(exercisesMap));

                            setExercisesPicker((prevState) => [
                                ...prevState,
                                {
                                    label: replacementExerciseData.name || '',
                                    value: replacementExerciseData.id!.toString() || '',
                                },
                            ]);
                        }
                    }
                }

                let workoutVolume = 0;
                if (selectedChartData === WHOLE_WORKOUT) {
                    workoutVolume = parseFloat(recentWorkout.workoutVolume || '0')
                        || (await calculateWorkoutVolume(
                            exerciseData.filter((ex) => exercisesMap.has(ex.exerciseId)),
                            recentWorkout.bodyWeight || await getClosestWeightUserMetric(1, recentWorkout?.date) || 0
                        ))
                        || 0;
                } else {
                    const selectedExerciseId = parseInt(selectedChartData, 10);
                    const selectedExerciseData = exerciseData.find(
                        (ex) => ex.exerciseId === selectedExerciseId
                    );

                    if (selectedExerciseData) {
                        workoutVolume = await calculateWorkoutVolume(
                            [selectedExerciseData],
                            recentWorkout.bodyWeight || await getClosestWeightUserMetric(1, recentWorkout?.date) || 0
                        );
                    }
                }

                data.push({
                    date: recentWorkout.date,
                    marker: t('value_weight', {
                        value: getDisplayFormattedWeight(workoutVolume, KILOGRAMS, isImperial),
                        weightUnit,
                    }),
                    x: index,
                    y: getDisplayFormattedWeight(workoutVolume, KILOGRAMS, isImperial),
                });
            }

            setChartData(showWeeklyAverages ? calculatePastWorkoutsWeeklyAverages(data) : data);
        };

        // only if there's at least 2 workouts
        if (recentWorkouts.length > 1) {
            getChartData();
        }
    }, [recentWorkouts, timeRange, showWeeklyAverages, t, weightUnit, isImperial, selectedChartData, exercisesMap]);

    const chartLabels = useMemo(() => {
        const filteredWorkouts = recentWorkouts.slice(-parseInt(timeRange));
        return filteredWorkouts.map((workout) => formatDate(workout.date, 'MMM d'));
    }, [recentWorkouts, timeRange]);

    const handleStartWorkout = useCallback(async () => {
        if (workout) {
            try {
                const ongoingWorkoutId = await AsyncStorage.getItem(CURRENT_WORKOUT_ID);
                if (ongoingWorkoutId) {
                    setConfirmationModalVisible(true);
                    return;
                }

                await resetWorkoutStorageData();
                await AsyncStorage.setItem(CURRENT_WORKOUT_ID, JSON.stringify(workout.id));

                navigation.navigate('index', { screen: 'workout' });
            } catch (error) {
                console.error(t('failed_save_current_workout'), error);
                showSnackbar(t('failed_save_current_workout'), t('ok'));
            } finally {
                setModalVisible(false);
            }
        }
    }, [navigation, workout, t, showSnackbar]);

    const handleConfirmStartNewWorkout = useCallback(async () => {
        if (workout) {
            try {
                await resetWorkoutStorageData();
                await AsyncStorage.setItem(CURRENT_WORKOUT_ID, JSON.stringify(workout.id));

                navigation.navigate('index', { screen: 'workout' });
            } catch (error) {
                console.error(t('failed_save_current_workout'), error);
                showSnackbar(t('failed_save_current_workout'), t('ok'));
            } finally {
                setConfirmationModalVisible(false);
                setModalVisible(false);
            }
        }
    }, [navigation, workout, t, showSnackbar]);

    const openStartWorkoutConfirmationModal = useCallback(() => {
        setModalVisible(true);
    }, []);

    const handleGetWorkoutVolumeInsights = useCallback(() => {
        setLoading(true);

        setTimeout(async () => {
            setLoading(false);
            try {
                const message = await getWorkoutVolumeInsights(workout?.id!);

                if (message) {
                    await addNewChat({
                        // Remove quotes from the message
                        message: message.replace(/^"([^"]+)"$/, '$1'),
                        misc: '',
                        sender: 'assistant',
                        type: 'text',
                    });

                    increaseUnreadMessages(1);
                    showSnackbar(t('your_trainer_answered'), t('see_message'), () => {
                        navigation.navigate('chat');
                    });
                } else {
                    showSnackbar(t('failed_to_get_workout_volume_insights'), t('retry'), handleGetWorkoutVolumeInsights);
                }
            } catch (error) {
                console.error('Failed to get workout volume insights:', error);
                showSnackbar(t('failed_to_get_workout_volume_insights'), t('retry'), handleGetWorkoutVolumeInsights);
                return;
            }
        }, 500);
    }, [workout?.id, addNewChat, increaseUnreadMessages, showSnackbar, t, navigation]);

    const handleExportWorkoutJson = useCallback(() => {
        if (workout) {
            exportWorkout(workout?.id!);
        }
    }, [workout]);

    const handleGetWorkoutInsights = useCallback(() => {
        setLoading(true);

        setTimeout(async () => {
            try {
                setLoading(false);
                const message = await getWorkoutInsights(workout?.id!);

                if (message) {
                    await addNewChat({
                        // remove quotes
                        message: message.replace(/^"([^"]+)"$/, '$1'),
                        misc: '',
                        sender: 'assistant',
                        type: 'text',
                    });
                    increaseUnreadMessages(1);
                    showSnackbar(t('your_trainer_answered'), t('see_message'), () => {
                        navigation.navigate('chat');
                    });
                } else {
                    showSnackbar(t('failed_to_get_workout_insights'), t('retry'), handleGetWorkoutInsights);
                }
            } catch (error) {
                console.error('Failed to get workout insights:', error);
                showSnackbar(t('failed_to_get_workout_insights'), t('retry'), handleGetWorkoutInsights);
                return;
            }
        }, 500);
    }, [workout?.id, addNewChat, increaseUnreadMessages, showSnackbar, t, navigation]);

    const handleEditWorkout = useCallback(() => {
        navigation.navigate('createWorkout', { id: workout?.id });
    }, [navigation, workout]);

    const handleDeleteSet = useCallback((exerciseId: number) => (setIndex: number, setId?: number) => {
        // TODO this is just a nice to have
    }, []);

    const handleEditSet = useCallback((exerciseId: number) => (setIndex: number, setId?: number) => {
        // TODO this is just a nice to have
    }, []);

    const fabActions = useMemo(() => {
        const actions = [{
            icon: () => <FontAwesome5 color={colors.primary} name="file-export" size={ICON_SIZE} />,
            label: t('export_workout_as_json'),
            onPress: handleExportWorkoutJson,
            style: { backgroundColor: colors.surface },
        }];

        if (isAiEnabled) {
            actions.unshift({
                icon: () => <FontAwesome5 color={colors.primary} name="brain" size={ICON_SIZE} />,
                label: t('get_workout_insights'),
                onPress: handleGetWorkoutInsights,
                style: { backgroundColor: colors.surface },
            });

            if (recentWorkouts.length > 0) {
                actions.unshift({
                    icon: () => <FontAwesome5 color={colors.primary} name="brain" size={ICON_SIZE} />,
                    label: t('get_workout_volume_insights'),
                    onPress: handleGetWorkoutVolumeInsights,
                    style: { backgroundColor: colors.surface },
                });
            }
        }

        return actions;
    }, [
        colors.primary,
        colors.surface,
        handleExportWorkoutJson,
        handleGetWorkoutInsights,
        handleGetWorkoutVolumeInsights,
        isAiEnabled,
        recentWorkouts.length,
        t,
    ]);

    return (
        <Screen style={styles.container}>
            <FABWrapper actions={fabActions} icon="cog" visible>
                <View style={styles.container}>
                    <AppHeader title={t('workout_details')} />
                    <ScrollView contentContainerStyle={styles.scrollViewContent} keyboardShouldPersistTaps="handled">
                        {workout ? (
                            <ThemedCard style={styles.cardContainer}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.dateTitle}>
                                        {workout.title}
                                    </Text>
                                    <View style={styles.buttonGroup}>
                                        <FontAwesome5
                                            color={colors.primary}
                                            name="edit"
                                            onPress={handleEditWorkout}
                                            size={ICON_SIZE}
                                            style={styles.editButton}
                                        />
                                        <FontAwesome5
                                            color={colors.primary}
                                            name="play"
                                            onPress={openStartWorkoutConfirmationModal}
                                            size={ICON_SIZE}
                                            style={styles.playButton}
                                        />
                                    </View>
                                </View>
                                <View style={styles.separator} />
                                {workout.description ? (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailValue}>{workout.description}</Text>
                                    </View>
                                ) : null}
                                {workout.recurringOnWeek ? (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{t('recurring_on')}</Text>
                                        <Text style={styles.detailValue}>{t(workout.recurringOnWeek.toLowerCase())}</Text>
                                    </View>
                                ) : null}
                                <Text style={styles.exercisesTitle}>
                                    {t('exercises')}
                                </Text>
                                {exerciseGroups.map((group, groupIndex) => (
                                    <View key={`group-${groupIndex}`} style={group.supersetName ? styles.supersetContainer : styles.groupContainer}>
                                        {group.supersetName && (
                                            <Text style={styles.supersetHeader}>{`${t('superset')}: ${group.supersetName}`}</Text>
                                        )}
                                        {group.exercises.map((we, exerciseIndex) => (
                                            <WorkoutExerciseDetail
                                                exercise={we.exercise}
                                                exerciseVolume={{
                                                    exerciseId: we.exercise.id!,
                                                    sets: we.sets.map((set) => ({
                                                        ...set,
                                                        setId: set.id ?? 0,
                                                        weight: getDisplayFormattedWeight(Number(set.weight), KILOGRAMS, isImperial),
                                                    })),
                                                }}
                                                key={`group-${groupIndex}-exercise-${we.exercise.id}-${exerciseIndex}`}
                                            // onDeleteSet={handleDeleteSet(we.exercise.id!)}
                                            // onEditSet={handleEditSet(we.exercise.id!)}
                                            />
                                        ))}
                                    </View>
                                ))}
                            </ThemedCard>
                        ) : (
                            <Text style={styles.noDataText}>{t('no_workout_details')}</Text>
                        )}
                        {chartData.length > 0 ? (
                            <View>
                                <Filters
                                    aggregatedValuesLabel={t('show_aggregated_averages')}
                                    setShowAggregatedValues={setShowWeeklyAverages}
                                    setTimeRange={setTimeRange}
                                    showAggregatedValues={showWeeklyAverages}
                                    showAggregateSwitch={recentWorkouts.length > 7}
                                    timeRange={timeRange}
                                />
                                <CustomPicker
                                    items={exercisesPicker}
                                    label={t('select_metric')}
                                    onValueChange={setSelectedChartData}
                                    selectedValue={selectedChartData}
                                    wrapperStyle={{ marginTop: 8 }}
                                />
                                <LineChart
                                    data={chartData}
                                    granularity={1}
                                    labelLeftMargin={-55}
                                    labels={chartLabels}
                                    padding={12}
                                    shareButtonPosition="top"
                                    title={t('workout_volume_over_time')}
                                    xAxisLabel={t('workouts')}
                                    yAxis={{
                                        axisMaximum: Math.max(...chartData.map((d) => d.y)) * 1.1,
                                        axisMinimum: Math.min(...chartData.map((d) => d.y)) * 0.9,
                                    }}
                                    yAxisLabel={t('workout_volume_weight', { weightUnit })}
                                />
                            </View>
                        ) : null}
                    </ScrollView>
                    {loading && (
                        <View style={styles.overlay}>
                            <ActivityIndicator color={colors.primary} size="large" />
                        </View>
                    )}
                    <ThemedModal
                        cancelText={t('no')}
                        confirmText={t('yes')}
                        onClose={() => setModalVisible(false)}
                        onConfirm={handleStartWorkout}
                        title={workout ? t('start_workout_confirmation', { title: workout.title }) : t('start_workout_confirmation_generic')}
                        visible={modalVisible}
                    />
                    <ThemedModal
                        cancelText={t('no')}
                        confirmText={t('yes')}
                        onClose={() => setConfirmationModalVisible(false)}
                        onConfirm={handleConfirmStartNewWorkout}
                        title={t('confirm_start_new_workout')}
                        visible={confirmationModalVisible}
                    />
                </View>
            </FABWrapper>
        </Screen>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    buttonGroup: {
        flexDirection: 'row',
    },
    cardContainer: {
        marginTop: 16,
        padding: 8,
    },
    cardHeader: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 12,
    },
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    dateTitle: {
        color: colors.onSurface,
        fontSize: 16,
        fontWeight: 'bold',
    },
    detailLabel: {
        color: colors.onSurface,
        fontSize: 16,
    },
    detailRow: {
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        padding: 12,
    },
    detailValue: {
        color: colors.onSurface,
        fontSize: 16,
        fontWeight: '500',
    },
    editButton: {
        marginLeft: 16,
    },
    exercisesTitle: {
        color: colors.onSurface,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    groupContainer: {
        marginBottom: 16,
    },
    noDataText: {
        color: colors.onBackground,
        fontSize: 16,
        marginTop: 16,
        textAlign: 'center',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        backgroundColor: addTransparency(colors.background, 0.5),
        flex: 1,
        justifyContent: 'center',
    },
    playButton: {
        marginLeft: 16,
    },
    scrollViewContent: {
        backgroundColor: colors.background,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    separator: {
        backgroundColor: colors.background,
        height: 1,
        marginVertical: 16,
    },
    supersetContainer: {
        backgroundColor: colors.surfaceVariant,
        borderColor: colors.primary,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 16,
        padding: 8,
    },
    supersetHeader: {
        color: colors.primary,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
});

export default WorkoutDetails;
