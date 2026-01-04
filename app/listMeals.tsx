import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Button, Text, useTheme } from 'react-native-paper';

import CustomPicker from '@/components/CustomPicker';
import DatePickerModal from '@/components/DatePickerModal';
import FABWrapper from '@/components/FABWrapper';
import MealItem from '@/components/MealItem';
import { Screen } from '@/components/Screen';
import ThemedModal from '@/components/ThemedModal';
import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { MEAL_TYPE , NUTRITION_TYPES } from '@/constants/nutrition';
import { FAB_ICON_SIZE } from '@/constants/ui';
import { useSnackbar } from '@/storage/SnackbarProvider';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import {
    addUserNutrition,
    deleteMeal,
    getAllMealsWithFoodsByUserId,
    getLatestUser } from '@/utils/database';
import { generateHash } from '@/utils/string';
import { MealWithFoodsType } from '@/utils/types';

export default function ListMeals({ navigation }: { navigation: NavigationProp<any> }) {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { showSnackbar } = useSnackbar();

    const [meals, setMeals] = useState<MealWithFoodsType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [isTrackModalVisible, setIsTrackModalVisible] = useState(false);
    const [selectedMeal, setSelectedMeal] = useState<MealWithFoodsType | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedMealType, setSelectedMealType] = useState('0');
    const [datePickerVisible, setDatePickerVisible] = useState(false);

    const loadMeals = useCallback(async () => {
        try {
            setIsLoading(true);
            const user = await getLatestUser();
            if (!user || !user.id) {
                setIsLoading(false);
                return;
            }

            const loadedMeals = await getAllMealsWithFoodsByUserId(user.id);
            setMeals(loadedMeals);
        } catch (error) {
            console.error('Failed to load meals:', error);
            showSnackbar(t('failed_load_meals'));
        } finally {
            setIsLoading(false);
        }
    }, [t, showSnackbar]);

    const resetScreenData = useCallback(() => {
        setMeals([]);
        setIsDeleteModalVisible(false);
        setIsTrackModalVisible(false);
        setSelectedMeal(null);
        setSelectedDate(new Date());
        setSelectedMealType('0');
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadMeals();

            return () => {
                resetScreenData();
            };
        }, [loadMeals, resetScreenData])
    );

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                navigation.navigate('index');
                return true;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => {
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            };
        }, [navigation])
    );

    const handleDeleteMeal = useCallback(async () => {
        if (!selectedMeal) {
            return;
        }

        try {
            await deleteMeal(selectedMeal.id);
            showSnackbar(t('meal_deleted'));
            await loadMeals();
        } catch (error) {
            console.error('Failed to delete meal:', error);
            showSnackbar(t('failed_delete_meal'));
        } finally {
            setIsDeleteModalVisible(false);
            setSelectedMeal(null);
        }
    }, [selectedMeal, loadMeals, t, showSnackbar]);

    const handleTrackMeal = useCallback(async () => {
        if (!selectedMeal) {
            return;
        }

        try {
            const user = await getLatestUser();
            if (!user || !user.id) {
                showSnackbar(t('no_user_found'));
                return;
            }

            // Create UserNutrition entry for each food item in the meal
            for (const mealFood of selectedMeal.foods) {
                await addUserNutrition({
                    calories: mealFood.calculatedMacros.calories,
                    carbohydrate: mealFood.calculatedMacros.carbohydrate,
                    dataId: generateHash(),
                    date: selectedDate.toISOString(),
                    fat: mealFood.calculatedMacros.fat,
                    grams: mealFood.grams,
                    mealType: parseInt(selectedMealType, 10),
                    name: mealFood.food.name,
                    protein: mealFood.calculatedMacros.protein,
                    source: USER_METRICS_SOURCES.USER_INPUT,
                    type: NUTRITION_TYPES.MEAL,
                    userId: user.id,
                });
            }

            showSnackbar(t('meal_tracked'));
            setIsTrackModalVisible(false);
            setSelectedMeal(null);
            navigation.navigate('foodLog');
        } catch (error) {
            console.error('Failed to track meal:', error);
            showSnackbar(t('failed_track_meal'));
        }
    }, [selectedMeal, selectedDate, selectedMealType, navigation, t, showSnackbar]);

    const openDeleteModal = useCallback((meal: MealWithFoodsType) => {
        setSelectedMeal(meal);
        setIsDeleteModalVisible(true);
    }, []);

    const openTrackModal = useCallback((meal: MealWithFoodsType) => {
        setSelectedMeal(meal);
        setSelectedDate(new Date());
        setSelectedMealType('0');
        setIsTrackModalVisible(true);
    }, []);

    const handleEditMeal = useCallback((meal: MealWithFoodsType) => {
        navigation.navigate('createMeal', { id: meal.id });
    }, [navigation]);

    const fabActions = [
        {
            icon: () => <FontAwesome5 color={colors.primary} name="plus" size={FAB_ICON_SIZE} />,
            label: t('create_meal'),
            onPress: () => navigation.navigate('createMeal'),
            style: { backgroundColor: colors.surface },
        },
    ];

    return (
        <FABWrapper actions={fabActions} icon="plus" visible>
            <Screen style={styles.container}>
                <Appbar.Header mode="small" statusBarHeight={0} style={styles.appbarHeader}>
                    <Appbar.Content title={t('track_meals')} titleStyle={styles.appbarTitle} />
                </Appbar.Header>
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator color={colors.primary} size="large" />
                    </View>
                ) : meals.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                            {t('no_meals_saved')}
                        </Text>
                        <Button
                            mode="contained"
                            onPress={() => navigation.navigate('createMeal')}
                            style={styles.createButton}
                        >
                            {t('create_meal')}
                        </Button>
                    </View>
                ) : (
                    <FlashList
                        contentContainerStyle={styles.listContent}
                        data={meals}
                        estimatedItemSize={150}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={({ item }) => (
                            <MealItem
                                meal={item}
                                onDelete={openDeleteModal}
                                onEdit={handleEditMeal}
                                onTrack={openTrackModal}
                            />
                        )}
                    />
                )}
                <ThemedModal
                    cancelText={t('cancel')}
                    confirmText={t('delete')}
                    onClose={() => {
                        setIsDeleteModalVisible(false);
                        setSelectedMeal(null);
                    }}
                    onConfirm={handleDeleteMeal}
                    title={selectedMeal ? t('delete_meal', { name: selectedMeal.name }) : t('delete_confirmation_generic')}
                    visible={isDeleteModalVisible}
                />
                <ThemedModal
                    cancelText={t('cancel')}
                    confirmText={t('track')}
                    onClose={() => {
                        setIsTrackModalVisible(false);
                        setSelectedMeal(null);
                    }}
                    onConfirm={handleTrackMeal}
                    title={selectedMeal ? t('track_meal', { name: selectedMeal.name }) : t('track_meal')}
                    visible={isTrackModalVisible}
                >
                    <View style={styles.trackModalContent}>
                        <Button
                            onPress={() => setDatePickerVisible(true)}
                            style={styles.datePickerButton}
                        >
                            {selectedDate.toLocaleDateString()}
                        </Button>
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
                            onValueChange={(value) => setSelectedMealType(value)}
                            selectedValue={selectedMealType}
                        />
                    </View>
                </ThemedModal>
                <DatePickerModal
                    onChangeDate={setSelectedDate}
                    onClose={() => setDatePickerVisible(false)}
                    selectedDate={selectedDate}
                    visible={datePickerVisible}
                />
            </Screen>
        </FABWrapper>
    );
}

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
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
    createButton: {
        marginTop: 16,
    },
    datePickerButton: {
        backgroundColor: colors.surface,
        borderColor: colors.onSurface,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 16,
        paddingLeft: 10,
        width: '100%',
    },
    emptyContainer: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        padding: 32,
    },
    emptyText: {
        color: colors.onSurface,
        fontSize: 16,
        marginBottom: 16,
        textAlign: 'center',
    },
    listContent: {
        padding: 16,
    },
    loadingContainer: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
    },
    trackModalContent: {
        padding: 16,
    },
});

