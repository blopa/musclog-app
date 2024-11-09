import { GRAMS, OUNCES, IMPERIAL_SYSTEM, METRIC_SYSTEM } from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { CustomThemeType } from '@/utils/colors';
import { FontAwesome5 } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { NavigationProp } from '@react-navigation/native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Platform } from 'react-native';
import {
    Appbar,
    Button,
    TextInput,
    Card,
    Text,
    useTheme,
    HelperText,
} from 'react-native-paper';

const FoodDetails = ({
    navigation,
    route,
}: {
    navigation: NavigationProp<any>;
    route: any;
}) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { unitSystem } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;
    const macroUnit = unitSystem === METRIC_SYSTEM ? GRAMS : OUNCES;

    // This would typically come from the previous screen or API
    const selectedFood = route.params?.food || {
        name: 'Chicken Breast',
        calories: 165,
        proteins: 31,
        carbs: 0,
        fats: 3.6,
        servingSize: 100,
    };

    const mealCategories = [
        t('breakfast'),
        t('lunch'),
        t('dinner'),
        t('snacks'),
    ];
    const units = [GRAMS, OUNCES];

    const [amount, setAmount] = useState('100');
    const [unit, setUnit] = useState(macroUnit);
    const [category, setCategory] = useState('');
    const [errors, setErrors] = useState<{ amount?: string; category?: string }>({});

    const conversionFactor = unit === OUNCES ? 28.35 : 1; // 1 oz = 28.35 grams
    const multiplier =
        (parseFloat(amount) * conversionFactor) / selectedFood.servingSize;

    const calculatedNutrition = {
        calories: Math.round(selectedFood.calories * multiplier),
        proteins: Math.round(selectedFood.proteins * multiplier * 10) / 10,
        carbs: Math.round(selectedFood.carbs * multiplier * 10) / 10,
        fats: Math.round(selectedFood.fats * multiplier * 10) / 10,
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

        // Here you would typically dispatch an action or call a function to add the food to the tracker
        console.log('Adding food:', {
            ...selectedFood,
            ...calculatedNutrition,
            amount: parseFloat(amount),
            unit,
            category,
        });

        // Then navigate back or show a success message
        navigation.goBack();
    };

    return (
        <View style={styles.container}>
            <Appbar.Header
                mode="small"
                statusBarHeight={0}
                style={styles.appbarHeader}
            >
                <Appbar.Action
                    icon={() => (
                        <FontAwesome5 name="arrow-left" size={24} color={colors.onPrimary} />
                    )}
                    onPress={() => navigation.goBack()}
                />
                <Appbar.Content title={t('add_food')} titleStyle={styles.appbarTitle} />
            </Appbar.Header>
            <View style={styles.content}>
                <Card style={styles.card}>
                    <Card.Title title={selectedFood.name} titleStyle={styles.cardTitle} />
                    <Card.Content>
                        <View style={styles.nutritionRow}>
                            <Text style={styles.nutritionLabel}>{t('calories')}</Text>
                            <Text style={styles.nutritionValue}>
                                {calculatedNutrition.calories}
                            </Text>
                        </View>
                        <View style={styles.nutritionRow}>
                            <Text style={styles.nutritionLabel}>{t('proteins')}</Text>
                            <Text style={styles.nutritionValue}>
                                {calculatedNutrition.proteins}g
                            </Text>
                        </View>
                        <View style={styles.nutritionRow}>
                            <Text style={styles.nutritionLabel}>{t('carbs')}</Text>
                            <Text style={styles.nutritionValue}>
                                {calculatedNutrition.carbs}g
                            </Text>
                        </View>
                        <View style={styles.nutritionRow}>
                            <Text style={styles.nutritionLabel}>{t('fats')}</Text>
                            <Text style={styles.nutritionValue}>
                                {calculatedNutrition.fats}g
                            </Text>
                        </View>
                    </Card.Content>
                </Card>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('amount')}</Text>
                        <TextInput
                            mode="outlined"
                            value={amount}
                            onChangeText={(text) => setAmount(text)}
                            keyboardType="numeric"
                            style={styles.input}
                            error={!!errors.amount}
                        />
                        {errors.amount && (
                            <HelperText type="error">{errors.amount}</HelperText>
                        )}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('unit')}</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={unit}
                                onValueChange={(itemValue) => setUnit(itemValue)}
                                style={styles.picker}
                            >
                                {units.map((u) => (
                                    <Picker.Item key={u} label={u} value={u} />
                                ))}
                            </Picker>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('meal_category')}</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={category}
                                onValueChange={(itemValue) => setCategory(itemValue)}
                                style={styles.picker}
                            >
                                <Picker.Item label={t('select_category')} value="" />
                                {mealCategories.map((cat) => (
                                    <Picker.Item key={cat} label={cat} value={cat} />
                                ))}
                            </Picker>
                        </View>
                        {errors.category && (
                            <HelperText type="error">{errors.category}</HelperText>
                        )}
                    </View>

                    <Button mode="contained" onPress={handleFoodDetails} style={styles.addButton}>
                        {t('add_to_tracker')}
                    </Button>
                </View>
            </View>
        </View>
    );
};

const makeStyles = (colors: CustomThemeType['colors'], dark: boolean) =>
    StyleSheet.create({
        addButton: {
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
        card: {
            marginBottom: 16,
        },
        cardTitle: {
            color: colors.onSurface,
            fontSize: 24,
            fontWeight: 'bold',
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
        nutritionLabel: {
            color: colors.onSurface,
            fontSize: 16,
        },
        nutritionRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginVertical: 4,
        },
        nutritionValue: {
            color: colors.onSurface,
            fontSize: 16,
            fontWeight: 'bold',
        },
        picker: {
            height: 50,
            width: '100%',
        },
        pickerContainer: {
            backgroundColor: colors.surface,
            borderColor: colors.shadow,
            borderRadius: 4,
            borderWidth: 1,
        },
    });

export default FoodDetails;
