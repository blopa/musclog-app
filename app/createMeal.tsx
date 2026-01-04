import { NavigationProp, useRoute } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Text, useTheme } from 'react-native-paper';

import CompletionModal from '@/components/CompletionModal';
import CustomTextInput from '@/components/CustomTextInput';
import MealFoodItem from '@/components/MealFoodItem';
import MealMacroSummary from '@/components/MealMacroSummary';
import { Screen } from '@/components/Screen';
import { GRAMS, IMPERIAL_SYSTEM, METRIC_SYSTEM, OUNCES } from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { useSnackbar } from '@/storage/SnackbarProvider';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { calculateMealFoodMacros } from '@/utils/data';
import {
    addMeal,
    addMealFood,
    deleteMealFoodsByMealId,
    getFood,
    getLatestUser,
    getMealWithFoods,
    updateMeal,
} from '@/utils/database';
import { formatFloatNumericInputText } from '@/utils/string';
import { FoodReturnType } from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';

type MealFoodLocalType = {
    food: FoodReturnType;
    grams: number;
    mealFoodId?: number;
};

type RouteParams = {
    id?: string;
};

export default function CreateMeal({ navigation }: { navigation: NavigationProp<any> }) {
    const route = useRoute();
    const { id } = (route.params as RouteParams) || {};
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { showSnackbar } = useSnackbar();

    const [mealName, setMealName] = useState('');
    const [mealFoods, setMealFoods] = useState<MealFoodLocalType[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingMealFood, setEditingMealFood] = useState<MealFoodLocalType | null>(null);
    const [editingGrams, setEditingGrams] = useState('');

    const { unitSystem } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;
    const macroUnit = unitSystem === METRIC_SYSTEM ? GRAMS : OUNCES;

    const calculateTotalMacros = useCallback(() => {
        return mealFoods.reduce(
            (acc, mealFood) => {
                const macros = calculateMealFoodMacros(mealFood.food, mealFood.grams);
                return {
                    calories: acc.calories + macros.calories,
                    carbohydrate: acc.carbohydrate + macros.carbohydrate,
                    fat: acc.fat + macros.fat,
                    protein: acc.protein + macros.protein,
                };
            },
            { calories: 0, carbohydrate: 0, fat: 0, protein: 0 }
        );
    }, [mealFoods]);

    const totalMacros = calculateTotalMacros();

    const loadMeal = useCallback(async () => {
        if (!id) {
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            const meal = await getMealWithFoods(Number(id));
            if (meal) {
                setMealName(meal.name);
                setMealFoods(
                    meal.foods.map((mf) => ({
                        food: mf.food,
                        grams: mf.grams,
                        mealFoodId: mf.id,
                    }))
                );
            }
        } catch (error) {
            console.error('Failed to load meal:', error);
            showSnackbar(t('failed_load_meal'));
        } finally {
            setIsLoading(false);
        }
    }, [id, t, showSnackbar]);

    useFocusEffect(
        useCallback(() => {
            loadMeal();

            return () => {
                setMealName('');
                setMealFoods([]);
                setIsModalVisible(false);
                setEditingMealFood(null);
                setEditingGrams('');
            };
        }, [loadMeal])
    );

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                navigation.goBack();
                return true;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => {
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            };
        }, [navigation])
    );

    const handleAddFood = useCallback(() => {
        navigation.navigate('foodSearch', {
            returnFoodId: true,
        });
    }, [navigation]);

    // Listen for food selection when returning from foodSearch
    useFocusEffect(
        useCallback(() => {
            const checkForSelectedFood = async () => {
                const routeParams = route.params as { selectedFoodId?: number };
                if (routeParams?.selectedFoodId) {
                    const food = await getFood(routeParams.selectedFoodId);
                    if (food && !mealFoods.some((mf) => mf.food.id === food.id)) {
                        setMealFoods((prev) => [
                            ...prev,
                            {
                                food,
                                grams: 100, // Default to 100g
                            },
                        ]);
                    }
                    // Clear the param to avoid re-adding
                    navigation.setParams({ selectedFoodId: undefined });
                }
            };
            checkForSelectedFood();
        }, [navigation, route.params, mealFoods])
    );

    const handleEditMealFoodGrams = useCallback((mealFood: MealFoodLocalType) => {
        setEditingMealFood(mealFood);
        setEditingGrams(getDisplayFormattedWeight(mealFood.grams, GRAMS, isImperial).toString());
    }, [isImperial]);

    const handleSaveGrams = useCallback(() => {
        if (!editingMealFood) {
            return;
        }

        const gramsValue = parseFloat(editingGrams.replace(/\D/g, '')) || 0;
        // Convert back to grams if imperial
        const gramsInMetric = isImperial ? gramsValue * 28.3495 : gramsValue;

        setMealFoods((prev) =>
            prev.map((mf) =>
                (mf === editingMealFood
                    ? { ...mf, grams: gramsInMetric }
                    : mf)
            )
        );

        setEditingMealFood(null);
        setEditingGrams('');
    }, [editingMealFood, editingGrams, isImperial]);

    const handleRemoveMealFood = useCallback((mealFood: MealFoodLocalType) => {
        setMealFoods((prev) => prev.filter((mf) => mf !== mealFood));
    }, []);

    const handleSaveMeal = useCallback(async () => {
        if (!mealName.trim()) {
            Alert.alert(t('error'), t('meal_name_required'));
            return;
        }

        if (mealFoods.length === 0) {
            Alert.alert(t('error'), t('meal_must_have_foods'));
            return;
        }

        try {
            setIsSaving(true);
            const user = await getLatestUser();
            if (!user || !user.id) {
                showSnackbar(t('no_user_found'));
                return;
            }

            if (id) {
                // Update existing meal
                await updateMeal(Number(id), {
                    name: mealName.trim(),
                    userId: user.id,
                });

                // Delete old meal foods
                await deleteMealFoodsByMealId(Number(id));

                // Add new meal foods
                for (const mealFood of mealFoods) {
                    await addMealFood({
                        foodId: mealFood.food.id,
                        grams: mealFood.grams,
                        mealId: Number(id),
                    });
                }
            } else {
                // Create new meal
                const mealId = await addMeal({
                    name: mealName.trim(),
                    userId: user.id,
                });

                // Add meal foods
                for (const mealFood of mealFoods) {
                    await addMealFood({
                        foodId: mealFood.food.id,
                        grams: mealFood.grams,
                        mealId,
                    });
                }
            }

            setIsModalVisible(true);
        } catch (error) {
            console.error('Failed to save meal:', error);
            showSnackbar(t('failed_save_meal'));
        } finally {
            setIsSaving(false);
        }
    }, [mealName, mealFoods, id, t, showSnackbar]);

    const handleCloseModal = useCallback(() => {
        setIsModalVisible(false);
        navigation.navigate('listMeals');
    }, [navigation]);

    return (
        <Screen style={styles.container}>
            <CompletionModal
                buttonText={t('ok')}
                isModalVisible={isModalVisible}
                onClose={handleCloseModal}
                title={t('meal_saved')}
            />
            <Appbar.Header mode="small" statusBarHeight={0} style={styles.appbarHeader}>
                <Appbar.Content
                    title={id ? t('edit_meal') : t('create_meal')}
                    titleStyle={styles.appbarTitle}
                />
                <Button
                    mode="outlined"
                    onPress={() => navigation.goBack()}
                    textColor={colors.onPrimary}
                >
                    {t('cancel')}
                </Button>
            </Appbar.Header>
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <Text>{t('loading')}</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <CustomTextInput
                        label={t('meal_name')}
                        onChangeText={setMealName}
                        placeholder={t('enter_meal_name')}
                        value={mealName}
                    />
                    <Button
                        mode="outlined"
                        onPress={handleAddFood}
                        style={styles.addFoodButton}
                    >
                        {t('add_food_to_meal')}
                    </Button>
                    {mealFoods.length > 0 && (
                        <>
                            <MealMacroSummary macros={totalMacros} />
                            {mealFoods.map((mealFood, index) => (
                                <View key={index}>
                                    {editingMealFood === mealFood ? (
                                        <View style={styles.editGramsContainer}>
                                            <CustomTextInput
                                                keyboardType="numeric"
                                                label={t('grams')}
                                                onChangeText={(text) => {
                                                    const formatted = formatFloatNumericInputText(text);
                                                    if (formatted) {
                                                        setEditingGrams(formatted);
                                                    }
                                                }}
                                                placeholder={t('quantity')}
                                                value={editingGrams}
                                            />
                                            <View style={styles.editGramsActions}>
                                                <Button
                                                    onPress={() => {
                                                        setEditingMealFood(null);
                                                        setEditingGrams('');
                                                    }}>
                                                    {t('cancel')}
                                                </Button>
                                                <Button mode="contained" onPress={handleSaveGrams}>
                                                    {t('save')}
                                                </Button>
                                            </View>
                                        </View>
                                    ) : (
                                        <MealFoodItem
                                            mealFood={{
                                                calculatedMacros: calculateMealFoodMacros(mealFood.food, mealFood.grams),
                                                food: mealFood.food,
                                                foodId: mealFood.food.id,
                                                grams: mealFood.grams,
                                                id: mealFood.mealFoodId || 0,
                                                mealId: Number(id) || 0,
                                            }}
                                            onEdit={handleEditMealFoodGrams}
                                            onRemove={(mealFoodId) => {
                                                const mealFoodToRemove = mealFoods.find((mf) => (mf.mealFoodId && mf.mealFoodId === mealFoodId) || (!mf.mealFoodId && mf.food.id === mealFoodId));
                                                if (mealFoodToRemove) {
                                                    handleRemoveMealFood(mealFoodToRemove);
                                                }
                                            }}
                                        />
                                    )}
                                </View>
                            ))}
                        </>
                    )}
                </ScrollView>
            )}
            <View style={styles.footer}>
                <Button
                    disabled={isSaving || mealFoods.length === 0 || !mealName.trim()}
                    mode="contained"
                    onPress={handleSaveMeal}
                    style={styles.saveButton}
                >
                    {t('save')}
                </Button>
            </View>
        </Screen>
    );
}

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    addFoodButton: {
        marginBottom: 16,
        marginTop: 16,
    },
    appbarHeader: {
        backgroundColor: colors.primary,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    appbarTitle: {
        color: colors.onPrimary,
        fontSize: 20,
    },
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    content: {
        padding: 16,
    },
    editGramsActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 8,
    },
    editGramsContainer: {
        backgroundColor: colors.surfaceVariant,
        borderRadius: 8,
        marginBottom: 16,
        padding: 16,
    },
    footer: {
        alignItems: 'center',
        borderTopColor: colors.shadow,
        borderTopWidth: 1,
        padding: 16,
    },
    loadingContainer: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
    },
    saveButton: {
        marginVertical: 10,
    },
});

