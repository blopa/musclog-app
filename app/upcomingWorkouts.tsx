import AnimatedSearchBar from '@/components/AnimatedSearchBar';
import CompletionModal from '@/components/CompletionModal';
import FABWrapper from '@/components/FABWrapper';
import { Screen } from '@/components/Screen';
import StatusBadge from '@/components/StatusBadge';
import ThemedCard from '@/components/ThemedCard';
import ThemedModal from '@/components/ThemedModal';
import { CURRENT_WORKOUT_ID, SCHEDULED_STATUS } from '@/constants/storage';
import { FAB_ICON_SIZE, ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import {
    deleteWorkoutEvent,
    getTotalUpcomingWorkoutsCount,
    getUpcomingWorkoutsPaginated,
} from '@/utils/database';
import { formatDate } from '@/utils/date';
import { WorkoutEventReturnType } from '@/utils/types';
import { resetWorkoutStorageData } from '@/utils/workout';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationProp } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import * as Calendar from 'expo-calendar';
import { useFocusEffect } from 'expo-router';
import { createEvent } from 'ics';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Card, Text, useTheme } from 'react-native-paper';

type Callback = () => void;

export default function UpcomingWorkouts({ navigation }: { navigation: NavigationProp<any> }) {
    const { t } = useTranslation();
    const [upcomingWorkouts, setUpcomingWorkouts] = useState<WorkoutEventReturnType[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
    const [selectedWorkout, setSelectedWorkout] = useState<null | WorkoutEventReturnType>(null);
    const [totalWorkoutsCount, setTotalWorkoutsCount] = useState(0);
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const [searchQuery, setSearchQuery] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [disabledButtons, setDisabledButtons] = useState<{ [key: string]: boolean }>({});
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);

    const loadWorkouts = useCallback(async (offset = 0, limit = 20) => {
        try {
            const loadedWorkouts = await getUpcomingWorkoutsPaginated(offset, limit);

            setUpcomingWorkouts((prevState) => {
                const combinedData = [
                    ...prevState,
                    ...loadedWorkouts.filter(
                        (data) => !prevState.some((prevData) => prevData.id === data.id)
                    ),
                ];

                combinedData.sort((a, b) => {
                    if (a.date < b.date) {
                        return 1;
                    }

                    if (a.date > b.date) {
                        return -1;
                    }

                    if (a?.id! < b?.id!) {
                        return 1;
                    }

                    if (a?.id! > b?.id!) {
                        return -1;
                    }

                    return 0;
                });

                return combinedData;
            });
        } catch (error) {
            console.error('Failed to load upcoming workouts:', error);
        }
    }, []);

    const loadMoreWorkouts = useCallback(() => {
        if (upcomingWorkouts.length >= totalWorkoutsCount) {
            return;
        }

        loadWorkouts(upcomingWorkouts.length);
    }, [upcomingWorkouts.length, totalWorkoutsCount, loadWorkouts]);

    const fetchTotalWorkoutsCount = useCallback(async () => {
        const totalCount = await getTotalUpcomingWorkoutsCount();
        setTotalWorkoutsCount(totalCount);
    }, []);

    const resetScreenData = useCallback(() => {
        setUpcomingWorkouts([]);
        setModalVisible(false);
        setConfirmationModalVisible(false);
        setSelectedWorkout(null);
        setSearchQuery('');
        setDisabledButtons({});
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchTotalWorkoutsCount();
            loadWorkouts();

            return () => {
                resetScreenData();
            };
        }, [fetchTotalWorkoutsCount, loadWorkouts, resetScreenData])
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

    const handleModalClose = useCallback(() => {
        setIsModalVisible(false);
        setModalMessage('');
    }, []);

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

                navigation.navigate('index', { screen: 'workout' });
            } catch (error) {
                console.error('Failed to save current workout day:', error);
            } finally {
                setModalVisible(false);
            }
        }
    }, [navigation, selectedWorkout]);

    const handleConfirmStartNewWorkout = useCallback(async () => {
        if (selectedWorkout) {
            try {
                await resetWorkoutStorageData();
                await AsyncStorage.setItem(CURRENT_WORKOUT_ID, JSON.stringify(selectedWorkout.id));

                navigation.navigate('index', { screen: 'workout' });
            } catch (error) {
                console.error('Failed to save current workout day:', error);
            } finally {
                setConfirmationModalVisible(false);
                setModalVisible(false);
            }
        }
    }, [navigation, selectedWorkout]);

    const openConfirmationModal = (workout: WorkoutEventReturnType) => {
        setSelectedWorkout(workout);
        setModalVisible(true);
    };

    const handleSuccess = useCallback(() => {
        setModalMessage(t('event_added_successfully'));
        setIsModalVisible(true);
    }, [t]);

    const handleError = useCallback(() => {
        setModalMessage(t('event_addition_failed'));
        setIsModalVisible(true);
    }, [t]);

    const handleAddToCalendar = useCallback(async (workout: WorkoutEventReturnType) => {
        setDisabledButtons((prev) => ({ ...prev, [workout.id!]: true }));
        await createCalendarEvent(workout, handleSuccess, handleError);
        setDisabledButtons((prev) => ({ ...prev, [workout.id!]: false }));
    }, [handleSuccess, handleError]);

    const handleDeleteWorkout = useCallback(async () => {
        if (selectedWorkout) {
            try {
                await deleteWorkoutEvent(selectedWorkout.id!);
                setUpcomingWorkouts([]);
                await loadWorkouts();
                await fetchTotalWorkoutsCount();
            } catch (error) {
                console.error(t('failed_delete_workout'), error);
            } finally {
                setDeleteModalVisible(false);
            }
        }
    }, [fetchTotalWorkoutsCount, loadWorkouts, selectedWorkout, t]);

    const openDeleteWorkoutConfirmationModal = useCallback((workout: WorkoutEventReturnType) => {
        setSelectedWorkout(workout);
        setDeleteModalVisible(true);
    }, []);

    const filteredWorkouts = upcomingWorkouts.filter((workout) =>
        workout.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const fabActions = useMemo(() => [{
        icon: () => <FontAwesome5 color={colors.primary} name="plus" size={FAB_ICON_SIZE} />,
        label: t('schedule_workout'),
        onPress: () => navigation.navigate('scheduleWorkout'),
        style: { backgroundColor: colors.surface },
    }], [colors.primary, colors.surface, navigation, t]);

    return (
        <Screen style={styles.container}>
            <FABWrapper actions={fabActions} visible>
                <View style={styles.container}>
                    <Appbar.Header
                        mode="small"
                        statusBarHeight={0}
                        style={styles.appbarHeader}
                    >
                        <Appbar.Content title={t('upcoming_workouts')} titleStyle={styles.appbarTitle} />
                        <AnimatedSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
                    </Appbar.Header>
                    <FlashList
                        contentContainerStyle={styles.scrollViewContent}
                        data={filteredWorkouts}
                        estimatedItemSize={100}
                        keyExtractor={(item) => (item?.id ? item.id.toString() : 'default')}
                        ListFooterComponent={upcomingWorkouts.length < totalWorkoutsCount ? <ActivityIndicator /> : null}
                        onEndReached={loadMoreWorkouts}
                        onEndReachedThreshold={0.5}
                        renderItem={({ item: workout }) => (
                            <ThemedCard key={workout.id}>
                                <Card.Content style={styles.cardContent}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.cardTitle}>{workout.title}</Text>
                                        <Text style={styles.cardDate}>{formatDate(workout.date)}</Text>
                                        <StatusBadge status={SCHEDULED_STATUS} />
                                        {(workout?.duration || 0) > 0 && (
                                            <Text style={styles.cardDuration}>{workout.duration} {t('minutes')}</Text>
                                        )}
                                    </View>
                                    <View style={styles.cardActions}>
                                        <FontAwesome5
                                            color={colors.primary}
                                            name="play"
                                            onPress={() => openConfirmationModal(workout)}
                                            size={ICON_SIZE}
                                            style={styles.iconButton}
                                        />
                                        <FontAwesome5
                                            color={colors.primary}
                                            disabled={disabledButtons[workout.id!]}
                                            name="calendar"
                                            onPress={() => handleAddToCalendar(workout)}
                                            size={ICON_SIZE}
                                            style={styles.iconButton}
                                        />
                                        <FontAwesome5
                                            color={colors.primary}
                                            name="trash"
                                            onPress={() => openDeleteWorkoutConfirmationModal(workout)}
                                            size={ICON_SIZE}
                                            style={styles.iconButton}
                                        />
                                    </View>
                                </Card.Content>
                            </ThemedCard>
                        )}
                    />
                    <ThemedModal
                        cancelText={t('no')}
                        confirmText={t('yes')}
                        onClose={() => setModalVisible(false)}
                        onConfirm={handleStartWorkout}
                        title={t('start_workout_confirmation_generic')}
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
                    <ThemedModal
                        cancelText={t('no')}
                        confirmText={t('yes')}
                        onClose={() => setDeleteModalVisible(false)}
                        onConfirm={handleDeleteWorkout}
                        title={selectedWorkout ? t('delete_workout_confirmation', { title: selectedWorkout.title }) : t('delete_confirmation_generic')}
                        visible={deleteModalVisible}
                    />
                    <CompletionModal
                        buttonText={t('ok')}
                        isModalVisible={isModalVisible}
                        message={modalMessage}
                        onClose={handleModalClose}
                        title={t('add_to_calendar')}
                    />
                </View>
            </FABWrapper>
        </Screen>
    );
}

