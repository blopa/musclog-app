import CustomTextInput from '@/components/CustomTextInput';
import ThemedModal from '@/components/ThemedModal';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { MusclogApiFoodInfoType } from '@/utils/types';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';
import { useTheme, Text } from 'react-native-paper';

type FoodTrackingModalProps = {
    visible: boolean;
    onClose: () => void;
    food: MusclogApiFoodInfoType | null;
    themeColors: CustomThemeColorsType;
};

const FoodTrackingModal = ({ visible, onClose, food, themeColors }: FoodTrackingModalProps) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const [grams, setGrams] = useState('100');
    const [calculatedValues, setCalculatedValues] = useState({
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
    });

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

    return (
        <ThemedModal
            visible={visible}
            onClose={onClose}
            title={food?.productTitle || ''}
            confirmText={t('ok')}
            cancelText={t('cancel')}
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
