import { addTransparency, CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import DateTimePicker from '@react-native-community/datetimepicker';
import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button, useTheme } from 'react-native-paper';

type DatePickerModalProps = {
    onChangeDate: (date: Date) => void;
    onClose: () => void;
    selectedDate: Date;
    visible: boolean;
};

const DatePickerModal = ({ onChangeDate, onClose, selectedDate, visible }: DatePickerModalProps) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const handleDateChange = (date?: Date | null) => {
        if (date) {
            onChangeDate(date);
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
                        <View style={styles.webDatePickerContainer}>
                            <DatePicker
                                className="custom-datepicker"
                                inline
                                onChange={handleDateChange}
                                selected={selectedDate}
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
            mode="date"
            onChange={(e, date) => handleDateChange(date)}
            style={styles.dateTimePicker}
            value={selectedDate}
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
    webDatePickerContainer: {
        alignItems: 'center',
        width: '100%',
    },
});

export default DatePickerModal;
