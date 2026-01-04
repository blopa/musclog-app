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
import { MealWithFoodsType } from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';

type MealItemProps = {
    meal: MealWithFoodsType;
    onDelete: (meal: MealWithFoodsType) => void;
    onEdit: (meal: MealWithFoodsType) => void;
    onTrack: (meal: MealWithFoodsType) => void;
};

const MealItem = ({ meal, onDelete, onEdit, onTrack }: MealItemProps) => {
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
                        {meal.name}
                    </Text>
                    <Text style={styles.foodCount}>
                        {t('meal_foods_count', { count: meal.foods.length })}
                    </Text>
                    <View style={styles.metricRow}>
                        <Text style={styles.metricDetail}>
                            {t('item_value', {
                                item: t('calories'),
                                value: safeToFixed(meal.totalMacros.calories),
                            })}
                        </Text>
                        <Text style={styles.metricDetail}>
                            {t('item_value_unit', {
                                item: t('carbs'),
                                value: getDisplayFormattedWeight(meal.totalMacros.carbohydrate || 0, GRAMS, isImperial).toString(),
                                weightUnit: macroUnit,
                            })}
                        </Text>
                    </View>
                    <View style={styles.metricRow}>
                        <Text style={styles.metricDetail}>
                            {t('item_value_unit', {
                                item: t('proteins'),
                                value: getDisplayFormattedWeight(meal.totalMacros.protein || 0, GRAMS, isImperial).toString(),
                                weightUnit: macroUnit,
                            })}
                        </Text>
                        <Text style={styles.metricDetail}>
                            {t('item_value_unit', {
                                item: t('fats'),
                                value: getDisplayFormattedWeight(meal.totalMacros.fat || 0, GRAMS, isImperial).toString(),
                                weightUnit: macroUnit,
                            })}
                        </Text>
                    </View>
                </View>
                <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => onTrack(meal)}>
                        <FontAwesome5
                            color={colors.primary}
                            name="plus"
                            size={ICON_SIZE}
                            style={styles.iconButton}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onEdit(meal)}>
                        <FontAwesome5
                            color={colors.primary}
                            name="edit"
                            size={ICON_SIZE}
                            style={styles.iconButton}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete(meal)}>
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
    foodCount: {
        color: colors.onSurfaceVariant,
        fontSize: 12,
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

export default MealItem;