async function createCalendarEvent(workout: WorkoutEventReturnType, onSuccess: Callback, onError: Callback) {
    if (Platform.OS === 'web') {
        const event = {
            description: workout.title || '',
            duration: { hours: Math.floor((workout.duration || 60) / 60), minutes: (workout.duration || 60) % 60 },
            location: '',
            start: new Date(workout.date),
            title: workout.title,
        };

        createEvent({
            ...event,
            start: [new Date(event.start).getFullYear(), new Date(event.start).getMonth() + 1, new Date(event.start).getDate()],
        }, (error, value) => {
            if (error) {
                console.error(error);
                onError();
                return;
            }

            const blob = new Blob([value], { type: 'text/calendar;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${workout.title}.ics`;
            a.click();
            URL.revokeObjectURL(url);
            onSuccess();
        });

        return;
    }

    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status === 'granted') {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const defaultCalendar = calendars.find((cal) => cal.allowsModifications);

        if (defaultCalendar) {
            try {
                await Calendar.createEventAsync(defaultCalendar.id, {
                    endDate: new Date(new Date(workout.date).getTime() + (workout.duration || 60) * 60000),
                    location: '',
                    notes: workout.description || '',
                    startDate: new Date(workout.date),
                    timeZone: 'GMT',
                    title: workout.title,
                });
                onSuccess();
            } catch (error) {
                console.error('Failed to create event:', error);
                onError();
            }
        } else {
            console.error('No modifiable calendar found');
            onError();
        }
    } else {
        console.error('Calendar permissions not granted');
        onError();
    }
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
    cardDate: {
        color: colors.onBackground,
        fontSize: 14,
    },
    cardDuration: {
        color: colors.onBackground,
        marginTop: 4,
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
    scrollViewContent: {
        backgroundColor: colors.background,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
});
