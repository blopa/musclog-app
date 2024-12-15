import AppHeader from '@/components/AppHeader';
import EditMacrosModal from '@/components/EditMacrosModal';
import EditSetModal from '@/components/EditSetModal';
import FABWrapper from '@/components/FABWrapper';
import { Screen } from '@/components/Screen';
import StatusBadge from '@/components/StatusBadge';
import ThemedCard from '@/components/ThemedCard';
import ThemedModal from '@/components/ThemedModal';
import WorkoutExerciseDetail from '@/components/WorkoutExerciseDetail';
import { AI_SETTINGS_TYPE, GRAMS, IMPERIAL_SYSTEM, KILOGRAMS, METRIC_SYSTEM, OUNCES } from '@/constants/storage';
import { ICON_SIZE } from '@/constants/ui';
import useUnit from '@/hooks/useUnit';
import { useChatData } from '@/storage/ChatProvider';
import { useSettings } from '@/storage/SettingsContext';
import { useSnackbar } from '@/storage/SnackbarProvider';
import { useUnreadMessages } from '@/storage/UnreadMessagesProvider';
import { getAiApiVendor, getRecentWorkoutInsights } from '@/utils/ai';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import {
    getClosestWeightUserMetric,
    getExerciseById,
    getRecentWorkoutById,
    updateWorkoutEvent,
} from '@/utils/database';
import { formatDate } from '@/utils/date';
import { exportRecentWorkout } from '@/utils/file';
import { safeToFixed } from '@/utils/string';
import { ExerciseReturnType, ExerciseVolumeType, WorkoutEventInsertType, WorkoutEventReturnType } from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';
import { calculateWorkoutVolume, generateWorkoutSummary } from '@/utils/workout';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, Share, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';

interface RecentWorkoutDetailsProps {
    navigation: NavigationProp<any>;
}

type RouteParams = {
    id?: string;
};

