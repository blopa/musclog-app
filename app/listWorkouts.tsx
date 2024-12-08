import AnimatedSearchBar from '@/components/AnimatedSearchBar';
import CustomTextInput from '@/components/CustomTextInput';
import FABWrapper from '@/components/FABWrapper';
import { Screen } from '@/components/Screen';
import ThemedCard from '@/components/ThemedCard';
import ThemedModal from '@/components/ThemedModal';
import WorkoutItem from '@/components/WorkoutItem';
import {
    AI_SETTINGS_TYPE,
    CURRENT_WORKOUT_ID,
    IMPERIAL_SYSTEM,
    KILOGRAMS,
} from '@/constants/storage';
import { FAB_ICON_SIZE, ICON_SIZE } from '@/constants/ui';
import useUnit from '@/hooks/useUnit';
import { useSettings } from '@/storage/SettingsContext';
import { generateWorkoutPlan, getAiApiVendor } from '@/utils/ai';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import {
    deleteWorkout,
    getTotalWorkoutsCount,
    getWorkoutDetails,
    getWorkoutsPaginated,
} from '@/utils/database';
import {
    ExerciseWithSetsType,
    WorkoutReturnType,
} from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';
import { resetWorkoutStorageData } from '@/utils/workout';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationProp } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import {
    ActivityIndicator,
    Appbar,
    Card,
    Switch,
    Text,
    useTheme,
} from 'react-native-paper';

