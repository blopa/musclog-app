import CustomPicker from '@/components/CustomPicker'; // Import CustomPicker
import CustomTextInput from '@/components/CustomTextInput';
import ThemedModal from '@/components/ThemedModal';
import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { MEAL_TYPE, NUTRITION_TYPES } from '@/constants/nutrition';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { addUserNutrition, updateUserNutrition } from '@/utils/database';
import { generateHash } from '@/utils/string';
import { UserNutritionInsertType } from '@/utils/types';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';
import { useTheme, Text } from 'react-native-paper';

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
};

const FoodTrackingModal = ({
    visible,
    onClose,
    food,
    userNutritionId,
}: FoodTrackingModalProps) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const [grams, setGrams] = useState('100');
    const [mealType, setMealType] = useState('');
    const [calculatedValues, setCalculatedValues] = useState({
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
    });

    useEffect(() => {
        if (userNutritionId && food?.grams) {
            setGrams(food.grams.toString());
        }
    }, [food?.grams, userNutritionId]);

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
        setGrams(formattedText);

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
            grams: parseFloat(grams),
        } as UserNutritionInsertType;

        if (userNutritionId) {
            await updateUserNutrition(userNutritionId, userNutrition);
        } else {
            await addUserNutrition(userNutrition);
        }
        onClose();
    }, [calculatedValues.kcal, calculatedValues.protein, calculatedValues.carbs, calculatedValues.fat, food?.productTitle, t, mealType, grams, userNutritionId, onClose]);

    return (
        <ThemedModal
            visible={visible}
            onClose={onClose}
            title={food?.productTitle || ''}
            confirmText={userNutritionId ? t('update') : t('track')}
            cancelText={t('cancel')}
            onConfirm={handleTrackFood}
        >
            {food && (
                <View style={styles.foodTrackingForm}>
                    <CustomTextInput
                        keyboardType="numeric"
                        label={t('grams')}
                        value={grams}
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
                                }))
                        ]}
                        label={t('meal_type')}
                        selectedValue={mealType}
                        onValueChange={(value) => setMealType(value)}
                    />
                    <Text>{t('calories')}: {calculatedValues.kcal.toFixed(2)} kcal</Text>
                    <Text>{t('proteins')}: {calculatedValues.protein.toFixed(2)} g</Text>
                    <Text>{t('carbs')}: {calculatedValues.carbs.toFixed(2)} g</Text>
                    <Text>{t('fats')}: {calculatedValues.fat.toFixed(2)} g</Text>
                </View>
            )}
        </ThemedModal>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    foodTrackingForm: {
        paddingBottom: 16,
    },
});

export default FoodTrackingModal;
