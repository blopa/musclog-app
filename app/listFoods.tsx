import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Button, Text, useTheme } from 'react-native-paper';

import AnimatedSearchBar from '@/components/AnimatedSearchBar';
import FABWrapper from '@/components/FABWrapper';
import { Screen } from '@/components/Screen';
import ThemedCard from '@/components/ThemedCard';
import ThemedModal from '@/components/ThemedModal';
import { GRAMS, IMPERIAL_SYSTEM, METRIC_SYSTEM, OUNCES } from '@/constants/storage';
import { FAB_ICON_SIZE, ICON_SIZE } from '@/constants/ui';
import useUnit from '@/hooks/useUnit';
import { useSnackbar } from '@/storage/SnackbarProvider';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { deleteFood, getAllFoods } from '@/utils/database';
import { safeToFixed } from '@/utils/string';
import { FoodReturnType } from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';

export default function ListFoods({ navigation }: { navigation: NavigationProp<any> }) {
    const { t } = useTranslation();
    const [foods, setFoods] = useState<FoodReturnType[]>([]);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [foodToDelete, setFoodToDelete] = useState<null | number>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { showSnackbar } = useSnackbar();
    const { unitSystem } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;
    const macroUnit = unitSystem === METRIC_SYSTEM ? GRAMS : OUNCES;

    const loadFoods = useCallback(async () => {
        try {
            setIsLoading(true);
            const allFoods = await getAllFoods();
            setFoods(allFoods);
        } catch (error) {
            console.error('Failed to load foods:', error);
            showSnackbar(t('failed_to_load_foods'), t('ok'), () => {});
        } finally {
            setIsLoading(false);
        }
    }, [showSnackbar, t]);

    const resetScreenData = useCallback(() => {
        setSearchQuery('');
        setFoods([]);
        setIsDeleteModalVisible(false);
        setFoodToDelete(null);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadFoods();

            return () => {
                resetScreenData();
            };
        }, [loadFoods, resetScreenData])
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

    const handleDeleteFood = useCallback((id: number) => {
        setFoodToDelete(id);
        setIsDeleteModalVisible(true);
    }, []);

    const handleDeleteConfirmation = useCallback(async () => {
        if (foodToDelete) {
            try {
                await deleteFood(foodToDelete);
                const updatedFoods = foods.filter((food) => food.id !== foodToDelete);
                setFoods(updatedFoods);
                setIsDeleteModalVisible(false);
                setFoodToDelete(null);
                showSnackbar(t('food_deleted'), t('ok'), () => {});
            } catch (error) {
                console.error('Failed to delete food:', error);
                showSnackbar(t('failed_to_delete_food'), t('ok'), () => {});
            }
        }
    }, [foodToDelete, foods, showSnackbar, t]);

    const handleDeleteCancel = useCallback(() => {
        setIsDeleteModalVisible(false);
        setFoodToDelete(null);
    }, []);

    const filteredFoods = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return foods.filter((food) =>
            food.name.toLowerCase().includes(query)
            || (food.productCode && food.productCode.toLowerCase().includes(query))
        );
    }, [foods, searchQuery]);

    const fabActions = useMemo(() => [{
        icon: () => <FontAwesome5 color={colors.primary} name="plus" size={FAB_ICON_SIZE} />,
        label: t('add_food'),
        onPress: () => navigation.navigate('createFood'),
        style: { backgroundColor: colors.surface },
    }], [colors, navigation, t]);

    return (
        <FABWrapper actions={fabActions} icon="plus" visible>
            <Screen style={styles.container}>
                <Appbar.Header mode="small" statusBarHeight={0} style={styles.appbarHeader}>
                    <Appbar.Content title={t('manage_foods')} titleStyle={styles.appbarTitle} />
                </Appbar.Header>
                <AnimatedSearchBar
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                />
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator color={colors.primary} size="large" />
                    </View>
                ) : filteredFoods.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                            {searchQuery ? t('no_foods_found') : t('no_foods_saved')}
                        </Text>
                        {!searchQuery && (
                            <Button
                                mode="contained"
                                onPress={() => navigation.navigate('createFood')}
                                style={styles.createButton}
                            >
                                {t('add_food')}
                            </Button>
                        )}
                    </View>
                ) : (
                    <FlashList
                        contentContainerStyle={styles.listContent}
                        data={filteredFoods}
                        estimatedItemSize={150}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={({ item: food }) => (
                            <ThemedCard style={styles.card}>
                                <View style={styles.cardContent}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.cardTitle}>{food.name}</Text>
                                        {food.productCode && (
                                            <Text style={styles.productCode}>
                                                {t('barcode')}: {food.productCode}
                                            </Text>
                                        )}
                                        {food.brand && (
                                            <Text style={styles.brand}>{food.brand}</Text>
                                        )}
                                        <View style={styles.macroRow}>
                                            <Text style={styles.macroText}>
                                                {t('item_value', {
                                                    item: t('calories'),
                                                    value: safeToFixed(food.calories),
                                                })}
                                            </Text>
                                            <Text style={styles.macroText}>
                                                {t('item_value_unit', {
                                                    item: t('proteins'),
                                                    value: getDisplayFormattedWeight(food.protein || 0, GRAMS, isImperial).toString(),
                                                    weightUnit: macroUnit,
                                                })}
                                            </Text>
                                        </View>
                                        <View style={styles.macroRow}>
                                            <Text style={styles.macroText}>
                                                {t('item_value_unit', {
                                                    item: t('carbs'),
                                                    value: getDisplayFormattedWeight(food.totalCarbohydrate || 0, GRAMS, isImperial).toString(),
                                                    weightUnit: macroUnit,
                                                })}
                                            </Text>
                                            <Text style={styles.macroText}>
                                                {t('item_value_unit', {
                                                    item: t('fats'),
                                                    value: getDisplayFormattedWeight(food.totalFat || 0, GRAMS, isImperial).toString(),
                                                    weightUnit: macroUnit,
                                                })}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.cardActions}>
                                        <FontAwesome5
                                            color={colors.primary}
                                            name="edit"
                                            onPress={() => navigation.navigate('createFood', { id: food.id })}
                                            size={ICON_SIZE}
                                            style={styles.iconButton}
                                        />
                                        <FontAwesome5
                                            color={colors.error}
                                            name="trash"
                                            onPress={() => handleDeleteFood(food.id)}
                                            size={ICON_SIZE}
                                            style={styles.iconButton}
                                        />
                                    </View>
                                </View>
                            </ThemedCard>
                        )}
                    />
                )}
                <ThemedModal
                    cancelText={t('cancel')}
                    confirmText={t('delete')}
                    onClose={handleDeleteCancel}
                    onConfirm={handleDeleteConfirmation}
                    title={t('delete_food_confirmation', {
                        name: foods.find((food) => food.id === foodToDelete)?.name || '',
                    })}
                    visible={isDeleteModalVisible}
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
        fontSize: Platform.OS === 'web' ? 20 : 26,
    },
    brand: {
        color: colors.onSurfaceVariant,
        fontSize: 12,
        marginBottom: 4,
    },
    card: {
        marginBottom: 16,
    },
    cardActions: {
        alignItems: 'center',
        flexDirection: 'row',
        marginLeft: 16,
    },
    cardContent: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
    },
    cardHeader: {
        flex: 1,
    },
    cardTitle: {
        color: colors.onSurface,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    createButton: {
        marginTop: 16,
    },
    emptyContainer: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    emptyText: {
        color: colors.onSurfaceVariant,
        fontSize: 18,
        textAlign: 'center',
    },
    iconButton: {
        marginLeft: 12,
    },
    listContent: {
        padding: 16,
    },
    loadingContainer: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
    },
    macroRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    macroText: {
        color: colors.onSurfaceVariant,
        fontSize: 12,
    },
    productCode: {
        color: colors.onSurfaceVariant,
        fontSize: 12,
        marginBottom: 4,
    },
});

