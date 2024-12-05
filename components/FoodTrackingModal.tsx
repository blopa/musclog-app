import PieChart from '@/components/Charts/PieChart';
import CustomPicker from '@/components/CustomPicker';
import CustomTextInput from '@/components/CustomTextInput';
import ThemedModal from '@/components/ThemedModal';
import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { MEAL_TYPE, NUTRITION_TYPES } from '@/constants/nutrition';
import { GRAMS, IMPERIAL_SYSTEM, METRIC_SYSTEM, OUNCES } from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { normalizeMacrosByGrams } from '@/utils/data';
import { addFood, addUserNutrition, getFoodByNameAndMacros, updateUserNutrition } from '@/utils/database';
import { getCurrentTimestampISOString } from '@/utils/date';
import { updateRecentFood } from '@/utils/storage';
import { generateHash, safeToFixed } from '@/utils/string';
import { UserNutritionInsertType } from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';

export type FoodTrackingType = {
    carbs: number;
    estimatedGrams?: number;
    fat: number;
    grams?: number;
    kcal: number;
    productCode?: string;
    productTitle: string;
    protein: number;
};

type FoodTrackingModalProps = {
    allowEditName?: boolean;
    food: FoodTrackingType | null;
    isLoading?: boolean;
    onClose: () => void;
    showChart?: boolean;
    userNutritionId?: null | number;
    visible: boolean;
};

const GRAM_BASE = 100;

