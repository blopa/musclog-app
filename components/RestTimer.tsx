import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { formatTime } from '@/utils/date';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';

type RestTimerProps = {
    onAddTime: () => void;
    onSkipRest: () => void;
    onSubtractTime: () => void;
    restTime: number;
};

const RestTimer = ({ onAddTime, onSkipRest, onSubtractTime, restTime }: RestTimerProps) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    return (
        <>
            <View style={styles.timerContainer}>
                <Text style={styles.timerText}>
                    {formatTime(restTime, false)}
                </Text>
            </View>
            <Button mode="contained" onPress={onSkipRest} style={styles.buttonSpacing}>
                {t('skip_rest')}
            </Button>
            <View style={styles.adjustTimeContainer}>
                <Button mode="outlined" onPress={onSubtractTime} style={styles.adjustButtonSpacing}>
                    {t('subtract_time')}
                </Button>
                <Button mode="outlined" onPress={onAddTime} style={styles.adjustButtonSpacing}>
                    {t('add_time')}
                </Button>
            </View>
        </>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    adjustButtonSpacing: {
        marginHorizontal: 10,
        width: 130,
    },
    adjustTimeContainer: {
        backgroundColor: colors.background,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
    },
    buttonSpacing: {
        marginTop: 16,
        width: '100%',
    },
    timerContainer: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: dark ? '#333' : '#ccc',
        borderRadius: 110,
        borderWidth: 1,
        height: 190,
        justifyContent: 'center',
        marginBottom: 16,
        width: 190,
    },
    timerText: {
        color: colors.onBackground,
        fontSize: 40,
        fontWeight: 'bold',
        lineHeight: 40,
    },
});

export default RestTimer;
