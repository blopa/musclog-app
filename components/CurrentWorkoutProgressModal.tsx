import ThemedModal from '@/components/ThemedModal';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { ExerciseProgressType, ExerciseReturnType, ExerciseWithSetsType, SetReturnType } from '@/utils/types';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface PreviousSetDataModalProps {
    completedWorkoutData: ExerciseProgressType[];
    isVisible: boolean;
    onClose: () => void;
    orderedExercises: { exercise: ExerciseReturnType; sets: SetReturnType[] }[];
    remainingWorkoutData: ExerciseWithSetsType[];
}

const CurrentWorkoutProgressModal: React.FC<PreviousSetDataModalProps> = ({
    completedWorkoutData,
    isVisible,
    onClose,
    orderedExercises,
    remainingWorkoutData,
}) => {
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);
    const { t } = useTranslation();
    const { weightUnit } = useUnit();
    const windowHeight = Dimensions.get('window').height;

    const completedSetIds = useMemo(() => {
        return completedWorkoutData.map((exercise) => exercise.setId);
    }, [completedWorkoutData]);

    // Map remainingWorkoutData sets by their set IDs for quick lookup
    const remainingSetIds = useMemo(()=> {
        return new Set(
            remainingWorkoutData
                .flatMap((exercise) => exercise.sets.map((set) => set.id))
                .filter((setId) => !completedSetIds.includes(setId))
        );
    }, [remainingWorkoutData, completedSetIds]);

    // Group completedWorkoutData by supersetName and then by exerciseName
    const groupedCompletedData = useMemo(() => {
        const supersets: { [supersetName: string]: ExerciseProgressType[] } = {};
        const standaloneExercises: { [exerciseName: string]: ExerciseProgressType[] } = {};

        completedWorkoutData.forEach((set) => {
            const supersetName = set.supersetName || null;
            if (supersetName) {
                if (!supersets[supersetName]) {
                    supersets[supersetName] = [];
                }
                supersets[supersetName].push(set);
            } else {
                if (!standaloneExercises[set.name]) {
                    standaloneExercises[set.name] = [];
                }
                standaloneExercises[set.name].push(set);
            }
        });

        return { standaloneExercises, supersets };
    }, [completedWorkoutData]);

    // Group remaining data by supersetName and exerciseName using orderedExercises for ordering
    const groupedRemainingData = useMemo(() => {
        const supersets: { [supersetName: string]: ExerciseWithSetsType[] } = {};
        const standaloneExercises: ExerciseWithSetsType[] = [];

        orderedExercises.forEach(({ exercise, sets }) => {
            // Filter out sets that are not in remainingWorkoutData
            const remainingSets = sets.filter((set) => remainingSetIds.has(set.id));

            if (remainingSets.length > 0) {
                const supersetName = remainingSets[0].supersetName || null;
                if (supersetName) {
                    if (!supersets[supersetName]) {
                        supersets[supersetName] = [];
                    }
                    supersets[supersetName].push({
                        ...exercise,
                        sets: remainingSets,
                    });
                } else {
                    standaloneExercises.push({
                        ...exercise,
                        sets: remainingSets,
                    });
                }
            }
        });

        return { standaloneExercises, supersets };
    }, [orderedExercises, remainingSetIds]);

    return (
        <ThemedModal
            cancelText={t('close')}
            confirmText=""
            onClose={onClose}
            title={t('current_workout_progress')}
            visible={isVisible}
        >
            <ScrollView
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: windowHeight * 0.7 }}
            >
                {completedWorkoutData.length === 0 && remainingWorkoutData.length === 0 ? (
                    <Text style={styles.noDataText}>{t('no_data')}</Text>
                ) : (
                    <>
                        {completedWorkoutData.length > 0 && (
                            <>
                                <Text style={styles.subTitle}>{t('completed_sets')}</Text>
                                {Object.keys(groupedCompletedData.supersets).map((supersetName) => (
                                    <View key={`completed-superset-${supersetName}`} style={styles.supersetContainer}>
                                        <Text style={styles.supersetHeader}>{`${t('superset')}: ${supersetName}`}</Text>
                                        {(() => {
                                            const exercisesInSuperset = groupedCompletedData.supersets[supersetName];
                                            const groupedByExercise: { [exerciseName: string]: ExerciseProgressType[] } = {};

                                            exercisesInSuperset.forEach((set) => {
                                                if (!groupedByExercise[set.name]) {
                                                    groupedByExercise[set.name] = [];
                                                }
                                                groupedByExercise[set.name].push(set);
                                            });

                                            return Object.keys(groupedByExercise).map((exerciseName) => (
                                                <View key={`completed-superset-${supersetName}-exercise-${exerciseName}`} style={styles.exerciseContainer}>
                                                    <Text style={styles.exerciseName}>{exerciseName}</Text>
                                                    {groupedByExercise[exerciseName].map((set, index) => (
                                                        <View key={index} style={styles.setData}>
                                                            <Text style={styles.setText}>
                                                                {t('set')}: {`#${set.setIndex}`}
                                                            </Text>
                                                            <View style={styles.setDetails}>
                                                                <Text style={styles.setText}>
                                                                    {t('weight', { weightUnit })}: {set.weight}
                                                                </Text>
                                                                <Text style={styles.setText}>
                                                                    {t('reps')}: {set.reps}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    ))}
                                                </View>
                                            ));
                                        })()}
                                    </View>
                                ))}
                                {Object.keys(groupedCompletedData.standaloneExercises).map((exerciseName) => (
                                    <View key={`completed-standalone-${exerciseName}`} style={styles.exerciseContainer}>
                                        <Text style={styles.exerciseName}>{exerciseName}</Text>
                                        {groupedCompletedData.standaloneExercises[exerciseName].map((set, index) => (
                                            <View key={index} style={styles.setData}>
                                                <Text style={styles.setText}>
                                                    {t('set')}: {`#${set.setIndex}`}
                                                </Text>
                                                <View style={styles.setDetails}>
                                                    <Text style={styles.setText}>
                                                        {t('weight', { weightUnit })}: {set.weight}
                                                    </Text>
                                                    <Text style={styles.setText}>
                                                        {t('reps')}: {set.reps}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                ))}
                            </>
                        )}
                        {orderedExercises.length > 0 && (
                            <>
                                <Text style={styles.subTitle}>{t('remaining_sets')}</Text>
                                {Object.keys(groupedRemainingData.supersets).map((supersetName) => (
                                    <View key={`remaining-superset-${supersetName}`} style={styles.supersetContainer}>
                                        <Text style={styles.supersetHeader}>{`${t('superset')}: ${supersetName}`}</Text>
                                        {groupedRemainingData.supersets[supersetName].map((exercise, idx) => (
                                            <View key={`remaining-superset-${supersetName}-exercise-${exercise.id}-${idx}`} style={styles.exerciseContainer}>
                                                <Text style={styles.exerciseName}>{exercise.name}</Text>
                                                {exercise.sets.map((set, index) => (
                                                    <View key={index} style={styles.setData}>
                                                        <Text style={styles.setText}>
                                                            {t('set')}: {`#${index + 1}`}
                                                        </Text>
                                                        <View style={styles.setDetails}>
                                                            <Text style={styles.setText}>
                                                                {t('weight', { weightUnit })}: {set.weight}
                                                            </Text>
                                                            <Text style={styles.setText}>
                                                                {t('reps')}: {set.reps}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                ))}
                                            </View>
                                        ))}
                                    </View>
                                ))}
                                {groupedRemainingData.standaloneExercises.map((exercise, idx) => (
                                    <View key={`remaining-standalone-${exercise.id}-${idx}`} style={styles.exerciseContainer}>
                                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                                        {exercise.sets.map((set, index) => (
                                            <View key={index} style={styles.setData}>
                                                <Text style={styles.setText}>
                                                    {t('set')}: {`#${index + 1}`}
                                                </Text>
                                                <View style={styles.setDetails}>
                                                    <Text style={styles.setText}>
                                                        {t('weight', { weightUnit })}: {set.weight}
                                                    </Text>
                                                    <Text style={styles.setText}>
                                                        {t('reps')}: {set.reps}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                ))}
                            </>
                        )}
                    </>
                )}
                <View style={{ marginVertical: 10 }} />
            </ScrollView>
        </ThemedModal>
    );
};

const makeStyles = (colors: CustomThemeColorsType) => StyleSheet.create({
    exerciseContainer: {
        backgroundColor: colors.background,
        borderColor: colors.onSurface,
        borderRadius: 6,
        borderWidth: 1,
        marginBottom: 12,
        padding: 8,
    },
    exerciseName: {
        color: colors.onBackground,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 6,
    },
    modalContent: {
        padding: 16,
    },
    noDataText: {
        color: colors.onBackground,
        fontSize: 16,
        marginTop: 20,
        textAlign: 'center',
    },
    setData: {
        alignItems: 'center',
        flexDirection: 'row',
        marginBottom: 4,
    },
    setDetails: {
        flexDirection: 'row',
    },
    setText: {
        color: colors.onBackground,
        fontSize: 12,
        marginRight: 10,
    },
    subTitle: {
        color: colors.primary,
        fontSize: 18,
        fontWeight: 'bold',
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

export default CurrentWorkoutProgressModal;
