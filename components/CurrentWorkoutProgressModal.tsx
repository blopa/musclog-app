import ThemedModal from '@/components/ThemedModal';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { CurrentWorkoutProgressType, ExerciseWithSetsType } from '@/utils/types';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme, List } from 'react-native-paper';

interface PreviousSetDataModalProps {
    completedWorkoutData: CurrentWorkoutProgressType[];
    isVisible: boolean;
    onClose: () => void;
    remainingWorkoutData: ExerciseWithSetsType[];
}

const CurrentWorkoutProgressModal: React.FC<PreviousSetDataModalProps> = ({
    completedWorkoutData,
    isVisible,
    onClose,
    remainingWorkoutData,
}) => {
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);
    const { t } = useTranslation();
    const { weightUnit } = useUnit();
    const windowHeight = Dimensions.get('window').height;

    // Group completedWorkoutData by supersetName and then by exerciseName
    const groupedCompletedData = useMemo(() => {
        const supersets: { [supersetName: string]: CurrentWorkoutProgressType[] } = {};
        const standaloneExercises: { [exerciseName: string]: CurrentWorkoutProgressType[] } = {};

        completedWorkoutData.forEach((set) => {
            const superset = set.supersetName || 'No Superset';
            if (superset !== 'No Superset') {
                if (!supersets[superset]) {
                    supersets[superset] = [];
                }
                supersets[superset].push(set);
            } else {
                if (!standaloneExercises[set.name]) {
                    standaloneExercises[set.name] = [];
                }
                standaloneExercises[set.name].push(set);
            }
        });

        return { supersets, standaloneExercises };
    }, [completedWorkoutData]);

    // Group remainingWorkoutData by supersetName and then by exerciseName
    const groupedRemainingData = useMemo(() => {
        const supersets: { [supersetName: string]: ExerciseWithSetsType[] } = {};
        const standaloneExercises: ExerciseWithSetsType[] = [];

        remainingWorkoutData.forEach((exercise) => {
            const superset = exercise.sets.find((set) => set.supersetName)?.supersetName || null;
            if (superset) {
                if (!supersets[superset]) {
                    supersets[superset] = [];
                }
                supersets[superset].push(exercise);
            } else {
                standaloneExercises.push(exercise);
            }
        });

        return { supersets, standaloneExercises };
    }, [remainingWorkoutData]);

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
                    <Text>{t('no_data')}</Text>
                ) : (
                    <>
                        {completedWorkoutData.length > 0 && (
                            <>
                                <Text style={styles.subTitle}>{t('completed_sets')}</Text>
                                {Object.keys(groupedCompletedData.supersets).map((supersetName) => (
                                    <List.Accordion
                                        key={`completed-superset-${supersetName}`}
                                        title={`${t('superset')}: ${supersetName}`}
                                        left={(props) => <List.Icon {...props} icon="format-list-bulleted" />}
                                        titleStyle={styles.supersetTitle}
                                    >
                                        {(() => {
                                            const exercisesInSuperset = groupedCompletedData.supersets[supersetName];
                                            const groupedByExercise: { [exerciseName: string]: CurrentWorkoutProgressType[] } = {};

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
                                    </List.Accordion>
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
                        {remainingWorkoutData.length > 0 && (
                            <>
                                <Text style={styles.subTitle}>{t('remaining_sets')}</Text>
                                {Object.keys(groupedRemainingData.supersets).map((supersetName) => (
                                    <List.Accordion
                                        key={`remaining-superset-${supersetName}`}
                                        title={`${t('superset')}: ${supersetName}`}
                                        left={(props) => <List.Icon {...props} icon="format-list-bulleted" />}
                                        titleStyle={styles.supersetTitle}
                                    >
                                        {groupedRemainingData.supersets[supersetName].map((exercise) => (
                                            <View key={`remaining-superset-${supersetName}-exercise-${exercise.id}`} style={styles.exerciseContainer}>
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
                                    </List.Accordion>
                                ))}
                                {groupedRemainingData.standaloneExercises.map((exercise) => (
                                    <View key={`remaining-standalone-${exercise.id}`} style={styles.exerciseContainer}>
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
        backgroundColor: colors.surface,
        borderRadius: 8,
        marginBottom: 16,
        padding: 8,
    },
    exerciseName: {
        color: colors.primary,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    modalContent: {
        padding: 16,
    },
    setData: {
        marginBottom: 8,
        paddingLeft: 8,
    },
    setDetails: {
        flexDirection: 'row',
    },
    setText: {
        color: colors.onBackground,
        marginHorizontal: 10,
    },
    subTitle: {
        color: colors.primary,
        fontSize: 18,
        fontWeight: 'bold',
        marginVertical: 16,
    },
    supersetTitle: {
        color: colors.primary,
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default CurrentWorkoutProgressModal;
