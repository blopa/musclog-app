import CustomPicker from '@/components/CustomPicker';
import { Screen } from '@/components/Screen';
import ThemedCard from '@/components/ThemedCard';
import { GRAMS, IMPERIAL_SYSTEM, OUNCES } from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { getFood } from '@/utils/database';
import { safeToFixed } from '@/utils/string';
import { getDisplayFormattedWeight } from '@/utils/unit';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp, useFocusEffect, useRoute } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { Appbar, Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';

type RouteParams = {
    id?: string;
};

const FoodDetails = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { unitSystem } = useUnit();
    const route = useRoute();

    const isImperial = unitSystem === IMPERIAL_SYSTEM;
    const macroUnit = isImperial ? OUNCES : GRAMS;

    const { id } = (route.params as RouteParams) || {};
    const [foodDetails, setFoodDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const mealCategories = [
        { label: t('breakfast'), value: 'breakfast' },
        { label: t('lunch'), value: 'lunch' },
        { label: t('dinner'), value: 'dinner' },
        { label: t('snacks'), value: 'snacks' },
    ];

    const [amount, setAmount] = useState('100');
    const [category, setCategory] = useState('');
    const [errors, setErrors] = useState<{ amount?: string; category?: string }>({});

    const fetchFoodDetails = useCallback(async () => {
        if (!id) {
            navigation.goBack();
            return;
        }

        try {
            setLoading(true);
            const food = await getFood(Number(id));
            if (food) {
                setFoodDetails(food);
            } else {
                setFoodDetails({
                    calories: 0,
                    carbs: 0,
                    fats: 0,
                    name: t('unknown_food'),
                    proteins: 0,
                    servingSize: 100,
                });
            }
        } catch (error) {
            console.error(t('failed_to_load_food_details'), error);
        } finally {
            setLoading(false);
        }
    }, [id, navigation, t]);

    useFocusEffect(
        useCallback(() => {
            fetchFoodDetails();
        }, [fetchFoodDetails])
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text>{t('loading_food_details')}</Text>
            </View>
        );
    }

    if (!foodDetails) {
        return (
            <View style={styles.container}>
                <Text>{t('no_food_details')}</Text>
            </View>
        );
    }

    const conversionFactor = isImperial ? 28.35 : 1;
    const multiplier = (parseFloat(amount) * conversionFactor) / foodDetails.servingSize;

    const calculatedNutrition = {
        calories: Math.round(foodDetails.calories * multiplier),
        carbs: Math.round(foodDetails.carbs * multiplier * 10) / 10,
        fats: Math.round(foodDetails.fats * multiplier * 10) / 10,
        proteins: Math.round(foodDetails.proteins * multiplier * 10) / 10,
    };

    const handleFoodDetails = () => {
        const newErrors: { amount?: string; category?: string } = {};

        if (!amount || parseFloat(amount) <= 0) {
            newErrors.amount = t('please_enter_valid_amount');
        }

        if (!category) {
            newErrors.category = t('please_select_category');
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        navigation.goBack();
    };

    return (
        <Screen style={styles.container}>
            <Appbar.Header mode="small" statusBarHeight={0} style={styles.appbarHeader}>
                <Appbar.Action
                    icon={() => (
                        <FontAwesome5 color={colors.onPrimary} name="arrow-left" size={24} />
                    )}
                    onPress={() => navigation.goBack()}
                />
                <Appbar.Content title={t('add_food')} titleStyle={styles.appbarTitle} />
            </Appbar.Header>
            <View style={styles.content}>
                <ThemedCard>
                    <View style={styles.cardContent}>
                        <Text style={styles.cardTitle}>{foodDetails.name}</Text>
                        <View style={styles.metricRow}>
                            <Text style={styles.metricDetail}>
                                {t('item_value', {
                                    item: t('calories'),
                                    value: safeToFixed(calculatedNutrition.calories),
                                })}
                            </Text>
                        </View>
                        <View style={styles.metricRow}>
                            <Text style={styles.metricDetail}>
                                {t('item_value_unit', {
                                    item: t('proteins'),
                                    value: getDisplayFormattedWeight(calculatedNutrition.proteins || 0, GRAMS, isImperial).toString(),
                                    weightUnit: macroUnit,
                                })}
                            </Text>
                        </View>
                        <View style={styles.metricRow}>
                            <Text style={styles.metricDetail}>
                                {t('item_value_unit', {
                                    item: t('carbs'),
                                    value: getDisplayFormattedWeight(calculatedNutrition.carbs || 0, GRAMS, isImperial).toString(),
                                    weightUnit: macroUnit,
                                })}
                            </Text>
                        </View>
                        <View style={styles.metricRow}>
                            <Text style={styles.metricDetail}>
                                {t('item_value_unit', {
                                    item: t('fats'),
                                    value: getDisplayFormattedWeight(calculatedNutrition.fats || 0, GRAMS, isImperial).toString(),
                                    weightUnit: macroUnit,
                                })}
                            </Text>
                        </View>
                    </View>
                </ThemedCard>
                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('amount')}</Text>
                        <TextInput
                            error={!!errors.amount}
                            keyboardType="numeric"
                            mode="outlined"
                            onChangeText={(text) => setAmount(text)}
                            style={styles.input}
                            value={amount}
                        />
                        {errors.amount && <HelperText type="error">{errors.amount}</HelperText>}
                    </View>

                    <View style={styles.inputGroup}>
                        <CustomPicker
                            items={mealCategories}
                            label={t('meal_category')}
                            onValueChange={(itemValue) => setCategory(itemValue)}
                            selectedValue={category}
                        />
                        {errors.category && <HelperText type="error">{errors.category}</HelperText>}
                    </View>

                    <Button mode="contained" onPress={handleFoodDetails} style={styles.addButton}>
                        {t('add_to_tracker')}
                    </Button>
                </View>
            </View>
        </Screen>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    addButton: {
        backgroundColor: colors.primary,
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
    cardContent: {
        padding: 16,
    },
    cardTitle: {
        color: colors.onSurface,
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    form: {
        flex: 1,
        padding: 16,
    },
    input: {
        backgroundColor: colors.surface,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        color: colors.onSurface,
        fontSize: 16,
        marginBottom: 4,
    },
    loadingContainer: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
    },
    metricDetail: {
        color: colors.onSurface,
        fontSize: 16,
        fontWeight: 'bold',
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 4,
    },
});

export default FoodDetails;
