import AnimatedSearchBar from '@/components/AnimatedSearch';
import ThemedCard from '@/components/ThemedCard';
import { ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Platform } from 'react-native';
import { Appbar, Text, useTheme } from 'react-native-paper';

// Mock food data
const foodDatabase = [
    { name: 'Apple', calories: 95, proteins: 0.5, carbs: 25, fats: 0.3 },
    { name: 'Banana', calories: 105, proteins: 1.3, carbs: 27, fats: 0.4 },
    { name: 'Chicken Breast', calories: 165, proteins: 31, carbs: 0, fats: 3.6 },
    { name: 'Salmon', calories: 206, proteins: 22, carbs: 0, fats: 13 },
    { name: 'Brown Rice', calories: 216, proteins: 5, carbs: 45, fats: 1.6 },
    { name: 'Broccoli', calories: 55, proteins: 3.7, carbs: 11.2, fats: 0.6 },
    { name: 'Greek Yogurt', calories: 59, proteins: 10, carbs: 3.6, fats: 0.4 },
    { name: 'Almonds', calories: 164, proteins: 6, carbs: 6, fats: 14 },
];

const FoodSearch = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(foodDatabase);

    useEffect(() => {
        const results = foodDatabase.filter((food) =>
            food.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setSearchResults(results);
    }, [searchQuery]);

    const handleAddFood = (food: any) => {
        // Handle adding food to the user's nutrition log
        // You might navigate to a new screen or update state accordingly
    };

    return (
        <View style={styles.container}>
            <Appbar.Header mode="small" statusBarHeight={0} style={styles.appbarHeader}>
                <Appbar.Action
                    icon={() => (
                        <FontAwesome5 name="arrow-left" size={24} color={colors.onPrimary} />
                    )}
                    onPress={() => navigation.goBack()}
                />
                <Appbar.Content title={t('search_food')} titleStyle={styles.appbarTitle} />
                <AnimatedSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
            </Appbar.Header>
            {searchResults.length === 0 ? (
                <Text style={styles.noResultsText}>{t('no_results_found')}</Text>
            ) : (
                <FlashList
                    data={searchResults}
                    keyExtractor={(item) => item.name}
                    renderItem={({ item }) => (
                        <ThemedCard key={item.name}>
                            <View style={styles.cardContent}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardTitle}>{item.name}</Text>
                                    <View style={styles.metricRow}>
                                        <Text style={styles.metricDetail}>
                                            {t('calories')}: {item.calories} kcal
                                        </Text>
                                        <Text style={styles.metricDetail}>
                                            {t('carbs')}: {item.carbs} g
                                        </Text>
                                    </View>
                                    <View style={styles.metricRow}>
                                        <Text style={styles.metricDetail}>
                                            {t('proteins')}: {item.proteins} g
                                        </Text>
                                        <Text style={styles.metricDetail}>
                                            {t('fats')}: {item.fats} g
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

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) =>
    StyleSheet.create({
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
