import CustomPicker from '@/components/CustomPicker';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { getAllExercises } from '@/utils/database';
import { ExerciseReturnType } from '@/utils/types';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import {
    ActivityIndicator,
    Button,
    Dialog,
    Portal,
    useTheme,
} from 'react-native-paper';

type AddExerciseModalProps = {
    defaultSelectedMuscleGroup?: string;
    isVisible: boolean;
    onClose: () => void;
    onExerciseSelected: (exerciseId: number) => void;
};

export default function AddExerciseModal({ defaultSelectedMuscleGroup, isVisible, onClose, onExerciseSelected }: AddExerciseModalProps) {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | undefined>(defaultSelectedMuscleGroup);
    const [allExercises, setAllExercises] = useState<ExerciseReturnType[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (defaultSelectedMuscleGroup) {
            setSelectedMuscleGroup(defaultSelectedMuscleGroup);
        }
    }, [defaultSelectedMuscleGroup]);

    const resetScreenData = useCallback(() => {
        setSelectedMuscleGroup(undefined);
        setIsLoading(false);
        setAllExercises([]);
    }, []);

    useFocusEffect(
        useCallback(() => {
            return () => {
                resetScreenData();
            };
        }, [resetScreenData])
    );

    useFocusEffect(
        useCallback(() => {
            const loadExercises = async () => {
                try {
                    setIsLoading(true);
                    const exercises = await getAllExercises();
                    setAllExercises(exercises);
                } catch (error) {
                    console.error(t('failed_to_load_exercises'), error);
                    Alert.alert(t('error'), t('failed_to_load_exercises'));
                } finally {
                    setIsLoading(false);
                }
            };

            loadExercises();
        }, [t])
    );

    const muscleGroups = Array.from(
        new Set(allExercises.map((ex) => ex.muscleGroup))
    ) as string[];

    return (
        <Portal>
            <Dialog
                onDismiss={() => onClose()}
                visible={isVisible}
            >
                {isLoading ? (
                    <View style={styles.overlay}>
                        <ActivityIndicator color={colors.primary} size="large" />
                    </View>
                ) : null}
                <Dialog.Title>{t('add_exercise')}</Dialog.Title>
                <Dialog.Content>
                    <CustomPicker
                        items={[
                            {
                                label: t('select_muscle_group'),
                                value: '',
                            },
                            ...muscleGroups.map((group) => ({
                                label: t(`muscle_groups.${group}`),
                                value: group,
                            })),
                        ]}
                        label={t('muscle_group')}
                        onValueChange={(value) => setSelectedMuscleGroup(value)}
                        selectedValue={selectedMuscleGroup || ''}
                    />
                    {selectedMuscleGroup ? (
                        <CustomPicker
                            items={[
                                { label: t('select_exercise'), value: '' },
                                ...allExercises
                                    .filter(
                                        (ex) => ex.muscleGroup === selectedMuscleGroup
                                    )
                                    .map((exercise) => ({
                                        label: exercise.name,
                                        value: exercise.id.toString(),
                                    })),
                            ]}
                            label={t('exercise')}
                            onValueChange={(value) => {
                                const exerciseId = Number(value);
                                onExerciseSelected(exerciseId);
                            }}
                            selectedValue=""
                        />
                    ) : null}
                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={() => onClose()}>
                        {t('cancel')}
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
}

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        flex: 1,
        justifyContent: 'center',
    },
});
