import ThemedCard from '@/components/ThemedCard';
import { GRAMS, IMPERIAL_SYSTEM, METRIC_SYSTEM, OUNCES } from '@/constants/storage';
import { ICON_SIZE } from '@/constants/ui';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { safeToFixed } from '@/utils/string';
import { MusclogApiFoodInfoType } from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';
import { FontAwesome5 } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

type FoodItemProps = {
    food: MusclogApiFoodInfoType;
    onAddFood: (food: MusclogApiFoodInfoType) => void;
};

const FoodItem = ({ food, onAddFood }: FoodItemProps) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const { unitSystem } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;
    const macroUnit = unitSystem === METRIC_SYSTEM ? GRAMS : OUNCES;

    return (
        <ThemedCard key={food.productTitle}>
            <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>
                        {food.productTitle}
                    </Text>
                    <Text style={styles.metricDetail}>
                        {food.ean}
                    </Text>
                    <View style={styles.metricRow}>
                        <Text style={styles.metricDetail}>
                            {t('item_value', {
                                item: t('calories'),
                                value: safeToFixed(food.kcal),
                            })}
                        </Text>
                        <Text style={styles.metricDetail}>
                            {t('item_value_unit', {
                                item: t('carbs'),
                                value: getDisplayFormattedWeight(food.carbs || 0, GRAMS, isImperial).toString(),
                                weightUnit: macroUnit,
                            })}
                        </Text>
                    </View>
                    <View style={styles.metricRow}>
                        <Text style={styles.metricDetail}>
                            {t('item_value_unit', {
                                item: t('proteins'),
                                value: getDisplayFormattedWeight(food.protein || 0, GRAMS, isImperial).toString(),
                                weightUnit: macroUnit,
                            })}
                        </Text>
                        <Text style={styles.metricDetail}>
                            {t('item_value_unit', {
                                item: t('fats'),
                                value: getDisplayFormattedWeight(food.fat || 0, GRAMS, isImperial).toString(),
                                weightUnit: macroUnit,
                            })}
                        </Text>
                    </View>
                </View>
                <View style={styles.cardActions}>
                    <FontAwesome5
                        color={colors.primary}
                        name="plus"
                        onPress={() => onAddFood(food)}
                        size={ICON_SIZE}
                        style={styles.iconButton}
                    />
                </View>
            </View>
        </ThemedCard>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    cardActions: {
        alignItems: 'center',
        flexDirection: 'row',
    },
    cardContent: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
    },
    cardHeader: {
        flex: 1,
        marginRight: 22,
    },
    cardTitle: {
        color: colors.onSurface,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    iconButton: {
        marginLeft: 8,
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
});

export default FoodItem;
