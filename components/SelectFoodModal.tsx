import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput, useTheme } from 'react-native-paper';

import ThemedCard from '@/components/ThemedCard';
import { GRAMS, IMPERIAL_SYSTEM, METRIC_SYSTEM, OUNCES } from '@/constants/storage';
import { ICON_SIZE } from '@/constants/ui';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { getAllFoods } from '@/utils/database';
import { safeToFixed } from '@/utils/string';
import { FoodReturnType } from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';

interface SelectFoodModalProps {
    onClose: () => void;
    onFoodSelected: (foodId: number) => void;
    visible: boolean;
}

const SelectFoodModal = ({ onClose, onFoodSelected, visible }: SelectFoodModalProps) => {
    const navigation = useNavigation<NavigationProp<any>>();
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [foods, setFoods] = useState<FoodReturnType[]>([]);
    const [filteredFoods, setFilteredFoods] = useState<FoodReturnType[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { unitSystem } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;
    const macroUnit = unitSystem === METRIC_SYSTEM ? GRAMS : OUNCES;

    const loadFoods = useCallback(async () => {
        if (visible) {
            setIsLoading(true);
            try {
                const allFoods = await getAllFoods();
                setFoods(allFoods);
                setFilteredFoods(allFoods);
            } catch (error) {
                console.error('Failed to load foods:', error);
            } finally {
                setIsLoading(false);
            }
        }
    }, [visible]);

    useEffect(() => {
        if (visible) {
            loadFoods();
            setSearchQuery('');
        }
    }, [visible, loadFoods]);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredFoods(foods);
        } else {
            const query = searchQuery.toLowerCase();
            setFilteredFoods(
                foods.filter((food) =>
                    food.name.toLowerCase().includes(query)
                    || (food.productCode && food.productCode.toLowerCase().includes(query))
                )
            );
        }
    }, [searchQuery, foods]);

    const handleFoodSelect = useCallback((foodId: number) => {
        onFoodSelected(foodId);
        setSearchQuery('');
    }, [onFoodSelected]);

    const handleSearchOnline = useCallback(() => {
        onClose();
        navigation.navigate('foodSearch', {
            returnFoodId: true,
        });
    }, [navigation, onClose]);

    return (
        <Portal>
            <Dialog
                onDismiss={onClose}
                style={styles.dialog}
                visible={visible}
            >
                <Dialog.Title>{t('select_food')}</Dialog.Title>
                <Dialog.Content style={styles.dialogContent}>
                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator color={colors.primary} size="large" />
                        </View>
                    ) : (
                        <>
                            <TextInput
                                mode="outlined"
                                onChangeText={setSearchQuery}
                                placeholder={t('search_food')}
                                style={styles.searchInput}
                                value={searchQuery}
                            />
                            {filteredFoods.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>
                                        {searchQuery.trim() === ''
                                            ? t('no_foods_saved')
                                            : t('no_results_found')}
                                    </Text>
                                    {searchQuery.trim() === '' && (
                                        <Button
                                            mode="contained"
                                            onPress={handleSearchOnline}
                                            style={styles.searchOnlineButton}
                                        >
                                            {t('search_online')}
                                        </Button>
                                    )}
                                </View>
                            ) : (
                                <View style={styles.listContainer}>
                                    <FlashList
                                        contentContainerStyle={styles.listContent}
                                        data={filteredFoods}
                                        estimatedItemSize={120}
                                        keyExtractor={(item) => item.id.toString()}
                                        renderItem={({ item }) => (
                                            <TouchableOpacity
                                                onPress={() => handleFoodSelect(item.id)}
                                            >
                                                <ThemedCard style={styles.foodCard}>
                                                    <View style={styles.cardContent}>
                                                        <View style={styles.cardHeader}>
                                                            <Text style={styles.foodName}>
                                                                {item.name}
                                                            </Text>
                                                            {item.productCode && (
                                                                <Text style={styles.productCode}>
                                                                    {item.productCode}
                                                                </Text>
                                                            )}
                                                            <View style={styles.macroRow}>
                                                                <Text style={styles.macroText}>
                                                                    {t('item_value', {
                                                                        item: t('calories'),
                                                                        value: safeToFixed(item.calories),
                                                                    })}
                                                                </Text>
                                                                <Text style={styles.macroText}>
                                                                    {t('item_value_unit', {
                                                                        item: t('proteins'),
                                                                        value: getDisplayFormattedWeight(item.protein || 0, GRAMS, isImperial).toString(),
                                                                        weightUnit: macroUnit,
                                                                    })}
                                                                </Text>
                                                            </View>
                                                            <View style={styles.macroRow}>
                                                                <Text style={styles.macroText}>
                                                                    {t('item_value_unit', {
                                                                        item: t('carbs'),
                                                                        value: getDisplayFormattedWeight(item.totalCarbohydrate || 0, GRAMS, isImperial).toString(),
                                                                        weightUnit: macroUnit,
                                                                    })}
                                                                </Text>
                                                                <Text style={styles.macroText}>
                                                                    {t('item_value_unit', {
                                                                        item: t('fats'),
                                                                        value: getDisplayFormattedWeight(item.totalFat || 0, GRAMS, isImperial).toString(),
                                                                        weightUnit: macroUnit,
                                                                    })}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                        <FontAwesome5
                                                            color={colors.primary}
                                                            name="plus"
                                                            size={ICON_SIZE}
                                                            style={styles.addIcon}
                                                        />
                                                    </View>
                                                </ThemedCard>
                                            </TouchableOpacity>
                                        )}
                                    />
                                </View>
                            )}
                        </>
                    )}
                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={handleSearchOnline}>
                        {t('search_online')}
                    </Button>
                    <Button onPress={onClose}>
                        {t('cancel')}
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    addIcon: {
        marginLeft: 8,
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
    dialog: {
        backgroundColor: colors.surface,
        maxHeight: '80%',
    },
    dialogContent: {
        paddingHorizontal: 0,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        color: colors.onSurfaceVariant,
        fontSize: 16,
        marginBottom: 16,
        textAlign: 'center',
    },
    foodCard: {
        marginBottom: 8,
        marginHorizontal: 16,
    },
    foodName: {
        color: colors.onSurface,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    listContainer: {
        height: 400,
        marginTop: 8,
    },
    listContent: {
        paddingBottom: 8,
    },
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: 40,
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
    searchInput: {
        backgroundColor: colors.surface,
        marginBottom: 8,
    },
    searchOnlineButton: {
        marginTop: 8,
    },
});

export default SelectFoodModal;

