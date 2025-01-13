import FoodItem from '@/components/FoodItem';
import FoodTrackingModal from '@/components/FoodTrackingModal';
import { Screen } from '@/components/Screen';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { getFood } from '@/utils/database';
import { fetchFoodData } from '@/utils/fetchFoodData';
import { MusclogApiFoodInfoType } from '@/utils/types';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { Appbar, Button, Text, TextInput, useTheme } from 'react-native-paper';

type RouteParams = {
    defaultMealType?: string;
    foodId?: string;
    initialSearchQuery?: string;
};

const FoodSearch = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const route = useRoute();
    const { defaultMealType = '0', foodId, initialSearchQuery = '' } = (route.params as RouteParams) || {};
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
    const [searchResults, setSearchResults] = useState<MusclogApiFoodInfoType[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [loadMoreError, setLoadMoreError] = useState(false);
    const [selectedFood, setSelectedFood] = useState<MusclogApiFoodInfoType | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);

    const loadInitialQuery = useCallback(async () => {
        setIsLoading(true);
        setSearchQuery(initialSearchQuery);

        const { pageCount, products } = await fetchFoodData(initialSearchQuery, 1);
        setSearchResults(products);
        setTotalPages(pageCount);

        setIsLoading(false);
    }, [initialSearchQuery]);

    const loadInitialFood = useCallback(async () => {
        if (foodId) {
            setIsLoading(true);
            const food = await getFood(Number(foodId));
            if (food) {
                setSelectedFood({
                    carbs: food.totalCarbohydrate,
                    fat: food.totalFat,
                    kcal: food.calories,
                    productTitle: food.name,
                    protein: food.protein,
                });

                setIsModalVisible(true);
                setIsLoading(false);
            }
        }
    }, [foodId]);

    const handleSearch = useCallback(async () => {
        setIsLoading(true);
        setCurrentPage(1);
        setLoadMoreError(false);

        const { pageCount, products } = await fetchFoodData(searchQuery, 1);
        setSearchResults(products);
        setTotalPages(pageCount);

        setIsLoading(false);
    }, [searchQuery]);

    const loadMoreResults = useCallback(async () => {
        if (currentPage >= totalPages || isLoading) {
            return;
        }

        setIsLoading(true);
        setLoadMoreError(false);
        const nextPage = currentPage + 1;

        try {
            const { products } = await fetchFoodData(searchQuery, nextPage);
            setSearchResults((prevResults) => [...prevResults, ...products]);
            setCurrentPage(nextPage);
        } catch (error) {
            console.error('Error loading more results:', error);
            setLoadMoreError(true);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, totalPages, isLoading, searchQuery]);

    const handleAddFood = useCallback((food: MusclogApiFoodInfoType) => {
        setSelectedFood(food);
        setIsModalVisible(true);
    }, []);

    const resetScreenData = useCallback(() => {
        setIsModalVisible(false);
        setSelectedFood(null);
        setSearchQuery('');
        setSearchResults([]);
        setCurrentPage(1);
        setTotalPages(1);
        setIsLoading(false);
        setLoadMoreError(false);
    }, []);

    const handleCloseTrackingModal = useCallback(() => {
        setIsModalVisible(false);
        setSelectedFood(null);

        resetScreenData();
        navigation.navigate('foodLog');
    }, [navigation, resetScreenData]);

    useFocusEffect(
        useCallback(() => {
            if (initialSearchQuery) {
                loadInitialQuery();
            }

            loadInitialFood();

            return () => {
                resetScreenData();
            };
        }, [initialSearchQuery, loadInitialFood, loadInitialQuery, resetScreenData])
    );

    const openAddNewFoodModal = useCallback(() => {
        resetScreenData();
        navigation.navigate('createFood', { foodName: searchQuery });
    }, [navigation, resetScreenData, searchQuery]);

    return (
        <Screen style={styles.container}>
            <Appbar.Header mode="small" statusBarHeight={0} style={styles.appbarHeader}>
                <Appbar.Action
                    icon={() => (
                        <FontAwesome5 color={colors.onPrimary} name="arrow-left" size={24} />
                    )}
                    onPress={() => navigation.navigate('foodLog')}
                />
                <Appbar.Content title={t('search_food')} titleStyle={styles.appbarTitle} />
            </Appbar.Header>
            <View style={styles.searchContainer}>
                <TextInput
                    mode="outlined"
                    onChangeText={setSearchQuery}
                    placeholder={t('search_food')}
                    style={styles.searchInput}
                    value={searchQuery}
                />
                <Button
                    mode="outlined"
                    onPress={handleSearch}
                    style={styles.iconButton}
                >
                    <FontAwesome5 color={colors.primary} name="search" size={20} />
                </Button>
            </View>
            {searchResults.length === 0 && !isLoading ? (
                <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>{t('no_results_found')}</Text>
                    <Button mode="contained" onPress={openAddNewFoodModal} style={styles.addButton}>
                        {t('add_new_food')}
                    </Button>
                </View>
            ) : (
                <FlashList
                    contentContainerStyle={styles.listContent}
                    data={searchResults}
                    estimatedItemSize={115}
                    keyExtractor={(item, index) => (item.ean || index).toString()}
                    ListFooterComponent={
                        isLoading ? (
                            <ActivityIndicator color={colors.primary} size="large" />
                        ) : loadMoreError ? (
                            <Button mode="outlined" onPress={loadMoreResults} style={styles.loadMoreButton}>
                                {t('load_more')}
                            </Button>
                        ) : null
                    }
                    onEndReached={loadMoreResults}
                    onEndReachedThreshold={0.5}
                    renderItem={
                        ({ item }) => <FoodItem food={item} onAddFood={handleAddFood} />
                    }
                />
            )}
            <FoodTrackingModal
                defaultMealType={defaultMealType}
                food={selectedFood}
                onClose={handleCloseTrackingModal}
                visible={isModalVisible}
            />
        </Screen>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    addButton: {
        alignSelf: 'center',
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
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    iconButton: {
        marginLeft: 8,
    },
    listContent: {
        backgroundColor: colors.background,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    loadMoreButton: {
        alignSelf: 'center',
        marginVertical: 10,
    },
    noResultsContainer: {
        alignItems: 'center',
        marginTop: 20,
    },
    noResultsText: {
        color: colors.onSurface,
        fontSize: 16,
    },
    searchContainer: {
        alignItems: 'center',
        flexDirection: 'row',
        marginBottom: 16,
        marginTop: 12,
        paddingHorizontal: 16,
    },
    searchInput: {
        backgroundColor: colors.surface,
        flex: 1,
    },
});

export default FoodSearch;
