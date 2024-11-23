import PieChart from '@/components/Charts/PieChart';
import FABWrapper from '@/components/FABWrapper';
import { Screen } from '@/components/Screen';
import ThemedCard from '@/components/ThemedCard';
import ThemedModal from '@/components/ThemedModal';
import { GRAMS, IMPERIAL_SYSTEM, METRIC_SYSTEM, OUNCES } from '@/constants/storage';
import { FAB_ICON_SIZE, ICON_SIZE } from '@/constants/ui';
import useUnit from '@/hooks/useUnit';
import { useSnackbar } from '@/storage/SnackbarProvider';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import {
    deleteFitnessGoals,
    getFitnessGoalsPaginated,
    getLatestFitnessGoals,
    getTotalFitnessGoalsCount,
} from '@/utils/database';
import { formatDate } from '@/utils/date';
import { safeToFixed } from '@/utils/string';
import { FitnessGoalsInsertType } from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Card, Text, useTheme } from 'react-native-paper';

export default function ListFitnessGoals({ navigation }: { navigation: NavigationProp<any> }) {
    const { t } = useTranslation();
    const [latestFitnessGoal, setLatestFitnessGoal] = useState<FitnessGoalsInsertType | null>(null);
    const [fitnessGoals, setFitnessGoals] = useState<FitnessGoalsInsertType[]>([]);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [goalToDelete, setGoalToDelete] = useState<null | number>(null);
    const [totalFitnessGoalsCount, setTotalFitnessGoalsCount] = useState(0);

    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { showSnackbar } = useSnackbar();

    const { unitSystem } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;
    const macroUnit = unitSystem === METRIC_SYSTEM ? GRAMS : OUNCES;

    const loadLatestFitnessGoal = useCallback(async () => {
        try {
            const latestGoal = await getLatestFitnessGoals();
            setLatestFitnessGoal(latestGoal);
        } catch (error) {
            console.error('Failed to load latest fitness goal:', error);
        }
    }, []);

    const loadFitnessGoals = useCallback(async (offset = 0, limit = 20) => {
        try {
            const loadedFitnessGoals = await getFitnessGoalsPaginated(offset, limit);

            setFitnessGoals((prevState) => {
                const combinedData = [
                    ...prevState,
                    ...loadedFitnessGoals.filter(
                        (data) => !prevState.some((prevData) => prevData.id === data.id)
                    ),
                ];

                combinedData.sort((a, b) => {
                    if (a.createdAt && b.createdAt) {
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    }
                    return 0;
                });

                return combinedData;
            });
        } catch (error) {
            console.error('Failed to load fitness goals:', error);
        }
    }, []);

    const loadMoreFitnessGoals = useCallback(() => {
        if (fitnessGoals.length >= totalFitnessGoalsCount) {
            return;
        }

        loadFitnessGoals(fitnessGoals.length);
    }, [fitnessGoals.length, totalFitnessGoalsCount, loadFitnessGoals]);

    const fetchTotalFitnessGoalsCount = useCallback(async () => {
        try {
            const totalCount = await getTotalFitnessGoalsCount();
            setTotalFitnessGoalsCount(totalCount);
        } catch (error) {
            console.error('Failed to fetch total fitness goals count:', error);
        }
    }, []);

    const resetScreenData = useCallback(() => {
        setFitnessGoals([]);
        setLatestFitnessGoal(null);
        setIsDeleteModalVisible(false);
        setGoalToDelete(null);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchTotalFitnessGoalsCount();
            loadLatestFitnessGoal();
            loadFitnessGoals();

            return () => {
                resetScreenData();
            };
        }, [fetchTotalFitnessGoalsCount, loadLatestFitnessGoal, loadFitnessGoals, resetScreenData])
    );

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                navigation.goBack();
                return true;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => {
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            };
        }, [navigation])
    );

    const handleDeleteGoal = useCallback((id: number) => {
        setGoalToDelete(id);
        setIsDeleteModalVisible(true);
    }, []);

    const handleDeleteConfirmation = useCallback(async () => {
        if (goalToDelete) {
            try {
                await deleteFitnessGoals(goalToDelete);
                const updatedFitnessGoals = fitnessGoals.filter((goal) => goal.id !== goalToDelete);
                setFitnessGoals(updatedFitnessGoals);
                setIsDeleteModalVisible(false);
                setGoalToDelete(null);
                setTotalFitnessGoalsCount((prevState) => prevState - 1);
                showSnackbar(t('fitness_goal_deleted'), t('ok'), () => {});

                if (latestFitnessGoal && latestFitnessGoal.id === goalToDelete) {
                    loadLatestFitnessGoal();
                }
            } catch (error) {
                console.error('Failed to delete fitness goal:', error);
            }
        }
    }, [goalToDelete, fitnessGoals, showSnackbar, t, latestFitnessGoal, loadLatestFitnessGoal]);

    const handleDeleteCancel = useCallback(() => {
        setIsDeleteModalVisible(false);
        setGoalToDelete(null);
    }, []);

    const fabActions = [
        {
            icon: () => <FontAwesome5 color={colors.primary} name="plus" size={FAB_ICON_SIZE} />,
            label: t('create_fitness_goals'),
            onPress: () => navigation.navigate('createFitnessGoals'),
            style: { backgroundColor: colors.surface },
        },
    ];

    return (
        <Screen style={styles.container}>
            <FABWrapper actions={fabActions} icon="cog" visible>
                <View style={styles.container}>
                    <Appbar.Header
                        mode="small"
                        statusBarHeight={0}
                        style={styles.appbarHeader}
                    >
                        <Appbar.Content title={t('fitness_goals')} titleStyle={styles.appbarTitle} />
                    </Appbar.Header>
                    {latestFitnessGoal && (
                        <ThemedCard style={styles.latestGoalCard}>
                            <Text style={styles.cardTitle}>{t('current_fitness_goals').toUpperCase()}</Text>
                            <Card.Content style={styles.latestGoalContent}>
                                <View style={styles.goalTextContainer}>
                                    <Text style={styles.metricDetailText}>
                                        {t('item_value', {
                                            item: t('calories'),
                                            value: safeToFixed(latestFitnessGoal.calories),
                                        })}
                                    </Text>
                                    <Text style={styles.metricDetailText}>
                                        {t('item_value_unit', {
                                            item: t('protein'),
                                            value: getDisplayFormattedWeight(latestFitnessGoal.protein || 0, GRAMS, isImperial).toString(),
                                            weightUnit: macroUnit,
                                        })}
                                    </Text>
                                    <Text style={styles.metricDetailText}>
                                        {t('item_value_unit', {
                                            item: t('carbohydrates'),
                                            value: getDisplayFormattedWeight(latestFitnessGoal.totalCarbohydrate || 0, GRAMS, isImperial).toString(),
                                            weightUnit: macroUnit,
                                        })}
                                    </Text>
                                    <Text style={styles.metricDetailText}>
                                        {t('item_value_unit', {
                                            item: t('fat'),
                                            value: getDisplayFormattedWeight(latestFitnessGoal.totalFat || 0, GRAMS, isImperial).toString(),
                                            weightUnit: macroUnit,
                                        })}
                                    </Text>
                                </View>
                                <View style={styles.pieChartContainer}>
                                    <PieChart
                                        data={[
                                            { color: '#4CAF50', label: t('protein'), value: getDisplayFormattedWeight(latestFitnessGoal.protein || 0, GRAMS, isImperial) },
                                            { color: '#2196F3', label: t('carbohydrates'), value: getDisplayFormattedWeight(latestFitnessGoal.totalCarbohydrate || 0, GRAMS, isImperial) },
                                            { color: '#FF9800', label: t('fat'), value: getDisplayFormattedWeight(latestFitnessGoal.totalFat || 0, GRAMS, isImperial) },
                                        ]}
                                        showLabels={false}
                                        showLegend={false}
                                        showShareImageButton={false}
                                        size={130}
                                    />
                                </View>
                            </Card.Content>
                        </ThemedCard>
                    )}
                    <FlashList
                        contentContainerStyle={styles.scrollViewContent}
                        data={fitnessGoals}
                        estimatedItemSize={95}
                        keyExtractor={(item) => (item?.id ? item.id.toString() : 'default')}
                        ListFooterComponent={
                            fitnessGoals.length < totalFitnessGoalsCount ? (
                                <ActivityIndicator />
                            ) : null
                        }
                        onEndReached={loadMoreFitnessGoals}
                        onEndReachedThreshold={0.5}
                        renderItem={({ item: goal }) => (
                            <ThemedCard key={goal.id} style={styles.flashListCard}>
                                <Card.Content style={styles.flashListCardContent}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.cardTitle}>
                                            {formatDate(goal.createdAt || '')}
                                        </Text>
                                        <View style={styles.metricRow}>
                                            <Text style={styles.metricDetailText}>
                                                {t('item_value', { item: t('calories'), value: goal.calories })}
                                            </Text>
                                            <Text style={styles.metricDetailText}>
                                                {t('item_value_unit', {
                                                    item: t('protein'),
                                                    value: getDisplayFormattedWeight(goal.protein || 0, GRAMS, isImperial).toString(),
                                                    weightUnit: macroUnit,
                                                })}
                                            </Text>
                                        </View>
                                        <View style={styles.metricRow}>
                                            <Text style={styles.metricDetailText}>
                                                {t('item_value_unit', {
                                                    item: t('carbohydrates'),
                                                    value: getDisplayFormattedWeight(goal.totalCarbohydrate || 0, GRAMS, isImperial).toString(),
                                                    weightUnit: macroUnit,
                                                })}
                                            </Text>
                                            <Text style={styles.metricDetailText}>
                                                {t('item_value_unit', {
                                                    item: t('fat'),
                                                    value: getDisplayFormattedWeight(goal.totalFat || 0, GRAMS, isImperial).toString(),
                                                    weightUnit: macroUnit,
                                                })}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.cardActions}>
                                        <FontAwesome5
                                            color={colors.primary}
                                            name="edit"
                                            onPress={() =>
                                                navigation.navigate('createFitnessGoals', { id: goal.id })
                                            }
                                            size={ICON_SIZE}
                                            style={styles.iconButton}
                                        />
                                        <FontAwesome5
                                            color={colors.primary}
                                            name="trash"
                                            onPress={() => handleDeleteGoal(goal.id!)}
                                            size={ICON_SIZE}
                                            style={styles.iconButton}
                                        />
                                    </View>
                                </Card.Content>
                            </ThemedCard>
                        )}
                    />
                    <ThemedModal
                        cancelText={t('no')}
                        confirmText={t('yes')}
                        onClose={handleDeleteCancel}
                        onConfirm={handleDeleteConfirmation}
                        title={t('delete_confirmation_generic', {
                            title: t('fitness_goal'),
                        })}
                        visible={isDeleteModalVisible}
                    />
                </View>
            </FABWrapper>
        </Screen>
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
    cardActions: {
        alignItems: 'center',
        flexDirection: 'row',
        marginTop: 8,
    },
    cardHeader: {
        flex: 1,
    },
    cardTitle: {
        color: colors.onSurface,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        marginTop: 8,
        textAlign: 'center',
    },
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    flashListCard: {
        marginHorizontal: 16,
        marginVertical: 8,
    },
    flashListCardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    goalTextContainer: {
        flex: 1,
        marginRight: 16,
    },
    iconButton: {
        marginHorizontal: 8,
    },
    latestGoalCard: {
        marginBottom: 8,
        marginHorizontal: 16,
        marginTop: 16,
    },
    latestGoalContent: {
        alignItems: 'center',
        flexDirection: 'row',
    },
    metricDetailText: {
        color: colors.onSurface,
        fontSize: 14,
        marginBottom: 4,
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    pieChartContainer: {
        alignItems: 'center',
        flex: 1,
    },
    scrollViewContent: {
        backgroundColor: colors.background,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
});
