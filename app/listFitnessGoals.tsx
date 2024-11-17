import AnimatedSearchBar from '@/components/AnimatedSearch';
import FABWrapper from '@/components/FABWrapper';
import ThemedCard from '@/components/ThemedCard';
import ThemedModal from '@/components/ThemedModal';
import { FAB_ICON_SIZE, ICON_SIZE } from '@/constants/ui';
import { useSnackbar } from '@/storage/SnackbarProvider';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import {
    deleteFitnessGoals,
    getTotalFitnessGoalsCount,
    getFitnessGoalsPaginated,
} from '@/utils/database';
import { formatDate } from '@/utils/date';
import { FitnessGoalsInsertType } from '@/utils/types';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Card, Text, useTheme } from 'react-native-paper';

export default function ListFitnessGoals({ navigation }: { navigation: NavigationProp<any> }) {
    const { t } = useTranslation();
    const [fitnessGoals, setFitnessGoals] = useState<FitnessGoalsInsertType[]>([]);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [goalToDelete, setGoalToDelete] = useState<null | number>(null);
    const [totalFitnessGoalsCount, setTotalFitnessGoalsCount] = useState(0);

    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const [searchQuery, setSearchQuery] = useState('');
    const { showSnackbar } = useSnackbar();

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
        const totalCount = await getTotalFitnessGoalsCount();
        setTotalFitnessGoalsCount(totalCount);
    }, []);

    const resetScreenData = useCallback(() => {
        setSearchQuery('');
        setFitnessGoals([]);
        setIsDeleteModalVisible(false);
        setGoalToDelete(null);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchTotalFitnessGoalsCount();
            loadFitnessGoals();

            return () => {
                resetScreenData();
            };
        }, [fetchTotalFitnessGoalsCount, loadFitnessGoals, resetScreenData])
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
            } catch (error) {
                console.error('Failed to delete fitness goal:', error);
            }
        }
    }, [goalToDelete, fitnessGoals, showSnackbar, t]);

    const handleDeleteCancel = useCallback(() => {
        setIsDeleteModalVisible(false);
        setGoalToDelete(null);
    }, []);

    const filteredFitnessGoals = useMemo(
        () =>
            fitnessGoals.filter((goal) => {
                const searchLower = searchQuery.toLowerCase();
                return (
                    goal.calories?.toString().toLowerCase().includes(searchLower) ||
                    goal.totalCarbohydrate?.toString().toLowerCase().includes(searchLower) ||
                    goal.totalFat?.toString().toLowerCase().includes(searchLower) ||
                    goal.protein?.toString().toLowerCase().includes(searchLower) ||
                    goal.createdAt?.toLowerCase().includes(searchLower)
                );
            }),
        [fitnessGoals, searchQuery]
    );

    const fabActions = useMemo(
        () => [
            {
                icon: () => <FontAwesome5 color={colors.primary} name="plus" size={FAB_ICON_SIZE} />,
                label: t('create_fitness_goal'),
                onPress: () => navigation.navigate('createFitnessGoal'),
                style: { backgroundColor: colors.surface },
            },
        ],
        [t, colors.surface, colors.primary, navigation]
    );

    return (
        <FABWrapper actions={fabActions} icon="cog" visible>
            <View style={styles.container}>
                <Appbar.Header
                    mode="small"
                    statusBarHeight={0}
                    style={styles.appbarHeader}
                >
                    <Appbar.Content title={t('fitness_goals')} titleStyle={styles.appbarTitle} />
                    <AnimatedSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
                </Appbar.Header>
                <FlashList
                    ListFooterComponent={
                        fitnessGoals.length < totalFitnessGoalsCount ? (
                            <ActivityIndicator />
                        ) : null
                    }
                    contentContainerStyle={styles.scrollViewContent}
                    data={filteredFitnessGoals}
                    estimatedItemSize={95}
                    keyExtractor={(item) => (item?.id ? item.id.toString() : 'default')}
                    onEndReached={loadMoreFitnessGoals}
                    onEndReachedThreshold={0.5}
                    renderItem={({ item: goal }) => (
                        <ThemedCard key={goal.id}>
                            <Card.Content style={styles.cardContent}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardTitle}>
                                        {formatDate(goal.createdAt || '')}
                                    </Text>
                                    <View style={styles.metricRow}>
                                        <Text style={styles.metricDetailText}>
                                            {t('calories')}: {goal.calories}
                                        </Text>
                                        <Text style={styles.metricDetailText}>
                                            {t('protein')}: {goal.protein}g
                                        </Text>
                                    </View>
                                    <View style={styles.metricRow}>
                                        <Text style={styles.metricDetailText}>
                                            {t('carbohydrates')}: {goal.totalCarbohydrate}g
                                        </Text>
                                        <Text style={styles.metricDetailText}>
                                            {t('fat')}: {goal.totalFat}g
                                        </Text>
                                    </View>
                                    {/* Add more details as needed */}
                                </View>
                                <View style={styles.cardActions}>
                                    <FontAwesome5
                                        color={colors.primary}
                                        name="edit"
                                        onPress={() =>
                                            navigation.navigate('createFitnessGoal', { id: goal.id })
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
    );
}

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
            marginTop: 8,
        },
        cardContent: {
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
        },
        cardHeader: {
            flex: 1,
        },
        cardTitle: {
            color: colors.onSurface,
            fontSize: 18,
            fontWeight: 'bold',
        },
        container: {
            backgroundColor: colors.background,
            flex: 1,
        },
        iconButton: {
            marginHorizontal: 8,
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
        scrollViewContent: {
            backgroundColor: colors.background,
            paddingBottom: 16,
            paddingHorizontal: 16,
        },
    });
