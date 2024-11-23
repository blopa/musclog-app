import { COMPLETED_STATUS, INPROGRESS_STATUS, MISSED_STATUS, SCHEDULED_STATUS } from '@/constants/storage';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface StatusBadgeProps {
    status: string;
    style?: ViewStyle;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    const { colors } = useTheme<CustomThemeType>();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { t } = useTranslation();

    return (
        <View
            style={[styles.statusBadge, styles[`statusBadge${status}` as keyof typeof styles] as ViewStyle]}
        >
            <Text style={styles.statusBadgeText}>
                {t(status)}
            </Text>
        </View>
    );
};

const STATUS_BADGE_COLORS = {
    [`statusBadge${COMPLETED_STATUS}`]: {
        backgroundColor: '#D1FAE5',
        color: '#000000',
    },
    [`statusBadge${INPROGRESS_STATUS}`]: {
        backgroundColor: '#FEF3C7',
        color: '#000000',
    },
    [`statusBadge${MISSED_STATUS}`]: {
        backgroundColor: '#FEE2E2',
        color: '#000000',
    },
    [`statusBadge${SCHEDULED_STATUS}`]: {
        backgroundColor: '#DBEAFE',
        color: '#000000',
    },
};

const makeStyles = (colors: CustomThemeColorsType) => StyleSheet.create({
    ...STATUS_BADGE_COLORS,
    statusBadge: {
        borderRadius: 12,
        marginTop: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        width: 80,
    },
    statusBadgeText: {
        color: 'black',
        fontSize: 12,
    },
});

export default StatusBadge;
