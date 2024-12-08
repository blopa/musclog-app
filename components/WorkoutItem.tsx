import useUnit from '@/hooks/useUnit';
import { CustomThemeType } from '@/utils/colors';
import { getClosestWeightUserMetric } from '@/utils/database';
import { getCurrentTimestampISOString } from '@/utils/date';
import {
    ExerciseWithSetsType,
    WorkoutReturnType,
} from '@/utils/types';
import { calculateWorkoutVolume } from '@/utils/workout';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface WorkoutDetailsProps {
    workoutDetails: {
        [key: number]: {
            exercisesWithSets: ExerciseWithSetsType[];
            workout: WorkoutReturnType;
        };
    };
    workoutId: number;
}

const WorkoutItem: React.FC<WorkoutDetailsProps> = ({
    workoutDetails,
    workoutId,
}) => {
    const [workoutVolume, setWorkoutVolume] = useState<number>(0);

    const { t } = useTranslation();
    const { weightUnit } = useUnit();
    const { colors } = useTheme<CustomThemeType>();

    const styles = makeStyles(colors);

    const details = workoutDetails[workoutId];

    const exerciseNames = useMemo(() => details?.exercisesWithSets.map((exercise) => exercise.name).join(', '),
        [details]
    );

    const totalSets = useMemo(() =>
        details?.exercisesWithSets.reduce(
            (total, exercise) => total + exercise.sets.length,
            0
        ),
    [details]
    );

    const totalReps = useMemo(() =>
        details?.exercisesWithSets.reduce(
            (total, exercise) =>
                total + exercise.sets.reduce((sum, set) => sum + Number(set.reps), 0),
            0
        ),
    [details]
    );

    useEffect(() => {
        const getWorkoutVolume = async () => {
            if (details?.exercisesWithSets) {
                const totalVolume = await calculateWorkoutVolume(
                    details.exercisesWithSets.map((exercise) => ({
                        exerciseId: exercise.id,
                        sets: exercise.sets,
                    })),
                    await getClosestWeightUserMetric(1, getCurrentTimestampISOString()) || 0
                );

                setWorkoutVolume(totalVolume);
            }
        };

        getWorkoutVolume();
    }, [details]);

    if (!details) {
        return null;
    }

    return (
        <View>
            <Text style={styles.workoutDetails}>{exerciseNames}</Text>
            {workoutVolume > 0 ? (
                <Text style={styles.workoutDetails}>
                    {t('workout_sets_reps_volume', {
                        reps: totalReps,
                        sets: totalSets,
                        volume: workoutVolume,
                        weightUnit,
                    })}
                </Text>
            ) : null}
        </View>
    );
};

const makeStyles = (colors: any) => StyleSheet.create({
    workoutDetails: {
        color: colors.onSurface,
        fontSize: 12,
    },
});

export default WorkoutItem;
