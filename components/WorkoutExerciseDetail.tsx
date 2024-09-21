import { ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { ExerciseReturnType, ExerciseVolumeType } from '@/utils/types';
import { FontAwesome5 } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import ExerciseSetDetails from './ExerciseSetDetails';

const WorkoutExerciseDetail: React.FC<{
    exercise?: ExerciseReturnType;
    exerciseVolume: ExerciseVolumeType;
    onDeleteExercise?: (exerciseId?: number) => void;
    onDeleteSet?: (setIndex: number, setId?: number) => void;
    onEditSet?: (setIndex: number, setId?: number) => void;
}> = ({ exercise, exerciseVolume, onDeleteExercise, onDeleteSet, onEditSet }) => {
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);

    return (
        <View style={styles.exerciseContainer}>
            <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseTitle}>
                    {exercise?.name || ''}
                </Text>
                {onDeleteExercise ? (
                    <FontAwesome5
                        color={colors.primary}
                        name="trash"
                        onPress={() => onDeleteExercise(exerciseVolume.exerciseId)}
                        size={ICON_SIZE}
                        style={styles.deleteIcon}
                    />
                ) : null}
            </View>
            <View style={styles.exerciseDetails}>
                {exerciseVolume.sets.map((set, setIndex) => (
                    <ExerciseSetDetails
                        key={setIndex}
                        onDeleteSet={onDeleteSet}
                        onEditSet={onEditSet}
                        set={set}
                        setIndex={setIndex}
                        showBorder
                    />
                ))}
            </View>
        </View>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    deleteIcon: {
        height: 22,
        marginLeft: 8,
        marginTop: -5,
    },
    exerciseContainer: {
        backgroundColor: colors.surface,
        borderRadius: 8,
        marginBottom: 6,
        padding: 4,
    },
    exerciseDetails: {
        backgroundColor: colors.surface,
        marginTop: 8,
    },
    exerciseHeader: {
        backgroundColor: colors.surface,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    exerciseTitle: {
        color: colors.onSurface,
        fontSize: 16,
        fontWeight: '500',
    },
});

export default WorkoutExerciseDetail;
