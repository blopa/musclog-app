import useUnit from '@/hooks/useUnit';
import { CustomThemeType } from '@/utils/colors';
import { ExerciseReturnType, SetReturnType, WorkoutExerciseReturnType, WorkoutReturnType } from '@/utils/types';
import { calculateWorkoutVolume } from '@/utils/workout';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';

interface WorkoutDetailsProps {
    exerciseDetails: { [key: number]: ExerciseReturnType };
    exerciseSets: { [workoutId: number]: { [exerciseId: number]: SetReturnType[] } };
    workoutDetails: { [key: number]: { workout: WorkoutReturnType, workoutExercises: WorkoutExerciseReturnType[] } };
    workoutId: number;
}

const WorkoutItem: React.FC<WorkoutDetailsProps> = ({
    exerciseDetails,
    exerciseSets,
    workoutDetails,
    workoutId,
}) => {
    const [workoutVolume, setWorkoutVolume] = useState<number>(0);

    const { t } = useTranslation();
    const { weightUnit } = useUnit();
    const { colors } = useTheme<CustomThemeType>();

    const styles = makeStyles(colors);

    const details = workoutDetails[workoutId];
    const exerciseNames = useMemo(() => details?.workoutExercises.map((we) => exerciseDetails[we.exerciseId]?.name).join(', '), [details, exerciseDetails]);
    const totalSets = useMemo(() => details?.workoutExercises.reduce((total, we) => total + (exerciseSets[workoutId]?.[we.id!]?.length || 0), 0), [details, exerciseSets, workoutId]);
    const totalReps = useMemo(() => details?.workoutExercises.reduce((total, we) => total + (exerciseSets[workoutId]?.[we.id!]?.reduce((sum, set) => sum + Number(set.reps), 0) || 0), 0), [details, exerciseSets, workoutId]);

    useEffect(() => {
        const getWorkoutVolume = async () => {
            const totalVolume = await calculateWorkoutVolume(Object.entries(exerciseSets[workoutId] || {}).map(([exerciseId, sets]) => ({
                exerciseId: Number(exerciseId),
                sets,
            })));

            setWorkoutVolume(totalVolume);
        };

        getWorkoutVolume();
    }, [exerciseSets, workoutId]);

    if (!details) {
        return null;
    }

    return (
        <View>
            <Text style={styles.workoutDetails}>
                {exerciseNames}
            </Text>
            {workoutVolume ?? 0 > 0 ? (
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