export default function ListWorkouts({ navigation }: { navigation: NavigationProp<any> }) {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [workouts, setWorkouts] = useState<WorkoutReturnType[]>([]);
    const [showDeletedWorkouts, setShowDeletedWorkouts] = useState(false);
    const [workoutDetails, setWorkoutDetails] = useState<{
        [key: number]: {
            exercisesWithSets: ExerciseWithSetsType[];
            workout: WorkoutReturnType;
        };
    }>({});
    const [startWorkoutConfirmationModalVisible, setStartWorkoutConfirmationModalVisible] = useState(false);
    const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [selectedWorkout, setSelectedWorkout] = useState<null | WorkoutReturnType>(null);
    const [generateModalVisible, setGenerateModalVisible] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isAiEnabled, setIsAiEnabled] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalWorkoutsCount, setTotalWorkoutsCount] = useState(0);

    const { unitSystem } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    const { getSettingByType } = useSettings();
    const checkApiKey = useCallback(async () => {
        const vendor = await getAiApiVendor();
        const isAiSettingsEnabled = await getSettingByType(AI_SETTINGS_TYPE);

        const hasAiEnabled = Boolean(vendor) && isAiSettingsEnabled?.value === 'true';
        setIsAiEnabled(hasAiEnabled);
    }, [getSettingByType]);

    const loadWorkouts = useCallback(async (offset = 0, limit = 20) => {
        try {
            const loadedWorkouts = await getWorkoutsPaginated(offset, limit, showDeletedWorkouts);
            const sortedWorkouts = loadedWorkouts.sort(
                (a, b) => b.id! - a.id!
            );

            setWorkouts((prevState) => {
                const uniqueWorkouts = sortedWorkouts.filter(
                    (workout) =>
                        !prevState.some(
                            (prevWorkout) => prevWorkout.id === workout.id
                        )
                );

                return [...prevState, ...uniqueWorkouts];
            });

            const workoutDetailsMap: {
                    [key: number]: {
                        exercisesWithSets: ExerciseWithSetsType[];
                        workout: WorkoutReturnType;
                    };
                } = {};

            for (const workout of sortedWorkouts) {
                const details = await getWorkoutDetails(workout.id!);
                if (details) {
                    workoutDetailsMap[workout.id!] = {
                        ...details,
                        exercisesWithSets: details.exercisesWithSets.map(
                            (exercise) => ({
                                ...exercise,
                                sets: exercise.sets.map((set) => ({
                                    ...set,
                                    weight: getDisplayFormattedWeight(
                                        set.weight,
                                        KILOGRAMS,
                                        isImperial
                                    ),
                                })),
                            })
                        ),
                    };
                }
            }

            setWorkoutDetails(workoutDetailsMap);
        } catch (error) {
            console.error(t('failed_load_workouts'), error);
        }
    }, [isImperial, t, showDeletedWorkouts]);

    const loadMoreWorkouts = useCallback(() => {
        if (workouts.length >= totalWorkoutsCount) {
            return;
        }

        loadWorkouts(workouts.length);
    }, [workouts.length, totalWorkoutsCount, loadWorkouts]);

    const fetchTotalWorkoutsCount = useCallback(async () => {
        const totalCount = await getTotalWorkoutsCount();
        setTotalWorkoutsCount(totalCount);
    }, []);

    const resetScreenData = useCallback(() => {
        setStartWorkoutConfirmationModalVisible(false);
        setConfirmationModalVisible(false);
        setSelectedWorkout(null);
        setSearchQuery('');
        setWorkouts([]);
        setWorkoutDetails({});
        setGenerateModalVisible(false);
        setInputValue('');
        setIsLoading(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchTotalWorkoutsCount();
            loadWorkouts();
            checkApiKey();

            return () => {
                resetScreenData();
            };
        }, [fetchTotalWorkoutsCount, loadWorkouts, checkApiKey, resetScreenData])
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

    const handleStartWorkout = useCallback(async () => {
        if (selectedWorkout) {
            try {
                const ongoingWorkout = await AsyncStorage.getItem(
                    CURRENT_WORKOUT_ID
                );
                if (ongoingWorkout) {
                    setConfirmationModalVisible(true);
                    return;
                }

                await resetWorkoutStorageData();
                await AsyncStorage.setItem(
                    CURRENT_WORKOUT_ID,
                    JSON.stringify(selectedWorkout.id)
                );

                navigation.navigate('index', { screen: 'workout' });
            } catch (error) {
                console.error(t('failed_save_current_workout'), error);
            } finally {
                setStartWorkoutConfirmationModalVisible(false);
            }
        }
    }, [navigation, selectedWorkout, t]);

    const handleConfirmStartNewWorkout = useCallback(async () => {
        if (selectedWorkout) {
            try {
                await resetWorkoutStorageData();
                await AsyncStorage.setItem(
                    CURRENT_WORKOUT_ID,
                    JSON.stringify(selectedWorkout.id)
                );

                navigation.navigate('index', { screen: 'workout' });
            } catch (error) {
                console.error(t('failed_save_current_workout'), error);
            } finally {
                setConfirmationModalVisible(false);
                setStartWorkoutConfirmationModalVisible(false);
            }
        }
    }, [navigation, selectedWorkout, t]);

    const openStartWorkoutConfirmationModal = useCallback((workout: WorkoutReturnType) => {
        setSelectedWorkout(workout);
        setStartWorkoutConfirmationModalVisible(true);
    }, []);

    const openDeleteWorkoutConfirmationModal = useCallback((workout: WorkoutReturnType) => {
        setSelectedWorkout(workout);
        setDeleteModalVisible(true);
    }, []);

    const handleDeleteWorkout = useCallback(async () => {
        if (!selectedWorkout) {
            return;
        }

        try {
            await deleteWorkout(selectedWorkout.id!);
            await loadWorkouts();
        } catch (error) {
            console.error(t('failed_delete_workout'), error);
        } finally {
            setDeleteModalVisible(false);
        }
    }, [loadWorkouts, selectedWorkout, t]);

    const handleGenerateWorkoutPlan = useCallback(() => {
        setGenerateModalVisible(true);
    }, []);

    const handleCloseGenerateWorkoutPlanModal = useCallback(() => {
        if (isLoading) {
            return;
        }

        setGenerateModalVisible(false);
    }, [isLoading]);

    const handleCreateWorkoutPlan = useCallback(async () => {
        setIsLoading(true);
        try {
            await generateWorkoutPlan([{
                content: `Please create me a workout plan based on: ${inputValue}`,
                role: 'user',
            }]);

            await loadWorkouts();
            setGenerateModalVisible(false);
            setInputValue('');
            setIsLoading(false);
        } catch (error) {
            console.error(t('failed_generate_workout_plan'), error);
            setIsLoading(false);
        }
    }, [inputValue, loadWorkouts, t]);

    const filteredWorkouts = useMemo(() => {
        return workouts.filter((workout) =>
            workout.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery, workouts]);

    const fabActions = useMemo(() => {
        const actions = [{
            icon: () => <FontAwesome5 color={colors.primary} name="plus" size={FAB_ICON_SIZE} />,
            label: t('create_workout'),
            onPress: () => navigation.navigate('createWorkout'),
            style: { backgroundColor: colors.surface },
        }, {
            icon: () => <FontAwesome5 color={colors.primary} name="running" size={FAB_ICON_SIZE} />,
            label: t('exercises'),
            onPress: () => navigation.navigate('listExercises'),
            style: { backgroundColor: colors.surface },
        }];

        if (isAiEnabled) {
            actions.unshift({
                icon: () => <FontAwesome5 color={colors.primary} name="magic" size={FAB_ICON_SIZE} />,
                label: t('generate_workouts_with_ai'),
                onPress: handleGenerateWorkoutPlan,
                style: { backgroundColor: colors.surface },
            });
        }

        return actions;
    }, [colors.primary, colors.surface, isAiEnabled, handleGenerateWorkoutPlan, navigation, t]);

    const handleShowDeletedWorkouts = useCallback(() => {
        setShowDeletedWorkouts((prev) => !prev);
    }, []);

    return (
        <>
            <ThemedModal
                cancelText={t('no')}
                confirmText={t('yes')}
                onClose={() => setStartWorkoutConfirmationModalVisible(false)}
                onConfirm={handleStartWorkout}
                title={selectedWorkout ? t('start_workout_confirmation', { title: selectedWorkout.title }) : t('start_workout_confirmation_generic')}
                visible={startWorkoutConfirmationModalVisible}
            />
            <ThemedModal
                cancelText={t('no')}
                confirmText={t('yes')}
                onClose={() => setConfirmationModalVisible(false)}
                onConfirm={handleConfirmStartNewWorkout}
                title={t('confirm_start_new_workout')}
                visible={confirmationModalVisible}
            />
            <ThemedModal
                cancelText={t('no')}
                confirmText={t('yes')}
                onClose={() => setDeleteModalVisible(false)}
                onConfirm={handleDeleteWorkout}
                title={selectedWorkout ? t('delete_workout_confirmation', { title: selectedWorkout.title }) : t('delete_confirmation_generic')}
                visible={deleteModalVisible}
            />
            <ThemedModal
                cancelText={!isLoading ? t('cancel') : undefined}
                confirmText={!isLoading ? t('generate') : undefined}
                onClose={handleCloseGenerateWorkoutPlanModal}
                onConfirm={handleCreateWorkoutPlan}
                title={t('enter_workout_details')}
                visible={generateModalVisible}
            >
                <View style={styles.modalContent}>
                    <CustomTextInput
                        label={t('workout_details')}
                        onChangeText={setInputValue}
                        placeholder={t('enter_workout_details')}
                        value={inputValue}
                    />
                    {isLoading && (
                        <ActivityIndicator
                            color={colors.primary}
                            size="large"
                        />
                    )}
                </View>
            </ThemedModal>
            <Screen style={styles.container}>
                <FABWrapper actions={fabActions} icon="cog" visible>
                    <View style={styles.container}>
                        <Appbar.Header
                            mode="small"
                            statusBarHeight={0}
                            style={styles.appbarHeader}
                        >
                            <Appbar.Content
                                title={t('workouts')}
                                titleStyle={styles.appbarTitle}
                            />
                            <AnimatedSearchBar
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                            />
                        </Appbar.Header>
                        <View style={styles.toggleContainer}>
                            <Text style={styles.toggleLabel}>{t('show_deleted_workouts')}</Text>
                            <Switch
                                onValueChange={handleShowDeletedWorkouts}
                                value={showDeletedWorkouts}
                            />
                        </View>
                        {filteredWorkouts.length > 0 ? (
                            <FlashList
                                contentContainerStyle={styles.scrollViewContent}
                                data={filteredWorkouts}
                                estimatedItemSize={135}
                                keyExtractor={(item) =>
                                    (item?.id ? item.id.toString() : 'default')
                                }
                                ListFooterComponent={
                                    workouts.length < totalWorkoutsCount ? (
                                        <ActivityIndicator />
                                    ) : null
                                }
                                onEndReached={loadMoreWorkouts}
                                onEndReachedThreshold={0.5}
                                renderItem={({ item: workout }) => (
                                    <ThemedCard key={workout.id}>
                                        <Card.Content style={styles.cardContent}>
                                            <View style={styles.cardHeader}>
                                                <Text style={styles.cardTitle}>
                                                    {workout.title}
                                                </Text>
                                                <WorkoutItem
                                                    workoutDetails={workoutDetails}
                                                    workoutId={workout.id!}
                                                />
                                            </View>
                                            <View style={styles.cardActions}>
                                                <FontAwesome5
                                                    color={colors.primary}
                                                    name="play"
                                                    onPress={() =>
                                                        openStartWorkoutConfirmationModal(
                                                            workout
                                                        )
                                                    }
                                                    size={ICON_SIZE}
                                                    style={styles.iconButton}
                                                />
                                                <FontAwesome5
                                                    color={colors.primary}
                                                    name="eye"
                                                    onPress={() => navigation.navigate('workoutDetails', { id: workout.id })}
                                                    size={ICON_SIZE}
                                                    style={styles.iconButton}
                                                />
                                                <FontAwesome5
                                                    color={colors.primary}
                                                    name="edit"
                                                    onPress={() => navigation.navigate('createWorkout', { id: workout.id })}
                                                    size={ICON_SIZE}
                                                    style={styles.iconButton}
                                                />
                                                <FontAwesome5
                                                    color={colors.primary}
                                                    name="trash"
                                                    onPress={() =>
                                                        openDeleteWorkoutConfirmationModal(
                                                            workout
                                                        )
                                                    }
                                                    size={ICON_SIZE}
                                                    style={styles.iconButton}
                                                />
                                            </View>
                                        </Card.Content>
                                    </ThemedCard>
                                )}
                            />
                        ) : (
                            <Text style={styles.noDataText}>{t('no_workouts')}</Text>
                        )}
                    </View>
                </FABWrapper>
            </Screen>
        </>
    );
}

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    appbarHeader: {
        backgroundColor: colors.primary,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    appbarTitle: {
        color: colors.onPrimary,
        fontSize: Platform.OS === 'web' ? 20 : 26,
    },
    cardActions: {
        alignItems: 'center',
        flexDirection: 'row',
    },
    cardContent: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    cardHeader: {
        flex: 1,
    },
    cardTitle: {
        color: colors.onSurface,
        fontSize: 18,
        fontWeight: 'bold',
    },
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    iconButton: {
        marginHorizontal: 8,
    },
    modalContent: {
        backgroundColor: colors.background,
        padding: 16,
    },
    noDataText: {
        color: colors.onBackground,
        fontSize: 16,
        marginTop: 16,
        textAlign: 'center',
    },
    scrollViewContent: {
        backgroundColor: colors.background,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    toggleContainer: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        marginVertical: 8,
        paddingHorizontal: 16,
    },
    toggleLabel: {
        color: colors.onBackground,
        fontSize: 16,
    },
});