const FoodTrackingModal = ({
    allowEditName = false,
    food,
    isLoading = false,
    onClose,
    showChart = true,
    userNutritionId,
    visible,
}: FoodTrackingModalProps) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const [unitAmount, setUnitAmount] = useState(GRAM_BASE.toString());
    const [mealType, setMealType] = useState('0');
    const [editableName, setEditableName] = useState(food?.productTitle || '');

    const { unitSystem } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;
    const macroUnit = unitSystem === METRIC_SYSTEM ? GRAMS : OUNCES;

    const [calculatedValues, setCalculatedValues] = useState({
        carbs: 0,
        fat: 0,
        kcal: 0,
        protein: 0,
    });

    const handleSetUnitAmount = useCallback((text: string) => {
        const value = getDisplayFormattedWeight(parseFloat(text), GRAMS, isImperial);
        setUnitAmount(value.toString());
    }, [isImperial]);

    useEffect(() => {
        if (userNutritionId && food?.grams) {
            handleSetUnitAmount(food.grams.toString());
        }
    }, [food?.grams, handleSetUnitAmount, userNutritionId]);

    const updateCalculatedValues = useCallback((gramsValue: number) => {
        if (food) {
            const factor = gramsValue / GRAM_BASE;

            setCalculatedValues({
                carbs: factor * food.carbs,
                fat: factor * food.fat,
                kcal: factor * food.kcal,
                protein: factor * food.protein,
            });
        }
    }, [food]);

    useEffect(() => {
        if (food) {
            updateCalculatedValues(GRAM_BASE);
        }
    }, [food, updateCalculatedValues]);

    const handleGramsChange = useCallback((text: string) => {
        const formattedText = text.replace(/\D/g, '');
        handleSetUnitAmount(formattedText);

        const gramsValue = parseFloat(formattedText) || 0;
        updateCalculatedValues(gramsValue);
    }, [handleSetUnitAmount, updateCalculatedValues]);

    const handleTrackFood = useCallback(async () => {
        const userNutrition = {
            calories: calculatedValues.kcal,
            carbohydrate: calculatedValues.carbs,
            dataId: generateHash(),
            date: getCurrentTimestampISOString(),
            fat: calculatedValues.fat,
            grams: parseFloat(unitAmount),
            mealType: parseInt(mealType, 10),
            name: editableName || t('unknown_food'),
            protein: calculatedValues.protein,
            source: USER_METRICS_SOURCES.USER_INPUT,
            type: NUTRITION_TYPES.MEAL,
        } as UserNutritionInsertType;

        if (userNutritionId) {
            await updateUserNutrition(userNutritionId, userNutrition);
        } else {
            await addUserNutrition(userNutrition);

            const normalizedMacros = normalizeMacrosByGrams({
                carbs: userNutrition.carbohydrate,
                fat: userNutrition.fat,
                grams: userNutrition.grams,
                kcal: userNutrition.calories,
                protein: userNutrition.protein,
            });

            const updatedFood = {
                calories: normalizedMacros.kcal,
                name: userNutrition.name,
                productCode: food?.productCode,
                protein: normalizedMacros.protein,
                totalCarbohydrate: normalizedMacros.carbs,
                totalFat: normalizedMacros.fat,
                // TODO: add the rest of the fields
            };

            const existingFood = await getFoodByNameAndMacros(
                updatedFood.name,
                updatedFood.calories,
                updatedFood.protein,
                updatedFood.totalCarbohydrate,
                updatedFood.totalFat
            );

            let foodId = existingFood?.id;
            if (!existingFood) {
                foodId = await addFood(updatedFood);
            }

            if (foodId) {
                await updateRecentFood(foodId);
            }
        }

        onClose();
    }, [calculatedValues.kcal, calculatedValues.carbs, calculatedValues.fat, calculatedValues.protein, unitAmount, mealType, editableName, food?.productCode, t, userNutritionId, onClose]);

    useEffect(() => {
        if (food) {
            if (allowEditName) {
                setEditableName(food.productTitle);
            }

            if (food.estimatedGrams) {
                handleSetUnitAmount(food.estimatedGrams.toString());
            }
        }
    }, [allowEditName, food, handleSetUnitAmount]);

    return (
        <ThemedModal
            cancelText={t('cancel')}
            confirmText={isLoading ? undefined : (userNutritionId ? t('update') : t('track'))}
            onClose={onClose}
            onConfirm={handleTrackFood}
            title={allowEditName ? '' : editableName || food?.productTitle}
            visible={visible}
        >
            <ScrollView>
                {food && !isLoading && (
                    <View style={styles.foodTrackingForm}>
                        {allowEditName ? (
                            <CustomTextInput
                                label={t('name')}
                                onChangeText={setEditableName}
                                placeholder={t('enter_food_name')}
                                value={editableName}
                            />
                        ) : null}
                        <CustomTextInput
                            keyboardType="numeric"
                            label={t('grams')}
                            onChangeText={handleGramsChange}
                            placeholder={t('quantity')}
                            value={unitAmount}
                        />
                        <CustomPicker
                            items={[
                                ...Object.entries(MEAL_TYPE)
                                    .filter(([_, mealType]) => mealType !== MEAL_TYPE.UNKNOWN)
                                    .map(([mealTypeName, mealType]) => ({
                                        label: t(mealTypeName.toLowerCase()),
                                        value: mealType.toString(),
                                    })),
                            ]}
                            label={t('meal_type')}
                            onValueChange={(value) => setMealType(value)}
                            selectedValue={mealType}
                        />
                        <View style={styles.metricRow}>
                            <Text style={styles.metricDetail}>
                                {t('item_value', {
                                    item: t('calories'),
                                    value: safeToFixed(calculatedValues.kcal),
                                })}
                            </Text>
                            <Text style={styles.metricDetail}>
                                {t('item_value_unit', {
                                    item: t('carbs'),
                                    value: getDisplayFormattedWeight(calculatedValues.carbs || 0, GRAMS, isImperial).toString(),
                                    weightUnit: macroUnit,
                                })}
                            </Text>
                        </View>
                        <View style={styles.metricRow}>
                            <Text style={styles.metricDetail}>
                                {t('item_value_unit', {
                                    item: t('proteins'),
                                    value: getDisplayFormattedWeight(calculatedValues.protein || 0, GRAMS, isImperial).toString(),
                                    weightUnit: macroUnit,
                                })}
                            </Text>
                            <Text style={styles.metricDetail}>
                                {t('item_value_unit', {
                                    item: t('fats'),
                                    value: getDisplayFormattedWeight(calculatedValues.fat || 0, GRAMS, isImperial).toString(),
                                    weightUnit: macroUnit,
                                })}
                            </Text>
                        </View>
                    </View>
                )}
                {(showChart && (calculatedValues.protein || calculatedValues.carbs || calculatedValues.fat)) ? (
                    <View style={styles.pieChartContainer}>
                        <PieChart
                            data={[
                                { color: '#4CAF50', label: t('protein'), value: getDisplayFormattedWeight(calculatedValues.protein || 0, GRAMS, isImperial) },
                                { color: '#2196F3', label: t('carbohydrates'), value: getDisplayFormattedWeight(calculatedValues.carbs || 0, GRAMS, isImperial) },
                                { color: '#FF9800', label: t('fat'), value: getDisplayFormattedWeight(calculatedValues.fat || 0, GRAMS, isImperial) },
                            ]}
                            showLabels={false}
                            showLegend={false}
                            showShareImageButton={false}
                            size={180}
                        />
                    </View>
                ) : null}
            </ScrollView>
            {isLoading && <ActivityIndicator color={colors.primary} size="large" />}
        </ThemedModal>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    foodTrackingForm: {
        paddingBottom: 16,
    },
    metricDetail: {
        color: colors.onSurface,
        fontSize: 16,
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        marginBottom: 4,
        paddingHorizontal: 16,
    },
    pieChartContainer: {
        alignItems: 'center',
        backgroundColor: colors.background,
        flex: 1,
    },
});

export default FoodTrackingModal;
