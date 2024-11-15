import ThemedCard from '@/components/ThemedCard';
import { ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { MusclogApiFoodInfoType, PaginatedOpenFoodFactsApiFoodProductInfoType } from '@/utils/types';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp, useFocusEffect, useRoute } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';
import { Appbar, Text, useTheme } from 'react-native-paper';

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
    const [searchResults, setSearchResults] = useState([] as MusclogApiFoodInfoType[]);

    useEffect(() => {
        setSearchResults((prevSearchResults) => {
            return prevSearchResults.filter((food) =>
                food.productTitle.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        );
    }, [searchQuery]);

    useFocusEffect(
        useCallback(() => {
            const fetchFoodData = async () => {
                if (initialSearchQuery.length > 0) {
                    setSearchQuery(initialSearchQuery);

                    try {
                        const response = await fetch(
                            `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(initialSearchQuery)}&search_simple=1&json=1`
                        );
                        if (response.ok) {
                            const data = await response.json();
                            setSearchResults(data.products.map((f: PaginatedOpenFoodFactsApiFoodProductInfoType) => ({
                                productTitle: f.product_name,
                                kcal: f.nutriments['energy-kcal'],
                                protein: f.nutriments['proteins'],
                                carbs: f.nutriments['carbohydrates'],
                                fat: f.nutriments['fat'],
                            })));
                        } else {
                            console.error('Failed to fetch food items:', response.statusText);
                        }
                    } catch (error) {
                        console.error('Error fetching food items:', error);
                    }
                }
            };

            fetchFoodData();
        }, [initialSearchQuery, searchQuery])
    );

    const handleAddFood = (food: any) => {
        // Handle adding food to the user's nutrition log
    };

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
            {searchResults.length === 0 ? (
                <Text style={styles.noResultsText}>{t('no_results_found')}</Text>
            ) : (
                <FlashList
                    data={searchResults}
                    keyExtractor={(item) => item.productTitle}
                    renderItem={({ item }) => (
                        <ThemedCard key={item.productTitle}>
                            <View style={styles.cardContent}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardTitle}>{item.productTitle}</Text>
                                    <View style={styles.metricRow}>
                                        <Text style={styles.metricDetail}>
                                            {t('calories')}: {item.kcal} kcal
                                        </Text>
                                        <Text style={styles.metricDetail}>
                                            {t('carbs')}: {item.carbs} g
                                        </Text>
                                    </View>
                                    <View style={styles.metricRow}>
                                        <Text style={styles.metricDetail}>
                                            {t('proteins')}: {item.protein} g
                                        </Text>
                                        <Text style={styles.metricDetail}>
                                            {t('fats')}: {item.fat} g
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
                />
            )}
        </View>
    );
};

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
    iconButton: {
        marginHorizontal: 8,
    },
    listContent: {
        backgroundColor: colors.background,
        paddingBottom: 16,
        paddingHorizontal: 16,
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
    noResultsText: {
        color: colors.onSurface,
        fontSize: 16,
        marginTop: 20,
        textAlign: 'center',
    },
});

export default FoodSearch;
