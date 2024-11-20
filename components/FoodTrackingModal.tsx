import CustomPicker from '@/components/CustomPicker'; // Import CustomPicker
import CustomTextInput from '@/components/CustomTextInput';
import ThemedModal from '@/components/ThemedModal';
import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { MEAL_TYPE, NUTRITION_TYPES } from '@/constants/nutrition';
import { GRAMS, IMPERIAL_SYSTEM } from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { addUserNutrition, updateUserNutrition } from '@/utils/database';
import { generateHash, safeToFixed } from '@/utils/string';
import { UserNutritionInsertType } from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';
import { useTheme, Text, ActivityIndicator } from 'react-native-paper';

export type FoodTrackingType = {
    productTitle: string;
    fat: number;
    carbs: number;
    protein: number;
    kcal: number;
    grams?: number;
};

type FoodTrackingModalProps = {
    visible: boolean;
    onClose: () => void;
    food: FoodTrackingType | null;
    userNutritionId?: number | null;
    isLoading?: boolean;
};

const FoodTrackingModal = ({
    visible,
    onClose,
    food,
    userNutritionId,
    isLoading = false,
}: FoodTrackingModalProps) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const [unitAmount, setUnitAmount] = useState('100');
    const [mealType, setMealType] = useState('');

    const { unitSystem } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    const [calculatedValues, setCalculatedValues] = useState({
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
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
            const factor = gramsValue / 100;
            setCalculatedValues({
                kcal: factor * food.kcal,
                protein: factor * food.protein,
                carbs: factor * food.carbs,
                fat: factor * food.fat,
            });
        }
    }, [food]);

    useEffect(() => {
        if (food) {
            updateCalculatedValues(100);
        }
    }, [food, updateCalculatedValues]);

    const handleGramsChange = (text: string) => {
        const formattedText = text.replace(/\D/g, '');
        handleSetUnitAmount(formattedText);

        const gramsValue = parseFloat(formattedText) || 0;
        updateCalculatedValues(gramsValue);
    };

    const handleTrackFood = useCallback(async () => {
        const userNutrition = {
            date: new Date().toISOString(),
            calories: calculatedValues.kcal,
            protein: calculatedValues.protein,
            carbohydrate: calculatedValues.carbs,
            fat: calculatedValues.fat,
            dataId: generateHash(),
            name: food?.productTitle || t('unknown_food'),
            source: USER_METRICS_SOURCES.USER_INPUT,
            type: NUTRITION_TYPES.MEAL,
            mealType,
            grams: parseFloat(unitAmount),
        } as UserNutritionInsertType;

        if (userNutritionId) {
            await updateUserNutrition(userNutritionId, userNutrition);
        } else {
            await addUserNutrition(userNutrition);
        }
        onClose();
    }, [calculatedValues.kcal, calculatedValues.protein, calculatedValues.carbs, calculatedValues.fat, food?.productTitle, t, mealType, unitAmount, userNutritionId, onClose]);

    return (
        <ThemedModal
            visible={visible}
            onClose={onClose}
            title={food?.productTitle || ''}
            confirmText={userNutritionId ? t('update') : t('track')}
            cancelText={t('cancel')}
            onConfirm={handleTrackFood}
        >
            {food && !isLoading && (
                <View style={styles.foodTrackingForm}>
                    <CustomTextInput
                        keyboardType="numeric"
                        label={t('grams')}
                        value={unitAmount}
                        onChangeText={handleGramsChange}
                        placeholder={t('quantity')}
                    />
                    <CustomPicker
                        items={[
                            { label: t('none'), value: '' },
                            ...Object.entries(MEAL_TYPE)
                                .map(([mealTypeName, mealType]) => ({
                                    label: t(mealTypeName.toLowerCase()),
                                    value: mealType.toString(),
                                })),
                        ]}
                        label={t('meal_type')}
                        selectedValue={mealType}
                        onValueChange={(value) => setMealType(value)}
                    />
                    <Text>
                        {t('item_value', {
                            item: 'kcal',
                            value: safeToFixed(calculatedValues.kcal),
                        })}
                    </Text>
                    <Text>
                        {t('item_value', {
                            item: t('protein'),
                            value: getDisplayFormattedWeight(calculatedValues.protein || 0, GRAMS, isImperial).toString(),
                        })}
                    </Text>
                    <Text>
                        {t('item_value', {
                            item: t('carbs'),
                            value: getDisplayFormattedWeight(calculatedValues.carbs || 0, GRAMS, isImperial).toString(),
                        })}
                    </Text>
                    <Text>
                        {t('item_value', {
                            item: t('fats'),
                            value: getDisplayFormattedWeight(calculatedValues.fat || 0, GRAMS, isImperial).toString(),
                        })}
                    </Text>
                </View>
            )}
            {isLoading && <ActivityIndicator color={colors.primary} size="large" />}
        </ThemedModal>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    foodTrackingForm: {
        paddingBottom: 16,
    },
});

export default FoodTrackingModal;