const RecentWorkoutDetails: React.FC<RecentWorkoutDetailsProps> = ({ navigation }) => {
    const { t } = useTranslation();
    const [recentWorkout, setRecentWorkout] = useState<undefined | WorkoutEventReturnType>();
    const [exerciseVolumeData, setExerciseVolumeData] = useState<ExerciseVolumeType[]>([]);
    const [exercises, setExercises] = useState<(ExerciseReturnType | undefined)[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [workoutVolume, setWorkoutVolume] = useState<number>(0);
    const [deleteSetModalVisible, setDeleteSetModalVisible] = useState<boolean>(false);
    const [editSetModalVisible, setEditSetModalVisible] = useState<boolean>(false);
    const [currentEdit, setCurrentEdit] = useState<null | { exerciseId: number, setIndex: number }>(null);
    const [currentDelete, setCurrentDelete] = useState<null | { exerciseId: number, setIndex: number }>(null);
    const [editReps, setEditReps] = useState<string>('');
    const [editWeight, setEditWeight] = useState<string>('');
    const [editMacrosModalVisible, setEditMacrosModalVisible] = useState<boolean>(false);
    const [editCarbohydrate, setEditCarbohydrate] = useState<string>('');
    const [editFat, setEditFat] = useState<string>('');
    const [editProtein, setEditProtein] = useState<string>('');
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
    const route = useRoute();
    const { id } = (route.params as RouteParams) || {};
    const { unitSystem, weightUnit } = useUnit();
    let listIndex = 0;

    const [isAiEnabled, setIsAiEnabled] = useState(false);
    const { getSettingByType } = useSettings();
    const { addNewChat } = useChatData();
    const { increaseUnreadMessages } = useUnreadMessages();
    const { showSnackbar } = useSnackbar();

    useEffect(() => {
        if (!id) {
            navigation.goBack();
        }
    }, [id, navigation]);

    const checkAiInsightsAvailability = useCallback(async () => {
        const vendor = await getAiApiVendor();
        const isAiSettingsEnabled = await getSettingByType(AI_SETTINGS_TYPE);

        const hasAiEnabled = Boolean(vendor) && isAiSettingsEnabled?.value === 'true';
        setIsAiEnabled(hasAiEnabled);
    }, [getSettingByType]);

    const fetchWorkoutDetails = useCallback(async () => {
        try {
            const workoutEvent = await getRecentWorkoutById(Number(id));
            setRecentWorkout(workoutEvent);
            const exerciseData = JSON.parse(workoutEvent?.exerciseData || '[]');

            const exerciseDetailsPromises = exerciseData.map((exercise: ExerciseVolumeType) =>
                getExerciseById(exercise.exerciseId)
            );
            const exercises = await Promise.all(exerciseDetailsPromises);

            setExercises(exercises);
            setExerciseVolumeData(exerciseData);
        } catch (error) {
            console.error(t('failed_to_load_workouts'), error);
        } finally {
            setLoading(false);
        }
    }, [id, t]);

    const resetScreenData = useCallback(() => {
        setLoading(false);
        setExercises([]);
        setExerciseVolumeData([]);
        setRecentWorkout(undefined);
    }, []);

    const getWorkoutVolume = useCallback(async () => {
        const totalVolume = await calculateWorkoutVolume(
            exerciseVolumeData,
            recentWorkout?.bodyWeight || await getClosestWeightUserMetric(1, recentWorkout?.date) || 0
        );

        setWorkoutVolume(totalVolume);
    }, [exerciseVolumeData, recentWorkout?.bodyWeight, recentWorkout?.date]);

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
            checkAiInsightsAvailability();
            getWorkoutVolume();
        }, [checkAiInsightsAvailability, getWorkoutVolume])
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

    const handleDeleteSet = useCallback(async (exerciseId: number, setIndex: number) => {
        const newExerciseVolumeData = exerciseVolumeData.map((exercise) => {
            if (exercise.exerciseId === exerciseId) {
                return {
                    ...exercise,
                    sets: exercise.sets.filter((set, index) => index !== setIndex),
                };
            }

            return exercise;
        });

        setExerciseVolumeData(newExerciseVolumeData);
        setDeleteSetModalVisible(false);
        await updateWorkoutEvent(recentWorkout?.id!, {
            ...recentWorkout,
            exerciseData: JSON.stringify(newExerciseVolumeData),
        } as WorkoutEventInsertType);
    }, [exerciseVolumeData, recentWorkout]);

    const handleDeleteSetConfirmation = useCallback((exerciseId: number) => (setIndex: number, setId?: number) => {
        setCurrentDelete({ exerciseId, setIndex });
        setDeleteSetModalVisible(true);
    }, []);

    const handleEditSet = useCallback((exerciseId: number) => (setIndex: number, setId?: number) => {
        const exercise = exerciseVolumeData.find((e) => e.exerciseId === exerciseId);
        const set = exercise?.sets[setIndex];

        if (set) {
            setEditReps(set.reps.toString());
            setEditWeight(set.weight.toString());
            setCurrentEdit({ exerciseId, setIndex });
            setEditSetModalVisible(true);
        }
    }, [exerciseVolumeData]);

    const handleSaveEdit = useCallback(async () => {
        if (currentEdit) {
            const newExerciseVolumeData = exerciseVolumeData.map((exercise) => {
                if (exercise.exerciseId === currentEdit.exerciseId) {
                    const newSets = [...exercise.sets];
                    newSets[currentEdit.setIndex] = {
                        ...newSets[currentEdit.setIndex],
                        reps: Number(editReps),
                        weight: Number(editWeight),
                    };
                    return {
                        ...exercise,
                        sets: newSets,
                    };
                }

                return exercise;
            });

            setExerciseVolumeData(newExerciseVolumeData);
            setEditSetModalVisible(false);
            setCurrentEdit(null);
            await updateWorkoutEvent(recentWorkout?.id!, {
                ...recentWorkout,
                exerciseData: JSON.stringify(newExerciseVolumeData),
            } as WorkoutEventInsertType);
        }
    }, [currentEdit, editReps, editWeight, exerciseVolumeData, recentWorkout]);

    const handleGetWorkoutInsights = useCallback(() => {
        setLoading(true);

        setTimeout(async () => {
            try {
                setLoading(false);
                const message = await getRecentWorkoutInsights(recentWorkout?.id!);

                if (message) {
                    await addNewChat({
                        // remove double quote
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
            }
        }, 500);
    }, [recentWorkout?.id, addNewChat, increaseUnreadMessages, showSnackbar, t, navigation]);

    const handleExportWorkoutJson = useCallback(() => {
        if (recentWorkout) {
            exportRecentWorkout(recentWorkout?.id!);
        }
    }, [recentWorkout]);

    const handleShareWorkoutDetails = useCallback(async () => {
        const workoutSummary = await generateWorkoutSummary(
            recentWorkout!,
            exerciseVolumeData,
            workoutVolume,
            unitSystem,
            weightUnit
        );

        Share.share({
            message: workoutSummary,
        }).catch((error) => console.error('Error sharing workout details:', error));
    }, [exerciseVolumeData, recentWorkout, unitSystem, weightUnit, workoutVolume]);

    const fabActions = useMemo(() => {
        const actions = [{
            icon: () => <FontAwesome5 color={colors.primary} name="file-export" size={ICON_SIZE} />,
            label: t('export_workout_as_json'),
            onPress: handleExportWorkoutJson,
            style: { backgroundColor: colors.surface },
        }, {
            icon: () => <FontAwesome5 color={colors.primary} name="share-alt" size={ICON_SIZE} />,
            label: t('share_workout_details'),
            onPress: handleShareWorkoutDetails,
            style: { backgroundColor: colors.surface },
        }];

        if (isAiEnabled) {
            actions.unshift({
                icon: () => <FontAwesome5 color={colors.primary} name="brain" size={ICON_SIZE} />,
                label: t('get_workout_insights'),
                onPress: handleGetWorkoutInsights,
                style: { backgroundColor: colors.surface },
            });
        }

        return actions;
    }, [t, handleExportWorkoutJson, colors.surface, colors.primary, isAiEnabled, handleGetWorkoutInsights, handleShareWorkoutDetails]);

    const handleSaveMacrosEdit = useCallback(async () => {
        if (recentWorkout) {
            const updatedWorkout = {
                ...recentWorkout,
                carbohydrate: Number(editCarbohydrate),
                fat: Number(editFat),
                protein: Number(editProtein),
            };

            setRecentWorkout(updatedWorkout);
            await updateWorkoutEvent(recentWorkout.id!, {
                ...recentWorkout,
                carbohydrate: updatedWorkout.carbohydrate,
                fat: updatedWorkout.fat,
                protein: updatedWorkout.protein,
            } as WorkoutEventInsertType);

            setEditMacrosModalVisible(false);
        }
    }, [editCarbohydrate, editFat, editProtein, recentWorkout]);

    const handleEditMacros = useCallback(() => {
        if (recentWorkout) {
            setEditCarbohydrate(recentWorkout.carbohydrate?.toString() || '');
            setEditFat(recentWorkout.fat?.toString() || '');
            setEditProtein(recentWorkout.protein?.toString() || '');
            setEditMacrosModalVisible(true);
        }
    }, [recentWorkout]);

    const isImperial = unitSystem === IMPERIAL_SYSTEM;
    const macroUnit = unitSystem === METRIC_SYSTEM ? GRAMS : OUNCES;

    return (
        <Screen style={styles.container}>
            <FABWrapper actions={fabActions} icon="cog" visible>
                <View style={styles.container}>
                    <AppHeader title={t('recent_workout')} />
                    <ScrollView contentContainerStyle={styles.scrollViewContent} keyboardShouldPersistTaps="handled">
                        {loading ? (
                            <ActivityIndicator color={colors.primary} size="large" />
                        ) : recentWorkout ? (
                            <ThemedCard style={styles.cardContainer}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.dateTitle}>
                                        {t('completed_on', {
                                            date: formatDate(recentWorkout.date),
                                        })}
                                    </Text>
                                </View>
                                <View style={styles.separator} />
                                <DetailRow
                                    isEven={listIndex++ % 2 === 0}
                                    label={t('duration')}
                                    styles={styles}
                                    value={`${recentWorkout.duration} ${t(recentWorkout?.duration || 0 > 1 ? 'minutes' : 'minute')}`}
                                />
                                {workoutVolume ?? 0 > 0 ? (
                                    <DetailRow
                                        isEven={listIndex++ % 2 === 0}
                                        label={t('workout_volume')}
                                        styles={styles}
                                        value={t('value_weight', {
                                            value: getDisplayFormattedWeight(workoutVolume, KILOGRAMS, isImperial),
                                            weightUnit,
                                        })}
                                    />
                                ) : null}
                                {recentWorkout.eatingPhase ? (
                                    <DetailRow
                                        isEven={listIndex++ % 2 === 0}
                                        label={t('eating_phase')}
                                        styles={styles}
                                        value={t(recentWorkout.eatingPhase)}
                                    />
                                ) : null}
                                <DetailRow
                                    isEven={listIndex++ % 2 === 0}
                                    label={t('exhaustion_level')}
                                    styles={styles}
                                    value={t('out_of_ten', { number: recentWorkout.exhaustionLevel })}
                                />
                                <DetailRow
                                    isEven={listIndex++ % 2 === 0}
                                    label={t('workout_score')}
                                    styles={styles}
                                    value={t('out_of_ten', { number: recentWorkout.workoutScore })}
                                />
                                {(recentWorkout.carbohydrate || recentWorkout.fat || recentWorkout.protein) ? (
                                    <View style={[styles.macrosDetailRow, listIndex++ % 2 === 0 ? styles.detailRowEvenBg : {}]}>
                                        <View style={styles.macrosHeader}>
                                            <Text style={styles.macroDetailLabelTitle}>
                                                {t('macros_consumed_before_workout')}
                                            </Text>
                                            <FontAwesome5
                                                color={colors.primary}
                                                name="edit"
                                                onPress={handleEditMacros}
                                                size={ICON_SIZE}
                                                style={styles.crudButton}
                                            />
                                        </View>
                                        {recentWorkout.carbohydrate ? (
                                            <View style={styles.macroDetailRow}>
                                                <Text style={styles.detailLabel}>{t('carbs')}</Text>
                                                <Text style={styles.detailValue}>
                                                    {getDisplayFormattedWeight(recentWorkout.carbohydrate, GRAMS, isImperial)}{macroUnit}
                                                </Text>
                                            </View>
                                        ) : null}
                                        {recentWorkout.fat ? (
                                            <View style={styles.macroDetailRow}>
                                                <Text style={styles.detailLabel}>{t('fats')}</Text>
                                                <Text style={styles.detailValue}>
                                                    {getDisplayFormattedWeight(recentWorkout.fat, GRAMS, isImperial)}{macroUnit}
                                                </Text>
                                            </View>
                                        ) : null}
                                        {recentWorkout.protein ? (
                                            <View style={styles.macroDetailRow}>
                                                <Text style={styles.detailLabel}>{t('proteins')}</Text>
                                                <Text style={styles.detailValue}>
                                                    {getDisplayFormattedWeight(recentWorkout.protein, GRAMS, isImperial)}{macroUnit}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                ) : null}
                                {(recentWorkout.bodyWeight && recentWorkout.bodyWeight > 0) ? (
                                    <DetailRow
                                        isEven={listIndex++ % 2 === 0}
                                        label={t('body_weight', { weightUnit })}
                                        styles={styles}
                                        value={getDisplayFormattedWeight(recentWorkout?.bodyWeight || 0, KILOGRAMS, isImperial).toString()}
                                    />
                                ) : null}
                                {(recentWorkout.fatPercentage && recentWorkout.fatPercentage > 0) ? (
                                    <DetailRow
                                        isEven={listIndex++ % 2 === 0}
                                        label={t('fat_percentage')}
                                        styles={styles}
                                        value={`${safeToFixed(recentWorkout.fatPercentage)}%`}
                                    />
                                ) : null}
                                <DetailRow
                                    isEven={listIndex++ % 2 === 0}
                                    label={t('status')}
                                    status={recentWorkout.status}
                                    styles={styles}
                                    value={t(recentWorkout.status)}
                                />
                                {exerciseVolumeData.length > 0 ? (
                                    <>
                                        <View style={styles.separator} />
                                        <Text style={styles.exercisesTitle}>{t('exercises')}</Text>
                                        {exerciseVolumeData.map((exercise, index) => (
                                            <WorkoutExerciseDetail
                                                exercise={exercises.find((ex) => ex?.id === exercise.exerciseId)}
                                                exerciseVolume={{
                                                    ...exercise,
                                                    sets: exercise.sets.map((set) => ({
                                                        ...set,
                                                        setId: set.id ?? 0,
                                                        targetWeight: getDisplayFormattedWeight(Number(set.targetWeight), KILOGRAMS, isImperial),
                                                        weight: getDisplayFormattedWeight(Number(set.weight), KILOGRAMS, isImperial),
                                                    })),
                                                }}
                                                key={index}
                                                onDeleteSet={handleDeleteSetConfirmation(exercise.exerciseId)}
                                                onEditSet={handleEditSet(exercise.exerciseId)}
                                            />
                                        ))}
                                    </>
                                ) : null}
                            </ThemedCard>
                        ) : (
                            <Text style={styles.noDataText}>{t('no_workout_details')}</Text>
                        )}
                    </ScrollView>
                    <ThemedModal
                        cancelText={t('cancel')}
                        confirmText={t('delete')}
                        onClose={() => setDeleteSetModalVisible(false)}
                        onConfirm={() => currentDelete && handleDeleteSet(currentDelete.exerciseId, currentDelete.setIndex)}
                        title={t('delete_set_confirmation')}
                        visible={deleteSetModalVisible}
                    />
                    <EditSetModal
                        handleCloseEditModal={() => setEditSetModalVisible(false)}
                        handleSaveEdit={handleSaveEdit}
                        reps={editReps}
                        setReps={setEditReps}
                        setWeight={setEditWeight}
                        visible={editSetModalVisible}
                        weight={editWeight}
                    />
                    <EditMacrosModal
                        carbohydrate={editCarbohydrate}
                        fat={editFat}
                        handleCloseEditModal={() => setEditMacrosModalVisible(false)}
                        handleSaveEdit={handleSaveMacrosEdit}
                        protein={editProtein}
                        setCarbohydrate={setEditCarbohydrate}
                        setFat={setEditFat}
                        setProtein={setEditProtein}
                        visible={editMacrosModalVisible}
                    />
                    {loading && (
                        <View style={styles.overlay}>
                            <ActivityIndicator color={colors.primary} size="large" />
                        </View>
                    )}
                </View>
            </FABWrapper>
        </Screen>
    );
};

const DetailRow: React.FC<{
    isEven: boolean;
    isStatus?: boolean;
    label: string;
    status?: string;
    styles: any;
    value: string;
}> = ({ isEven, label, status, styles, value }) => (
    <View style={[styles.detailRow, isEven ? styles.detailRowEvenBg : {}]}>
        <Text style={styles.detailLabel}>{label}</Text>
        {status ? (
            <StatusBadge status={status} />
        ) : (
            <Text style={styles.detailValue}>{value}</Text>
        )}
    </View>
);

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
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
    crudButton: {
        marginLeft: 10,
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
        paddingHorizontal: 8,
        paddingVertical: 12,
    },
    detailRowEvenBg: {
        backgroundColor: colors.inverseOnSurface,
    },
    detailValue: {
        color: colors.onSurface,
        fontSize: 16,
        fontWeight: '500',
    },
    exercisesTitle: {
        color: colors.onSurface,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    macroDetailLabelTitle: {
        color: colors.onSurface,
        fontSize: 16,
        marginBottom: 8,
    },
    macroDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    macrosDetailRow: {
        borderRadius: 8,
        marginBottom: 12,
        padding: 12,
    },
    macrosHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        flex: 1,
        justifyContent: 'center',
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
});

export default RecentWorkoutDetails;
