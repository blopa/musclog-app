import { IMPERIAL_SYSTEM, KILOGRAMS } from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { getClosestWeightUserMetric, getRecentWorkoutById } from '@/utils/database';
import { formatDate } from '@/utils/date';
import { WorkoutEventReturnType } from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';
import { calculateWorkoutVolume } from '@/utils/workout';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'react-native-paper';

const RecentWorkoutMessageCard = ({ recentWorkoutId }: { recentWorkoutId: number }) => {
    const navigation = useNavigation<NavigationProp<any>>();
    const [recentWorkout, setRecentWorkout] = useState<undefined | WorkoutEventReturnType>();
    const [exerciseData, setExerciseData] = useState([]);
    const [workoutVolume, setWorkoutVolume] = useState<number>(0);

    const { t } = useTranslation();
    const { unitSystem, weightUnit } = useUnit();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    const fetchRecentWorkout = useCallback(async () => {
        try {
            const workoutEvent = await getRecentWorkoutById(recentWorkoutId);
            setRecentWorkout(workoutEvent);
            setExerciseData(JSON.parse(workoutEvent?.exerciseData || '[]'));
        } catch (error) {
            console.error(t('failed_to_load_workout'), error);
        }
    }, [recentWorkoutId, t]);

    useFocusEffect(
        useCallback(() => {
            fetchRecentWorkout();
        }, [fetchRecentWorkout])
    );

    const handleViewAllRecentWorkouts = useCallback(
        () => navigation.navigate('recentWorkoutDetails', { id: recentWorkout?.id }),
        [navigation, recentWorkout?.id]
    );

    useEffect(() => {
        const getWorkoutVolume = async () => {
            const totalVolume = await calculateWorkoutVolume(
                exerciseData,
                recentWorkout?.bodyWeight || await getClosestWeightUserMetric(1, recentWorkout?.date) || 0
            );

            setWorkoutVolume(totalVolume);
        };

        getWorkoutVolume();
    }, [exerciseData, recentWorkout?.bodyWeight, recentWorkout?.date]);

    return (
        <Card style={styles.card}>
            <Card.Content style={styles.cardHeader}>
                <View style={styles.workoutTitleWrapper}>
                    <Text style={styles.cardTitle}>
                        {t('your_latest_workout')}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                        {t('completed_on', {
                            date: recentWorkout ? formatDate(recentWorkout?.date) : '',
                        })}
                    </Text>
                </View>
                <Button
                    mode="outlined"
                    onPress={handleViewAllRecentWorkouts}
                    style={styles.viewWorkoutButton}
                >
                    {t('view_workout')}
                </Button>
            </Card.Content>
            <Card.Content style={styles.cardContent}>
                <Text style={styles.workoutName}>{recentWorkout?.title}</Text>
                <Text style={styles.workoutDetails}>
                    {t('duration_minutes', {
                        duration: recentWorkout?.duration,
                    })}
                </Text>
                {workoutVolume ?? 0 > 0 ? (
                    <Text style={styles.workoutDetails}>
                        {t('workout_volume_value', {
                            volume: getDisplayFormattedWeight(workoutVolume, KILOGRAMS, isImperial),
                            weightUnit,
                        })}
                    </Text>
                ) : null}
                {(recentWorkout?.bodyWeight || 0) > 0 && (
                    <Text style={styles.workoutDetails}>
                        {t('your_body_weight', {
                            weight: getDisplayFormattedWeight(recentWorkout?.bodyWeight || 0, KILOGRAMS, isImperial),
                            weightUnit,
                        })}
                    </Text>
                )}
            </Card.Content>
        </Card>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: 8,
        marginVertical: 8,
        padding: 16,
        shadowColor: dark ? '#ffffff' : '#000000',
        shadowOffset: { height: 2, width: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 2,
    },
    cardContent: {
        marginTop: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    cardSubtitle: {
        color: colors.onSurface,
        fontSize: 12,
    },
    cardTitle: {
        color: colors.onSurface,
        fontSize: 16,
        fontWeight: 'bold',
    },
    viewWorkoutButton: {
        marginTop: 0,
    },
    workoutDetails: {
        color: colors.onSurface,
        fontSize: 12,
    },
    workoutName: {
        color: colors.onSurface,
        fontSize: 14,
    },
    workoutTitleWrapper: {
        maxWidth: '60%',
    },
});

export default RecentWorkoutMessageCard;
