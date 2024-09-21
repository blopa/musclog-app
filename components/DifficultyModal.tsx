import ThemedModal from '@/components/ThemedModal';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'react-native-paper';

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
            <Button disabled={loading} mode="contained" onPress={handleSaveSetDifficulty}>
                {t('save')}
            </Button>
        </ThemedModal>
    );
};

export default DifficultyModal;
