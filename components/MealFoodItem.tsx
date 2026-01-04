import { FontAwesome5 } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import ThemedCard from '@/components/ThemedCard';
import { GRAMS, IMPERIAL_SYSTEM, METRIC_SYSTEM, OUNCES } from '@/constants/storage';
import { ICON_SIZE } from '@/constants/ui';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { safeToFixed } from '@/utils/string';
import { FoodReturnType, MealFoodReturnType } from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';

type MealFoodItemProps = {
    mealFood: MealFoodReturnType & { calculatedMacros: { calories: number; carbohydrate: number; fat: number; protein: number; }; food: FoodReturnType; };
    onEdit: (mealFood: MealFoodReturnType & { food: FoodReturnType }) => void;
    onRemove: (mealFoodId: number) => void;
};

const MealFoodItem = ({ mealFood, onEdit, onRemove }: MealFoodItemProps) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const { unitSystem } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;
    const macroUnit = unitSystem === METRIC_SYSTEM ? GRAMS : OUNCES;

    return (
        <ThemedCard>
            <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>
                        {mealFood.food.name}
                    </Text>
                    <Text style={styles.quantity}>
                        {t('grams')}: {getDisplayFormattedWeight(mealFood.grams || 0, GRAMS, isImperial)}{macroUnit}
                    </Text>
                    <View style={styles.metricRow}>
                        <Text style={styles.metricDetail}>
                            {t('item_value', {
                                item: t('calories'),
                                value: safeToFixed(mealFood.calculatedMacros.calories),
                            })}
                        </Text>
                        <Text style={styles.metricDetail}>
                            {t('item_value_unit', {
                                item: t('carbs'),
                                value: getDisplayFormattedWeight(mealFood.calculatedMacros.carbohydrate || 0, GRAMS, isImperial).toString(),
                                weightUnit: macroUnit,
                            })}
                        </Text>
                    </View>
                    <View style={styles.metricRow}>
                        <Text style={styles.metricDetail}>
                            {t('item_value_unit', {
                                item: t('proteins'),
                                value: getDisplayFormattedWeight(mealFood.calculatedMacros.protein || 0, GRAMS, isImperial).toString(),
                                weightUnit: macroUnit,
                            })}
                        </Text>
                        <Text style={styles.metricDetail}>
                            {t('item_value_unit', {
                                item: t('fats'),
                                value: getDisplayFormattedWeight(mealFood.calculatedMacros.fat || 0, GRAMS, isImperial).toString(),
                                weightUnit: macroUnit,
                            })}
                        </Text>
                    </View>
                </View>
                <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => onEdit(mealFood)}>
                        <FontAwesome5
                            color={colors.primary}
                            name="edit"
                            size={ICON_SIZE}
                            style={styles.iconButton}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onRemove(mealFood.id)}>
                        <FontAwesome5
                            color={colors.error}
                            name="trash"
                            size={ICON_SIZE}
                            style={styles.iconButton}
                        />
                    </TouchableOpacity>
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
    quantity: {
        color: colors.onSurfaceVariant,
        fontSize: 12,
        marginBottom: 8,
    },
});

export default MealFoodItem;

