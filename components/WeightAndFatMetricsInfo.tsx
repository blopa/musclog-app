import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface WeightAndFatMetricsInfoProps {
    bodyFatExamplesMessage?: string;
    currentWeightChangeRateMessage?: string;
    idealWeightChangeRateMessage?: string;
    muscleFatChangeMessage?: string;
    totalBodyFatWeightMessage?: string;
}

const WeightAndFatMetricsInfo = ({
    bodyFatExamplesMessage,
    currentWeightChangeRateMessage,
    idealWeightChangeRateMessage,
    muscleFatChangeMessage,
    totalBodyFatWeightMessage,
}: WeightAndFatMetricsInfoProps) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    return (
        <View style={styles.metricsInfoContainer}>
            <Text style={styles.metricsInfoTitle}>
                {t('body_weight_insights')}
            </Text>
            {idealWeightChangeRateMessage ? (
                <Text style={styles.weightChangingRate}>
                    {idealWeightChangeRateMessage}
                </Text>
            ) : null}
            {currentWeightChangeRateMessage ? (
                <Text style={styles.weightChangingRate}>
                    {currentWeightChangeRateMessage}
                </Text>
            ) : null}
            {muscleFatChangeMessage ? (
                <Text style={[styles.weightChangingRate, styles.newLine]}>
                    {muscleFatChangeMessage}
                </Text>
            ) : null}
            {totalBodyFatWeightMessage ? (
                <Text style={styles.weightChangingRate}>
                    {totalBodyFatWeightMessage}
                </Text>
            ) : null}
            {bodyFatExamplesMessage ? (
                <Text style={[styles.weightChangingRate, styles.newLine]}>
                    {bodyFatExamplesMessage}
                </Text>
            ) : null}
        </View>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    metricsInfoContainer: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        marginVertical: 8,
        padding: 16,
        width: '100%',
    },
    metricsInfoTitle: {
        color: colors.onSurface,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    newLine: {
        marginTop: 8,
    },
    weightChangingRate: {
        color: colors.onBackground,
        fontSize: 14,
        textAlign: 'center',
    },
});

export default WeightAndFatMetricsInfo;
