import FoodTrackingModal, { FoodTrackingType } from '@/components/FoodTrackingModal';
import { Screen } from '@/components/Screen';
import SearchFoodModal from '@/components/SearchFoodModal';
import StatusBadge from '@/components/StatusBadge';
import ThemedCard from '@/components/ThemedCard';
import ThemedModal from '@/components/ThemedModal';
import WorkoutModal from '@/components/WorkoutModal';
import { CURRENT_WORKOUT_ID, SCHEDULED_STATUS } from '@/constants/storage';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { getRecentWorkoutsPaginated, getRecurringWorkouts } from '@/utils/database';
import { formatDate } from '@/utils/date';
import { MusclogApiFoodInfoType, WorkoutEventReturnType, WorkoutReturnType } from '@/utils/types';
import { resetWorkoutStorageData } from '@/utils/workout';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationProp } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'react-native-paper';

export default function Dashboard({ navigation }: {
    navigation: NavigationProp<any>,
}) {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [workoutModalVisible, setWorkoutModalVisible] = useState(false);
    const [foodSearchModalVisible, setFoodSearchModalVisible] = useState(false);
    const [foodTrackingModalVisible, setFoodTrackingModalVisible] = useState(false);
    const [recentWorkouts, setRecentWorkouts] = useState<WorkoutEventReturnType[]>([]);
    const [upcomingWorkouts, setUpcomingWorkouts] = useState<WorkoutReturnType[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
    const [selectedUpcomingEvent, setSelectedUpcomingEvent] = useState<null | WorkoutReturnType>(null);
    const [selectedFood, setSelectedFood] = useState<MusclogApiFoodInfoType | null>(null);

    const fetchWorkoutData = useCallback(async () => {
        try {
            const recentWorkoutsData = await getRecentWorkoutsPaginated(0, 3);
            setRecentWorkouts(recentWorkoutsData);

            const upcomingWorkoutsData = await getRecurringWorkouts();
            setUpcomingWorkouts(upcomingWorkoutsData?.slice(0, 3) || []);
        } catch (error) {
            console.error('Failed to load workout data:', error);
        }
    }, []);

    const resetScreenData = useCallback(() => {
        setUpcomingWorkouts([]);
        setModalVisible(false);
        setConfirmationModalVisible(false);
        setSelectedUpcomingEvent(null);
        setRecentWorkouts([]);
        setWorkoutModalVisible(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchWorkoutData();

            return () => {
                resetScreenData();
            };
        }, [fetchWorkoutData, resetScreenData])
    );

    const handleViewAllRecentWorkouts = useCallback(() => {
        navigation.navigate('recentWorkouts');
    }, [navigation]);

    // const handleViewAllUpcomingWorkouts = useCallback(() => {
    //     navigation.navigate('upcomingWorkouts');
    // }, [navigation]);

    const handleStartWorkout = useCallback(async () => {
        if (selectedUpcomingEvent) {
            try {
                const ongoingWorkout = await AsyncStorage.getItem(CURRENT_WORKOUT_ID);
                if (ongoingWorkout) {
                    setConfirmationModalVisible(true);
                    return;
                }

                await resetWorkoutStorageData();
                await AsyncStorage.setItem(CURRENT_WORKOUT_ID, JSON.stringify(selectedUpcomingEvent.id));

                navigation.navigate('index', { screen: 'workout' });
            } catch (error) {
                console.error('Failed to save current workout day:', error);
            } finally {
                setModalVisible(false);
            }
        }
    }, [navigation, selectedUpcomingEvent]);

    const handleConfirmStartNewWorkout = useCallback(async () => {
        if (selectedUpcomingEvent) {
            try {
                await resetWorkoutStorageData();
                await AsyncStorage.setItem(CURRENT_WORKOUT_ID, JSON.stringify(selectedUpcomingEvent.id));

                navigation.navigate('index', { screen: 'workout' });
            } catch (error) {
                console.error('Failed to save current workout day:', error);
            } finally {
                setConfirmationModalVisible(false);
                setModalVisible(false);
            }
        }
    }, [navigation, selectedUpcomingEvent]);

    const openConfirmationModal = useCallback((workout: WorkoutReturnType) => {
        setSelectedUpcomingEvent(workout);
        setModalVisible(true);
    }, []);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                BackHandler.exitApp();
                return true;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => {
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            };
        }, [])
    );

    const handleCloseFoodSearchModal = useCallback(() => {
        setFoodSearchModalVisible(false);
    }, []);

    const handleOnFoodSelected = useCallback((food: FoodTrackingType) => {
        setSelectedFood(food);
        setFoodTrackingModalVisible(true);
    }, []);

    const handleCloseTrackingModal = useCallback(() => {
        setFoodTrackingModalVisible(false);
        setFoodSearchModalVisible(false);
    }, []);

    return (
        <Screen style={styles.container}>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <WorkoutModal onClose={() => setWorkoutModalVisible(false)} visible={workoutModalVisible} />
                <SearchFoodModal
                    onClose={handleCloseFoodSearchModal}
                    onFoodSelected={handleOnFoodSelected}
                    visible={foodSearchModalVisible}
                />
                <FoodTrackingModal
                    food={selectedFood}
                    onClose={handleCloseTrackingModal}
                    visible={foodTrackingModalVisible}
                />
                <View style={styles.section}>
                    <Text style={styles.header}>{t('track_your_fitness_journey')}</Text>
                    <Text style={styles.description}>
                        {t('easily_log_your_workouts')}
                    </Text>
                    <Button
                        mode="contained"
                        onPress={() => setWorkoutModalVisible(true)}
                        style={styles.startLoggingButton}
                    >
                        {t('start_a_workout')}
                    </Button>
                    <Button
                        mode="contained"
                        onPress={() => setFoodSearchModalVisible(true)}
                        style={styles.startLoggingButton}
                    >
                        {t('track_food_intake')}
                    </Button>
                </View>
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{t('upcoming_workouts')}</Text>
                        {/*<Button*/}
                        {/*    onPress={handleViewAllUpcomingWorkouts}*/}
                        {/*    style={styles.viewAllButton}*/}
                        {/*    textColor={colors.primary}*/}
                        {/*>*/}
                        {/*    {t('view_all')}*/}
                        {/*</Button>*/}
                    </View>
                    <View style={styles.cardWrapper}>
                        {upcomingWorkouts.length > 0 ? (
                            upcomingWorkouts.map((workout) => (
                                <ThemedCard key={workout.id} style={styles.cardContainer}>
                                    <Card.Content>
                                        <View style={styles.cardHeader}>
                                            <Text style={styles.cardDate}>
                                                {t(workout.recurringOnWeek!)}
                                            </Text>
                                            <StatusBadge status={SCHEDULED_STATUS} />
                                        </View>
                                        <Text style={styles.cardTitle}>{workout.title}</Text>
                                        <Button
                                            mode="contained"
                                            onPress={() => openConfirmationModal(workout)}
                                            style={styles.startWorkoutButton}
                                        >
                                            {t('start')}
                                        </Button>
                                    </Card.Content>
                                </ThemedCard>
                            ))
                        ) : (
                            <Text style={styles.noDataText}>
                                {t('no_upcoming_workouts')}
                            </Text>
                        )}
                    </View>
                </View>
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{t('recent_workouts')}</Text>
                        <Button
                            onPress={handleViewAllRecentWorkouts}
                            style={styles.viewAllButton}
                            textColor={colors.primary}
                        >
                            {t('view_all')}
                        </Button>
                    </View>
                    <View style={styles.cardWrapper}>
                        {recentWorkouts.length > 0 ? (
                            recentWorkouts.map((workout) => (
                                <ThemedCard key={workout.id} style={styles.cardContainer}>
                                    <Card.Content>
                                        <View style={styles.cardHeader}>
                                            <Text style={styles.cardDate}>
                                                {formatDate(workout.date)}
                                            </Text>
                                            <StatusBadge status={workout.status} />
                                        </View>
                                        <Text style={styles.cardTitle}>{workout.title}</Text>
                                        {workout?.duration ? (
                                            <Text style={styles.cardDuration}>
                                                {workout.duration} {t(workout?.duration > 1 ? 'minutes' : 'minute')}
                                            </Text>
                                        ) : null}
                                    </Card.Content>
                                </ThemedCard>
                            ))
                        ) : (
                            <Text style={styles.noDataText}>
                                {t('no_recent_workouts')}
                            </Text>
                        )}
                    </View>
                </View>
                <ThemedModal
                    cancelText={t('no')}
                    confirmText={t('yes')}
                    onClose={() => setModalVisible(false)}
                    onConfirm={handleStartWorkout}
                    title={t('confirm_start_workout')}
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
            </ScrollView>
        </Screen>
    );
}

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    cardContainer: {
        marginBottom: 4,
    },
    cardDate: {
        color: colors.onSurface,
        fontSize: 14,
    },
    cardDuration: {
        color: colors.onSurface,
        marginTop: 4,
    },
    cardHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    cardTitle: {
        color: colors.onSurface,
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 8,
    },
    cardWrapper: {
        flexDirection: 'column',
    },
    container: {
        backgroundColor: colors.background,
        flexGrow: 1,
        padding: 16,
    },
    description: {
        alignSelf: 'center',
        color: colors.onSurface,
        marginTop: 8,
        maxWidth: 320,
        textAlign: 'center',
    },
    header: {
        color: colors.onSurface,
        fontSize: 28,
        fontWeight: 'bold',
        lineHeight: 32,
        marginTop: 8,
        textAlign: 'center',
    },
    noDataText: {
        color: colors.onBackground,
        fontSize: 16,
        marginBottom: 12,
        textAlign: 'center',
    },
    section: {
        marginBottom: 32,
        padding: 12,
    },
    sectionHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    sectionTitle: {
        color: colors.onSurface,
        fontSize: 24,
        fontWeight: 'bold',
    },
    startLoggingButton: {
        marginTop: 16,
    },
    startWorkoutButton: {
        marginTop: 8,
    },
    viewAllButton: {
        marginTop: 0,
    },
});
