import ThemedCard from '@/components/ThemedCard';
import { GRAMS, IMPERIAL_SYSTEM, OUNCES } from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { getLatestFitnessGoals, getUserNutritionBetweenDates } from '@/utils/database';
import { safeToFixed } from '@/utils/string';
import { FitnessGoalsReturnType } from '@/utils/types';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';

const TodaysNutritionProgress = () => {
    const navigation = useNavigation<NavigationProp<any>>();
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [isLoading, setIsLoading] = useState(false);

    const [consumed, setConsumed] = useState({
        calories: 0,
        carbohydrate: 0,
        fat: 0,
        protein: 0,
    });

    const [dailyGoals, setDailyGoals] = useState<null | Omit<FitnessGoalsReturnType, 'id'>>(null);

    const loadLatestFitnessGoal = useCallback(async () => {
        try {
            const latestGoal = await getLatestFitnessGoals();
            if (latestGoal) {
                setDailyGoals(latestGoal);
            } else {
                setDailyGoals(null);
            }
        } catch (error) {
            console.error('Failed to load latest fitness goal:', error);
        }
    }, []);

    const { unitSystem } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;
    const macroUnit = isImperial ? OUNCES : GRAMS;

    const calculatePercentage = (consumedAmount: number, goalAmount: number) => {
        if (goalAmount === 0) {
            return 0;
        }

        return Math.min(Math.round((consumedAmount / goalAmount) * 100), 100);
    };

    const loadConsumed = useCallback(async () => {
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        try {
            const consumedData = await getUserNutritionBetweenDates(
                startDate.toISOString(),
                endDate.toISOString()
            );

            const consumed = consumedData.reduce(
                (acc, item) => {
                    acc.calories += item.calories || 0;
                    acc.protein += item.protein || 0;
                    acc.carbohydrate += item.carbohydrate || 0;
                    acc.fat += item.fat || 0;
                    return acc;
                },
                { calories: 0, carbohydrate: 0, fat: 0, protein: 0 }
            );

            setConsumed(consumed);
        } catch (error) {
            console.error('Error loading consumed data:', error);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            const loadData = async () => {
                setIsLoading(true);
                await loadConsumed();
                await loadLatestFitnessGoal();
                setIsLoading(false);
            };

            loadData();
        }, [loadConsumed, loadLatestFitnessGoal])
    );

    const macros = dailyGoals ? [
        { consumed: safeToFixed(consumed.calories), goal: dailyGoals.calories, name: t('calories'), unit: 'kcal' },
        { consumed: safeToFixed(consumed.protein), goal: dailyGoals.protein, name: t('proteins'), unit: macroUnit },
        { consumed: safeToFixed(consumed.carbohydrate), goal: dailyGoals.totalCarbohydrate, name: t('carbs'), unit: macroUnit },
        { consumed: safeToFixed(consumed.fat), goal: dailyGoals.totalFat, name: t('fats'), unit: macroUnit },
    ] : [];

    return (
        <View style={styles.container}>
            {!isLoading ? (
                <ThemedCard>
                    <View style={styles.cardContent}>
                        <Text style={styles.cardTitle}>{t('todays_progress')}</Text>
                        {dailyGoals ? (
                            macros.map((macro) => (
                                <View key={macro.name} style={styles.macroContainer}>
                                    <Text style={styles.metricDetail}>
                                        {t('item_value_unit', { item: macro.name, value: `${macro.consumed} / ${macro.goal}`, weightUnit: macro.unit })}
                                    </Text>
                                    <View style={styles.progressBarContainer}>
                                        <View
                                            style={[
                                                styles.progressBar,
                                                {
                                                    width: `${calculatePercentage(parseFloat(macro.consumed), macro.goal)}%`,
                                                },
                                            ]}
                                        />
                                    </View>
                                </View>
                            ))
                        ) : (
                            <Button
                                mode="contained"
                                onPress={() => navigation.navigate('createFitnessGoals')}
                                style={styles.addGoalButton}
                            >
                                {t('add_your_fitness_goal')}
                            </Button>
                        )}
                    </View>
                </ThemedCard>
            ) : (
                <ActivityIndicator color="#3b82f6" size="large" style={styles.loadingIndicator} />
            )}
        </View>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    addGoalButton: {
        backgroundColor: colors.primary,
        borderRadius: 8,
        marginTop: 16,
        paddingVertical: 12,
    },
    cardContent: {
        padding: 16,
    },
    cardTitle: {
        color: colors.onSurface,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        width: '85%',
    },
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    loadingIndicator: {
        color: colors.primary,
        marginBottom: 8,
        marginVertical: 16,
    },
    macroContainer: {
        marginBottom: 12,
    },
    metricDetail: {
        color: colors.onSurface,
        fontSize: 14,
        marginBottom: 4,
    },
    progressBar: {
        backgroundColor: colors.primary,
        height: '100%',
    },
    progressBarContainer: {
        backgroundColor: colors.surfaceVariant,
        borderRadius: 4,
        height: 10,
        overflow: 'hidden',
    },
});

export default TodaysNutritionProgress;
