import { formatDate } from '@/utils/date';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';

interface ArrowedDatePickerProps {
    initialDate?: Date;
    onChange?: (date: Date) => void;
}

export default function ArrowedDatePicker({ initialDate = new Date(), onChange }: ArrowedDatePickerProps) {
    const [currentDate, setCurrentDate] = useState(initialDate);
    const { t } = useTranslation();

    const handleDateChange = (days: number) => {
        const newDate = new Date(currentDate);
        newDate.setDate(currentDate.getDate() + days);
        setCurrentDate(newDate);
        onChange?.(newDate);
    };

    return (
        <View style={styles.container}>
            <IconButton
                accessibilityLabel={t('previous_day')}
                icon="chevron-left"
                onPress={() => handleDateChange(-1)}
                style={styles.iconButton}
            />
            <Text accessibilityLiveRegion="polite" style={styles.dateText}>
                {formatDate(currentDate.toISOString(), 'dd/MM/yyyy')}
            </Text>
            <IconButton
                accessibilityLabel={t('next_day')}
                icon="chevron-right"
                onPress={() => handleDateChange(1)}
                style={styles.iconButton}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 16,
        justifyContent: 'center',
        padding: 8,
    },
    dateText: {
        fontSize: 16,
        fontWeight: '500',
        minWidth: 120,
        textAlign: 'center',
    },
    iconButton: {
        marginHorizontal: 8,
    },
});
