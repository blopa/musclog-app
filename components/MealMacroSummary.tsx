import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { GRAMS, IMPERIAL_SYSTEM, METRIC_SYSTEM, OUNCES } from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { safeToFixed } from '@/utils/string';
import { getDisplayFormattedWeight } from '@/utils/unit';

type MealMacroSummaryProps = {
    macros: {
        calories: number;
        carbohydrate: number;
        fat: number;
        protein: number;
    };
};

const MealMacroSummary = ({ macros }: MealMacroSummaryProps) => {
    const { t } = useTranslation();
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);

    const { unitSystem } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;
    const macroUnit = unitSystem === METRIC_SYSTEM ? GRAMS : OUNCES;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>
                {t('meal_macros')}
            </Text>
            <View style={styles.metricRow}>
                <Text style={styles.metricDetail}>
                    {t('item_value', {
                        item: t('calories'),
                        value: safeToFixed(macros.calories),
                    })}
                </Text>
                <Text style={styles.metricDetail}>
                    {t('item_value_unit', {
                        item: t('carbs'),
                        value: getDisplayFormattedWeight(macros.carbohydrate || 0, GRAMS, isImperial).toString(),
                        weightUnit: macroUnit,
                    })}
                </Text>
            </View>
            <View style={styles.metricRow}>
                <Text style={styles.metricDetail}>
                    {t('item_value_unit', {
                        item: t('proteins'),
                        value: getDisplayFormattedWeight(macros.protein || 0, GRAMS, isImperial).toString(),
                        weightUnit: macroUnit,
                    })}
                </Text>
                <Text style={styles.metricDetail}>
                    {t('item_value_unit', {
                        item: t('fats'),
                        value: getDisplayFormattedWeight(macros.fat || 0, GRAMS, isImperial).toString(),
                        weightUnit: macroUnit,
                    })}
                </Text>
            </View>
        </View>
    );
};

const makeStyles = (colors: CustomThemeColorsType) => StyleSheet.create({
    container: {
        backgroundColor: colors.surfaceVariant,
        borderRadius: 8,
        marginBottom: 16,
        padding: 16,
    },
    metricDetail: {
        color: colors.onSurface,
        fontSize: 14,
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    title: {
        color: colors.onSurface,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
});

export default MealMacroSummary;

