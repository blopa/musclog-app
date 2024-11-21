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
import { Platform, StyleSheet, View } from 'react-native';
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
    addButton: {
        alignSelf: 'center',
        marginTop: 16,
    },
    appbarHeader: {
        backgroundColor: colors.primary,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    appbarTitle: {
        color: colors.onPrimary,
        fontSize: Platform.OS === 'web' ? 20 : 26,
    },
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
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    foodTrackingForm: {
        paddingBottom: 16,
    },
    iconButton: {
        marginLeft: 8,
    },
    listContent: {
        backgroundColor: colors.background,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    loadMoreButton: {
        alignSelf: 'center',
        marginVertical: 10,
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
    noResultsContainer: {
        alignItems: 'center',
        marginTop: 20,
    },
    noResultsText: {
        color: colors.onSurface,
        fontSize: 16,
    },
    searchContainer: {
        alignItems: 'center',
        flexDirection: 'row',
        marginBottom: 16,
        marginTop: 12,
        paddingHorizontal: 16,
    },
    searchInput: {
        backgroundColor: colors.surface,
        flex: 1,
    },
});

export default FoodItem;
