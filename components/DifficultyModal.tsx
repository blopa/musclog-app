import ThemedModal from '@/components/ThemedModal';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { Button, useTheme } from 'react-native-paper';

import SliderWithButtons from './SliderWithButtons';

type DifficultyModalProps = {
    handleSaveSetDifficulty: () => void;
    loading: boolean;
    onClose?: () => void;
    setDifficulty: number;
    setSetDifficulty: (value: number) => void;
    visible: boolean;
};

const DifficultyModal = ({
    handleSaveSetDifficulty,
    loading,
    onClose = () => {},
    setDifficulty,
    setSetDifficulty,
    visible,
}: DifficultyModalProps) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    return (
        <ThemedModal
            onClose={onClose}
            title={t('rate_set_difficulty')}
            visible={visible}
        >
            <SliderWithButtons
                label={t('difficulty_level_out_of', { level: setDifficulty })}
                onValueChange={setSetDifficulty}
                value={setDifficulty}
            />
            <Button disabled={loading} mode="contained" onPress={handleSaveSetDifficulty} style={styles.button}>
                {t('save')}
            </Button>
            <Button disabled={loading} mode="outlined" onPress={onClose} style={styles.button}>
                {t('close')}
            </Button>
        </ThemedModal>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    button: {
        marginVertical: 5,
    },
});

export default DifficultyModal;
