import ThemedModal from '@/components/ThemedModal';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { CurrentWorkoutProgressType, ExerciseWithSetsType } from '@/utils/types';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

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

    const groupedData = useMemo(() => completedWorkoutData.reduce((acc, set) => {
        if (!acc[set.name]) {
            acc[set.name] = [];
        }

        acc[set.name].push(set);
        return acc;
    }, {} as { [key: string]: CurrentWorkoutProgressType[] }), [completedWorkoutData]);

    return (
        <ThemedModal
            cancelText={t('close')}
            confirmText=""
            onClose={onClose}
            title={t('current_workout_progress')}
            visible={isVisible}
        >
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled" style={{ maxHeight: windowHeight * 0.7 }}>
                {completedWorkoutData.length === 0 && remainingWorkoutData.length === 0 ? (
                    <Text>{t('no_data')}</Text>
                ) : (
                    <>
                        {completedWorkoutData.length ? (
                            <Text style={styles.subTitle}>{t('completed_sets')}</Text>
                        ) : null}
                        {Object.keys(groupedData).map((exerciseName) => (
                            <View key={exerciseName} style={styles.exerciseContainer}>
                                <Text style={styles.exerciseName}>{exerciseName}</Text>
                                {groupedData[exerciseName].map((set, index) => (
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
                        {remainingWorkoutData.length ? (
                            <Text style={styles.subTitle}>{t('remaining_sets')}</Text>
                        ) : null}
                        {remainingWorkoutData.map((exercise) => (
                            <View key={exercise.id} style={styles.exerciseContainer}>
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
                <View style={{ marginVertical: 10 }} />
            </ScrollView>
        </ThemedModal>
    );
};

const makeStyles = (colors: CustomThemeColorsType) => StyleSheet.create({
    exerciseContainer: {
        marginBottom: 16,
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
        fontSize: 16,
        fontWeight: 'bold',
        marginVertical: 16,
    },
});

export default CurrentWorkoutProgressModal;
