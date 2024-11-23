import { addTransparency, CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import DateTimePicker from '@react-native-community/datetimepicker';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button, useTheme } from 'react-native-paper';

type TimePickerModalProps = {
    onChangeTime: (time: Date) => void;
    onClose: () => void;
    selectedTime: Date;
    visible: boolean;
};

const TimePickerModal = ({ onChangeTime, onClose, selectedTime, visible }: TimePickerModalProps) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const handleTimeChange = (event: any, date?: Date | null) => {
        if (date) {
            onChangeTime(date);
        }

        if (Platform.OS !== 'web') {
            onClose();
        }
    };

    if (!visible) {
        return null;
    }

    if (Platform.OS === 'web') {
        return (
            <Modal
                animationType="fade"
                onRequestClose={onClose}
                transparent={true}
                visible={visible}
            >
                <Pressable onPress={onClose} style={styles.modalBackground}>
                    <Pressable onPress={() => {}} style={styles.modalContent}>
                        <View style={styles.webTimePickerContainer}>
                            <input
                                onChange={(e) => handleTimeChange(null, new Date(`1970-01-01T${e.target.value}:00`))}
                                type="time"
                                value={selectedTime.toISOString().substr(11, 5)}
                            />
                            <Button mode="contained" onPress={onClose} style={styles.closeButton} >
                                {t('close')}
                            </Button>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        );
    }

    return (
        <DateTimePicker
            display="default"
            mode="time"
            onChange={handleTimeChange}
            style={styles.dateTimePicker}
            value={selectedTime}
        />
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    closeButton: {
        marginTop: 16,
    },
    dateTimePicker: {
        width: '100%',
    },
    modalBackground: {
        alignItems: 'center',
        backgroundColor: addTransparency(colors.background, 0.5),
        flex: 1,
        justifyContent: 'center',
    },
    modalContent: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.shadow,
        borderRadius: 8,
        borderWidth: 1,
        padding: 16,
    },
    webTimePickerContainer: {
        alignItems: 'center',
        width: '100%',
    },
});

export default TimePickerModal;
