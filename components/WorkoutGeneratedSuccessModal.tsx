import ThemedModal from '@/components/ThemedModal';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, useTheme } from 'react-native-paper';

type SuccessModalProps = {
    isVisible: boolean;
    navigateToWorkouts: () => void;
    onClose: () => void;
};

const WorkoutGeneratedSuccessModal = ({ isVisible, navigateToWorkouts, onClose }: SuccessModalProps) => {
    const { t } = useTranslation();
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);

    return (
        <ThemedModal onClose={onClose} title={t('workout_plan_generated_successfully')} visible={isVisible}>
            <View style={styles.successModal}>
                <Button mode="contained" onPress={navigateToWorkouts} style={styles.modalButton}>
                    {t('go_to_workouts')}
                </Button>
                <Button mode="outlined" onPress={onClose} style={styles.modalButton}>
                    {t('close')}
                </Button>
            </View>
        </ThemedModal>
    );
};

const makeStyles = (colors: CustomThemeColorsType) => StyleSheet.create({
    modalButton: {
        marginVertical: 8,
        width: '100%',
    },
    successModal: {
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: 8,
        padding: 10,
    },
});

export default WorkoutGeneratedSuccessModal;
