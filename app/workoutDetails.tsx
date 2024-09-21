import AppHeader from '@/components/AppHeader';
import LineChart from '@/components/Charts/LineChart';
import CustomPicker from '@/components/CustomPicker';
import FABWrapper from '@/components/FABWrapper';
import Filters from '@/components/Filters';
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
import { CustomThemeColorsType, CustomThemeType, addTransparency } from '@/utils/colors';
import { calculatePastWorkoutsWeeklyAverages } from '@/utils/data';
import {
    getExerciseById,
    getRecentWorkoutsByWorkoutId,
    getSetsByIds,
    getWorkoutById,
    getWorkoutExercisesByWorkoutId,
} from '@/utils/database';
import { formatDate } from '@/utils/date';
import { exportWorkout } from '@/utils/file';
import {
    ExerciseReturnType,
    LineChartDataType,
    SetReturnType,
    WorkoutEventReturnType,
    WorkoutExerciseReturnType,
    WorkoutReturnType
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

const WorkoutDetails: React.FC<WorkoutDetailsProps> = ({ navigation }) => {
    const { t } = useTranslation();
    const [workout, setWorkout] = useState<WorkoutReturnType | undefined>();
    const [workoutExercises, setWorkoutExercises] = useState<({ sets: SetReturnType[] } & WorkoutExerciseReturnType)[]>([]);
    const [exercises, setExercises] = useState<(ExerciseReturnType | undefined)[]>([]);
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

            const recentWorkouts = await getRecentWorkoutsByWorkoutId(Number(id));
            setRecentWorkouts(
                recentWorkouts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            );

            const workoutExercisesDetails = await getWorkoutExercisesByWorkoutId(Number(id));
            workoutExercisesDetails.sort((a, b) => a.order - b.order);

            const exercisesWithSetsPromises = workoutExercisesDetails.map(async (we) => {
                const sets = await getSetsByIds(we.setIds);
                return { ...we, sets };
            });

            const exercisesWithSets = await Promise.all(exercisesWithSetsPromises);
            setWorkoutExercises(exercisesWithSets);

            const exerciseDetailsPromises = workoutExercisesDetails.map((we) =>
                getExerciseById(we.exerciseId)
            );
            const exercises = await Promise.all(exerciseDetailsPromises);
            setExercises(exercises);
        } catch (error) {
            console.error(t('failed_to_load_workout_details'), error);
        } finally {
            setLoading(false);
        }
    }, [id, t]);

    const resetScreenData = useCallback(() => {
        setRecentWorkouts([]);
        setModalVisible(false);
        setConfirmationModalVisible(false);
        setLoading(false);
        setWorkout(undefined);
        setWorkoutExercises([]);
        setExercises([]);
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
            const data = [];

            for (const [index, recentWorkout] of filteredWorkouts.entries()) {
                const exerciseData = JSON.parse(recentWorkout?.exerciseData || '[]') as { exerciseId: number, sets: SetReturnType[] }[];

                let workoutVolume = 0;
                if (selectedChartData === WHOLE_WORKOUT) {
                    workoutVolume = parseFloat(recentWorkout.workoutVolume || '0') || await calculateWorkoutVolume(
                        exerciseData.filter((ex) => exercises.find((e) => e?.id === ex.exerciseId)),
                    ) || 0;
                } else {
                    const selectedExerciseData = exerciseData.find((ex) => ex.exerciseId.toString() === selectedChartData);

                    if (selectedExerciseData) {
                        workoutVolume = await calculateWorkoutVolume([selectedExerciseData], 0);
                    }
                }

                data.push({
                    date: recentWorkout.date,
                    marker: t('value_weight', { value: getDisplayFormattedWeight(workoutVolume, KILOGRAMS, isImperial), weightUnit }),
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
    }, [recentWorkouts, timeRange, showWeeklyAverages, t, weightUnit, isImperial, selectedChartData, exercises]);

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
            } finally {
                setModalVisible(false);
            }
        }
    }, [navigation, workout, t]);

    const handleConfirmStartNewWorkout = useCallback(async () => {
        if (workout) {
            try {
                await resetWorkoutStorageData();
                await AsyncStorage.setItem(CURRENT_WORKOUT_ID, JSON.stringify(workout.id));

                navigation.navigate('index', { screen: 'workout' });
            } catch (error) {
                console.error(t('failed_save_current_workout'), error);
            } finally {
                setConfirmationModalVisible(false);
                setModalVisible(false);
            }
        }
    }, [navigation, workout, t]);

    const openStartWorkoutConfirmationModal = useCallback(() => {
        setModalVisible(true);
    }, []);

    const handleGetWorkoutVolumeInsights = useCallback(() => {
        setLoading(true);

        setTimeout(async () => {
            setLoading(false);
            const message = await getWorkoutVolumeInsights(workout?.id!);

            if (message) {
                await addNewChat({
                    message,
                    misc: '',
                    sender: 'assistant',
                    type: 'text'
                });
                increaseUnreadMessages(1);
                showSnackbar(t('your_trainer_answered'), t('see_message'), () => {
                    navigation.navigate('chat');
                });
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
            setLoading(false);
            const message = await getWorkoutInsights(workout?.id!);

            if (message) {
                await addNewChat({
                    message,
                    misc: '',
                    sender: 'assistant',
                    type: 'text'
                });
                increaseUnreadMessages(1);
                showSnackbar(t('your_trainer_answered'), t('see_message'), () => {
                    navigation.navigate('chat');
                });
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
                            {workoutExercises.map((we, index) => (
                                <WorkoutExerciseDetail
                                    exercise={exercises.find((ex) => ex?.id === we.exerciseId)}
                                    exerciseVolume={{
                                        exerciseId: we.exerciseId,
                                        sets: we.sets.map((set) => ({
                                            ...set,
                                            setId: set.id ?? 0,
                                            weight: getDisplayFormattedWeight(Number(set.weight), KILOGRAMS, isImperial),
                                        })),
                                    }}
                                    key={index}
                                    // onDeleteSet={handleDeleteSet(we.exerciseId)}
                                    // onEditSet={handleEditSet(we.exerciseId)}
                                />
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
                                showAggregateSwitch={recentWorkouts.length > 7}
                                showAggregatedValues={showWeeklyAverages}
                                timeRange={timeRange}
                            />
                            <CustomPicker
                                items={[
                                    { label: t('whole_workout'), value: WHOLE_WORKOUT },
                                    ...exercises.map((ex) => ({ label: ex?.name || '', value: ex?.id!.toString() || '' }))
                                ]}
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
    snackbar: {
        backgroundColor: colors.background,
        marginBottom: 80,
    },
    snackbarText: {
        color: colors.onBackground,
    },
});

export default WorkoutDetails;
