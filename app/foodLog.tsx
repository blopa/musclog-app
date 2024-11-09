import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, ScrollView, StyleSheet, Platform, Dimensions } from 'react-native';
import { Appbar, Button, TextInput, Card, ProgressBar, useTheme, Text } from 'react-native-paper';
import { TabView, TabBar } from 'react-native-tab-view';

const FoodLog = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [index, setIndex] = useState(0);
    const [routes] = useState([
        { key: 'overview', title: t('overview') },
        { key: 'meals', title: t('meals') },
    ]);

    // Mock data for demonstration
    const dailyGoal = {
        calories: 2500,
        proteins: 150,
        carbs: 300,
        fats: 80,
    };

    const consumed = {
        calories: 1500,
        proteins: 90,
        carbs: 180,
        fats: 50,
    };

    const mealCategories = [
        { name: t('breakfast'), icon: '🍳' },
        { name: t('lunch'), icon: '🥪' },
        { name: t('dinner'), icon: '🍽️' },
        { name: t('snacks'), icon: '🍎' },
    ];

    const calculatePercentage = (consumedAmount: number, goalAmount: number) => {
        return Math.min(Math.round((consumedAmount / goalAmount) * 100), 100);
    };

    const OverviewRoute = () => (
        <ScrollView contentContainerStyle={styles.tabContent}>
            <Card style={styles.card}>
                <Card.Title title={t('todays_progress')} />
                <Card.Content>
                    {Object.entries(consumed).map(([macro, amount]) => (
                        <View key={macro} style={styles.macroContainer}>
                            <View style={styles.macroRow}>
                                <Text style={styles.macroLabel}>{t(macro)}</Text>
                                <Text style={styles.macroAmount}>
                                    {amount} / {dailyGoal[macro as keyof typeof dailyGoal]}{' '}
                                    {macro === 'calories' ? 'kcal' : 'g'}
                                </Text>
                            </View>
                            <ProgressBar
                                progress={
                                    calculatePercentage(
                                        amount,
                                        dailyGoal[macro as keyof typeof dailyGoal]
                                    ) / 100
                                }
                                color={colors.primary}
                                style={styles.progressBar}
                            />
                        </View>
                    ))}
                </Card.Content>
            </Card>
        </ScrollView>
    );

    const MealsRoute = () => (
        <ScrollView contentContainerStyle={styles.tabContent}>
            {mealCategories.map((category) => (
                <Card key={category.name} style={styles.card}>
                    <Card.Title
                        title={`${category.icon} ${category.name}`}
                        right={(props) => (
                            <Button
                                {...props}
                                mode="text"
                                onPress={() => {
                                    /* Handle add meal item */
                                }}
                            >
                                <FontAwesome5 name="plus" size={16} color={colors.primary} />
                            </Button>
                        )}
                    />
                    <Card.Content>
                        <Text style={styles.noItemsText}>{t('no_items_added_yet')}</Text>
                    </Card.Content>
                </Card>
            ))}
        </ScrollView>
    );

    const renderScene = ({ route }: { route: { key: string } }) => {
        switch (route.key) {
            case 'overview':
                return <OverviewRoute />;
            case 'meals':
                return <MealsRoute />;
            default:
                return null;
        }
    };

    const renderTabBar = (props: any) => (
        <TabBar
            {...props}
            indicatorStyle={{ backgroundColor: colors.primary }}
            style={{ backgroundColor: colors.background }}
            labelStyle={{ color: colors.onSurface }}
        />
    );

    return (
        <View style={styles.container}>
            <Appbar.Header
                mode="small"
                statusBarHeight={0}
                style={styles.appbarHeader}
            >
                <Appbar.Content
                    title={t('macro_tracker')}
                    titleStyle={styles.appbarTitle}
                />
                <Button
                    mode="outlined"
                    onPress={() => navigation.goBack()}
                    textColor={colors.onPrimary}
                >
                    {t('back')}
                </Button>
            </Appbar.Header>
            <View style={styles.content}>
                <View style={styles.searchContainer}>
                    <TextInput
                        placeholder={t('search_food')}
                        style={styles.searchInput}
                        mode="outlined"
                    />
                    <Button
                        mode="outlined"
                        onPress={() => {
                            /* Handle search */
                        }}
                        style={styles.iconButton}
                    >
                        <FontAwesome5 name="search" size={20} color={colors.primary} />
                    </Button>
                    <Button
                        mode="outlined"
                        onPress={() => {
                            /* Handle barcode scan */
                        }}
                        style={styles.iconButton}
                    >
                        <FontAwesome5 name="barcode" size={20} color={colors.primary} />
                    </Button>
                </View>
                <TabView
                    navigationState={{ index, routes }}
                    renderScene={renderScene}
                    renderTabBar={renderTabBar}
                    onIndexChange={setIndex}
                    initialLayout={{ width: Dimensions.get('window').width }}
                />
            </View>
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
    card: {
        marginBottom: 16,
    },
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    iconButton: {
        marginLeft: 4,
    },
    macroAmount: {
        color: colors.onSurface,
        fontSize: 16,
    },
    macroContainer: {
        marginBottom: 12,
    },
    macroLabel: {
        color: colors.onSurface,
        fontSize: 16,
        fontWeight: 'bold',
    },
    macroRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    noItemsText: {
        color: colors.onSurface,
    },
    progressBar: {
        borderRadius: 4,
        height: 8,
    },
    searchContainer: {
        alignItems: 'center',
        flexDirection: 'row',
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        marginRight: 8,
    },
    tabContent: {
        paddingVertical: 16,
    },
});

export default FoodLog;
