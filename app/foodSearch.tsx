import FoodTrackingModal from '@/components/FoodTrackingModal';
import ThemedCard from '@/components/ThemedCard';
import { ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { fetchFoodData } from '@/utils/fetchFoodData';
import { MusclogApiFoodInfoType } from '@/utils/types';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View, ActivityIndicator } from 'react-native';
import { Appbar, Button, Text, TextInput, useTheme } from 'react-native-paper';

type RouteParams = {
    initialSearchQuery?: string;
};

const FoodSearch = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const route = useRoute();
    const { initialSearchQuery = '' } = (route.params as RouteParams) || {};
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

    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);

            const { products, pageCount } = await fetchFoodData(initialSearchQuery, 1);
            setSearchResults(products);
            setTotalPages(pageCount);

            setIsLoading(false);
        };

        if (initialSearchQuery) {
            loadInitialData();
        }
    }, [initialSearchQuery]);

    const handleSearch = useCallback(async () => {
        setIsLoading(true);
        setCurrentPage(1);
        setLoadMoreError(false);

        const { products, pageCount } = await fetchFoodData(searchQuery, 1);
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

    const closeModal = useCallback(() => {
        setIsModalVisible(false);
        setSelectedFood(null);
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

    const openAddNewFoodModal = useCallback(() => {
        resetScreenData();
        navigation.navigate('createFood', { foodName: searchQuery });
    }, [navigation, resetScreenData, searchQuery]);

    return (
        <View style={styles.container}>
            <Appbar.Header mode="small" statusBarHeight={0} style={styles.appbarHeader}>
                <Appbar.Action
                    icon={() => (
                        <FontAwesome5 name="arrow-left" size={24} color={colors.onPrimary} />
                    )}
                    onPress={() => navigation.navigate('foodLog')}
                />
                <Appbar.Content title={t('search_food')} titleStyle={styles.appbarTitle} />
            </Appbar.Header>
            <View style={styles.searchContainer}>
                <TextInput
                    placeholder={t('search_food')}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={styles.searchInput}
                    mode="outlined"
                />
                <Button
                    mode="outlined"
                    onPress={handleSearch}
                    style={styles.iconButton}
                >
                    <FontAwesome5 name="search" size={20} color={colors.primary} />
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
                    data={searchResults}
                    keyExtractor={(item, index) => (item.productTitle || index).toString()}
                    renderItem={({ item }) => (
                        <ThemedCard key={item.productTitle}>
                            <View style={styles.cardContent}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardTitle}>
                                        {item.productTitle}
                                    </Text>
                                    <Text style={styles.metricDetail}>
                                        {item.ean}
                                    </Text>
                                    <View style={styles.metricRow}>
                                        <Text style={styles.metricDetail}>
                                            {t('calories')}: {item.kcal.toString()} kcal
                                        </Text>
                                        <Text style={styles.metricDetail}>
                                            {t('carbs')}: {(item.carbs || 0).toString()} g
                                        </Text>
                                    </View>
                                    <View style={styles.metricRow}>
                                        <Text style={styles.metricDetail}>
                                            {t('proteins')}: {(item.protein || 0).toString()} g
                                        </Text>
                                        <Text style={styles.metricDetail}>
                                            {t('fats')}: {(item.fat || 0).toString()} g
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.cardActions}>
                                    <FontAwesome5
                                        color={colors.primary}
                                        name="plus"
                                        onPress={() => handleAddFood(item)}
                                        size={ICON_SIZE}
                                        style={styles.iconButton}
                                    />
                                </View>
                            </View>
                        </ThemedCard>
                    )}
                    estimatedItemSize={115}
                    contentContainerStyle={styles.listContent}
                    onEndReached={loadMoreResults}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        isLoading ? (
                            <ActivityIndicator size="large" color={colors.primary} />
                        ) : loadMoreError ? (
                            <Button onPress={loadMoreResults} mode="outlined" style={styles.loadMoreButton}>
                                {t('load_more')}
                            </Button>
                        ) : null
                    }
                />
            )}
            <FoodTrackingModal
                visible={isModalVisible}
                onClose={closeModal}
                food={selectedFood}
            />
        </View>
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
    cardActions: {
        alignItems: 'center',
        flexDirection: 'row',
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
    cardTitle: {
        color: colors.onSurface,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    foodTrackingForm: {
        paddingBottom: 16,
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
    metricDetail: {
        color: colors.onSurface,
        fontSize: 14,
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
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
