import BarChart from '@/components/Charts/BarChart';
import LineChart from '@/components/Charts/LineChart';
import NutritionDetailedChart from '@/components/Charts/NutritionDetailedChart';
import WeightLineChart from '@/components/Charts/WeightLineChart';
import FABWrapper from '@/components/FABWrapper';
import Filters from '@/components/Filters';
import { Screen } from '@/components/Screen';
import {
    CALORIES_IN_CARBS,
    CALORIES_IN_FAT,
    CALORIES_IN_FIBER,
    CALORIES_IN_PROTEIN,
} from '@/constants/healthConnect';
import {
    AI_SETTINGS_TYPE,
    GRAMS,
    IMPERIAL_SYSTEM,
    KILOGRAMS,
    METRIC_SYSTEM,
    OUNCES,
    USE_FAT_PERCENTAGE_TDEE_TYPE,
} from '@/constants/storage';
import { FAB_ICON_SIZE, ICON_SIZE } from '@/constants/ui';
import useUnit from '@/hooks/useUnit';
import { useChatData } from '@/storage/ChatProvider';
import { useHealthConnect } from '@/storage/HealthConnectProvider';
import { useSettings } from '@/storage/SettingsContext';
import { useSnackbar } from '@/storage/SnackbarProvider';
import { useUnreadMessages } from '@/storage/UnreadMessagesProvider';
import { getAiApiVendor, getNutritionInsights } from '@/utils/ai';
import { addTransparency, CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import {
    aggregateDataByWeek,
    aggregateMetricsByDate,
    aggregateNutritionData,
    aggregateUserMetricsNutrition,
    calculateFFMI,
    calculatePastWorkoutsWeeklyAverages,
    calculateTDEE,
    calculateUserMetricsNutritionWeeklyAverages,
} from '@/utils/data';
import {
    getClosestWeightUserMetric,
    getRecentWorkoutsBetweenDates,
    getRecentWorkoutsFromDate,
    getUser,
    getUserMeasurementsBetweenDates,
    getUserMeasurementsFromDate,
    getUserMetricsBetweenDates,
    getUserMetricsFromDate,
    getUserNutritionBetweenDates,
    getUserNutritionFromDate,
} from '@/utils/database';
import {
    formatDate,
    getCurrentTimestampISOString,
    getDaysAgoTimestampISOString,
    getEndOfDayTimestampISOString,
    getStartOfDayTimestampISOString,
} from '@/utils/date';
import { syncHealthConnectData } from '@/utils/healthConnect';
import { safeToFixed } from '@/utils/string';
import {
    EatingPhaseType,
    ExtendedLineChartDataType,
    LineChartDataType,
    NutritionStackedBarChartDataType,
    SetReturnType,
    UserMetricsDecryptedReturnType,
    UserNutritionDecryptedReturnType,
} from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';
import { calculateWorkoutVolume, getSetsDoneBetweenDates } from '@/utils/workout';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp, useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Button, useTheme } from 'react-native-paper';

const DATE_FORMAT = 'MMM d';

type AverageWeekDataType = (ExtendedLineChartDataType & {
    endDate: string;
    startDate: string;
});

const UserMetricsCharts = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { unitSystem, weightUnit } = useUnit();
    const macroUnit = unitSystem === METRIC_SYSTEM ? GRAMS : OUNCES;
    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    const [setsChartData, setSetsChartData] = useState<null | {
        label: string;
        values: { marker: string; x: number; y: number }[];
    }>(null);
    const [weeklySets, setWeeklySets] = useState({});

    const [measurementsData, setMeasurementsData] = useState<Record<string, LineChartDataType[]>>({});
    const [measurementLabels, setMeasurementLabels] = useState<Record<string, string[]>>({});
    const [weightData, setWeightData] = useState<LineChartDataType[]>([]);
    const [fatPercentageData, setFatPercentageData] = useState<LineChartDataType[]>([]);
    const [ffmiData, setFFMIData] = useState<ExtendedLineChartDataType[]>([]);
    const [weightLabels, setWeightLabels] = useState<string[]>([]);
    const [recentWorkoutsDataLabels, setRecentWorkoutsDataLabels] = useState<string[]>([]);
    const [fatPercentageLabels, setFatPercentageLabels] = useState<string[]>([]);
    const [ffmiLabels, setFFMILabels] = useState<string[]>([]);
    const [aggregatedNutritionAndWeightData, setAggregatedNutritionAndWeightData] = useState<{
        date: string,
        nutritionData: NutritionStackedBarChartDataType,
        weightData: ExtendedLineChartDataType,
    }[]>([]);
    const [yAxisWeight, setYAxisWeight] = useState({ axisMaximum: 100, axisMinimum: 0 });
    const [yAxisFat, setYAxisFat] = useState({ axisMaximum: 100, axisMinimum: 0 });
    const [dateRange, setDateRange] = useState('30');
    const [showWeeklyAverages, setShowWeeklyAverages] = useState(false);
    const [eatingPhase, setEatingPhase] = useState<EatingPhaseType | undefined>(undefined);
    const [isAiEnabled, setIsAiEnabled] = useState(false);
    const [foodChartData, setFoodChartData] = useState<NutritionStackedBarChartDataType[]>([]);
    const [recentWorkoutsData, setRecentWorkoutsData] = useState<LineChartDataType[]>([]);
    const [foodPieData, setFoodPieData] = useState<NutritionStackedBarChartDataType[]>([]);
    const [totalCaloriesLabel, setTotalCaloriesLabel] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { showSnackbar } = useSnackbar();

    const [shouldReloadData, setShouldReloadData] = useState<number>(0);
    const [tdee, setTDEE] = useState<number>(0);
    const [ffmi, setFFMI] = useState<undefined | { ffmi: string, normalizedFFMI: string }>(undefined);
    const [averageCalories, setAverageCalories] = useState<null | number>(null);
    const [metricsAverages, setMetricsAverages] = useState<undefined | {
        averageFatPercentage: number;
        averageFatPercentageDifference: number;
        averageWeight: number;
        averageWeightDifference: number;
        fatPercentageDataPointsCount: number;
        weightDataPointsCount: number;
    }>(undefined);

    const { increaseUnreadMessages } = useUnreadMessages();
    const { checkReadIsPermitted, checkWriteIsPermitted, getHealthData, insertHealthData } = useHealthConnect();
    const { addNewChat } = useChatData();
    const { getSettingByType } = useSettings();

    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);

    const handleShowWeeklyAverages = useCallback((value: boolean) => {
        setShowWeeklyAverages(value);
        // setStartDate(undefined);
        // setEndDate(undefined);
    }, []);

    const handleSetDateRange = useCallback((value: string) => {
        setDateRange(value);
        setStartDate(undefined);
        setEndDate(undefined);
    }, []);

    const handleSetStartDate = useCallback((date: Date) => {
        setStartDate(date);
        // setShowWeeklyAverages(false);
    }, []);

    const handleSetEndDate = useCallback((date: Date) => {
        setEndDate(date);
        // setShowWeeklyAverages(false);
    }, []);

    const calculateWeeklyAverages = useCallback((
        data: UserMetricsDecryptedReturnType[],
        key: 'fatPercentage' | 'weight',
        isFfmi?: boolean,
        height?: number,
        isImperial?: boolean
    ) => {
        const weeklyAverages: AverageWeekDataType[] = [];

        const startDate = new Date(data[0].date);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);

        let currentWeek: UserMetricsDecryptedReturnType[] = [];

        data.forEach((dataPoint, index) => {
            const currentDate = new Date(dataPoint.date);

            if (currentDate <= endDate) {
                currentWeek.push(dataPoint);
            } else {
                while (currentDate > endDate) {
                    if (currentWeek.length > 0) {
                        const validDataPoints = currentWeek.filter((item) => item[key]);
                        const summedData = validDataPoints.reduce((sum, item) => {
                            if (isFfmi && height && item.weight && item.fatPercentage !== undefined) {
                                const { ffmi } = calculateFFMI(item.weight, height, item.fatPercentage, !!isImperial);
                                return sum + Number(ffmi);
                            }

                            return sum + (item[key] || 0);
                        }, 0);

                        const averageValue = summedData / validDataPoints.length;

                        if (validDataPoints.length > 0) {
                            const weekStartDate = formatDate(startDate.toISOString(), DATE_FORMAT);
                            const weekEndDate = formatDate(endDate.toISOString(), DATE_FORMAT);

                            weeklyAverages.push({
                                date: `${weekStartDate}-${weekEndDate}`,
                                endDate: weekEndDate,
                                marker: t('week_x_avg_val', {
                                    value: safeToFixed(averageValue),
                                    week: weeklyAverages.length + 1,
                                }),
                                startDate: weekStartDate,
                                x: weeklyAverages.length,
                                y: averageValue,
                            });
                        }

                        currentWeek = [];
                    }

                    startDate.setDate(startDate.getDate() + 7);
                    endDate.setDate(endDate.getDate() + 7);
                }

                currentWeek.push(dataPoint);
            }

            if (index === data.length - 1 && currentWeek.length > 0) {
                const validDataPoints = currentWeek.filter((item) => item[key]);
                const summedData = validDataPoints.reduce((sum, item) => {
                    if (isFfmi && height && item.weight && item.fatPercentage !== undefined) {
                        const { ffmi } = calculateFFMI(item.weight, height, item.fatPercentage, !!isImperial);
                        return sum + Number(ffmi);
                    }

                    return sum + (item[key] || 0);
                }, 0);

                const averageValue = summedData / validDataPoints.length;

                if (validDataPoints.length > 0) {
                    const weekStartDate = formatDate(startDate.toISOString(), DATE_FORMAT);
                    const weekEndDate = formatDate(endDate.toISOString(), DATE_FORMAT);

                    weeklyAverages.push({
                        date: `${weekStartDate}-${weekEndDate}`,
                        endDate: weekEndDate,
                        marker: t('week_x_avg_val', {
                            value: safeToFixed(averageValue),
                            week: weeklyAverages.length + 1,
                        }),
                        startDate: weekStartDate,
                        x: weeklyAverages.length,
                        y: averageValue,
                    });
                }
            }
        });

        return weeklyAverages;
    }, [t]);

    const calculateWeeklyNutritionAverages = useCallback((data: NutritionStackedBarChartDataType[]) => {
        const weeklyAverages: NutritionStackedBarChartDataType[] = [];
        let currentWeek: NutritionStackedBarChartDataType[] = [];

        data.forEach((dataPoint, index) => {
            currentWeek.push(dataPoint);

            if (currentWeek.length === 7 || index === data.length - 1) {
                const totalCarbs = currentWeek.reduce((sum, item) => sum + (item.y[0] || 0), 0) / CALORIES_IN_CARBS;
                const totalFats = currentWeek.reduce((sum, item) => sum + (item.y[1] || 0), 0) / CALORIES_IN_FAT;
                const totalProteins = currentWeek.reduce((sum, item) => sum + (item.y[2] || 0), 0) / CALORIES_IN_PROTEIN;
                const totalFibers = currentWeek.reduce((sum, item) => sum + (item.y[3] || 0), 0) / CALORIES_IN_FIBER;
                const totalCalories = currentWeek.reduce((sum, item) => sum + Number(item.totalCalories), 0);

                const daysWithNoCarbs = currentWeek.filter((item) => !item.y[0]).length;
                const daysWithNoFats = currentWeek.filter((item) => !item.y[1]).length;
                const daysWithNoProteins = currentWeek.filter((item) => !item.y[2]).length;
                const daysWithNoFibers = currentWeek.filter((item) => !item.y[3]).length;

                const averageCarbs = totalCarbs / (currentWeek.length - daysWithNoCarbs) || 0;
                const averageFats = totalFats / (currentWeek.length - daysWithNoFats) || 0;
                const averageProteins = totalProteins / (currentWeek.length - daysWithNoProteins) || 0;
                const averageFibers = totalFibers / (currentWeek.length - daysWithNoFibers) || 0;
                const averageCalories = totalCalories / currentWeek.length || 0;

                const weekStartDate = formatDate(currentWeek[0].date, DATE_FORMAT);
                const weekEndDate = formatDate(currentWeek[currentWeek.length - 1].date, DATE_FORMAT);

                weeklyAverages.push({
                    date: `${weekStartDate}-${weekEndDate}`,
                    marker: [
                        `${safeToFixed(averageCarbs)}${macroUnit}\n${t('carbs')}`,
                        `${safeToFixed(averageFats)}${macroUnit}\n${t('fats')}`,
                        `${safeToFixed(averageProteins)}${macroUnit}\n${t('proteins')}`,
                        `${safeToFixed(averageFibers)}${macroUnit}\n${t('fibers')}`,
                    ],
                    totalCalories: safeToFixed(averageCalories),
                    x: weeklyAverages.length,
                    y: [
                        averageCarbs * CALORIES_IN_CARBS,
                        averageFats * CALORIES_IN_FAT,
                        averageProteins * CALORIES_IN_PROTEIN,
                        averageFibers * CALORIES_IN_FIBER,
                    ],
                });

                currentWeek = [];
            }
        });

        return weeklyAverages;
    }, [macroUnit, t]);

    const prepareNutritionData = useCallback((data: UserNutritionDecryptedReturnType[]) => {
        const aggregatedData = aggregateNutritionData(data);

        return Object.entries(aggregatedData).map(([date, nutritionData], index) => {
            const yData = [
                nutritionData.carbohydrate * CALORIES_IN_CARBS,
                nutritionData.fat * CALORIES_IN_FAT,
                nutritionData.protein * CALORIES_IN_PROTEIN,
                nutritionData.fiber * CALORIES_IN_FIBER,
            ];

            const totalMacroCalories = yData.reduce((sum, val) => sum + val, 0);
            const calorieDifference = nutritionData.calories - totalMacroCalories;

            if (calorieDifference !== 0) {
                // Calculate the total "weight" of the macros based on their caloric contribution
                const weightSum = (CALORIES_IN_CARBS * nutritionData.carbohydrate)
                    + (CALORIES_IN_FAT * nutritionData.fat)
                    + (CALORIES_IN_PROTEIN * nutritionData.protein)
                    + (CALORIES_IN_FIBER * nutritionData.fiber);

                // Distribute the calorie difference proportionally among macros
                if (weightSum > 0) {
                    yData[0] += (calorieDifference * (CALORIES_IN_CARBS * nutritionData.carbohydrate)) / weightSum;
                    yData[1] += (calorieDifference * (CALORIES_IN_FAT * nutritionData.fat)) / weightSum;
                    yData[2] += (calorieDifference * (CALORIES_IN_PROTEIN * nutritionData.protein)) / weightSum;
                    yData[3] += (calorieDifference * (CALORIES_IN_FIBER * nutritionData.fiber)) / weightSum;
                }
            }

            return {
                date: nutritionData.date || date,
                marker: [
                    `${date}\n${(getDisplayFormattedWeight(nutritionData.carbohydrate, GRAMS, isImperial))}${macroUnit}\n${t('carbs')}`,
                    `${date}\n${(getDisplayFormattedWeight(nutritionData.fat, GRAMS, isImperial))}${macroUnit}\n${t('fats')}`,
                    `${date}\n${(getDisplayFormattedWeight(nutritionData.protein, GRAMS, isImperial))}${macroUnit}\n${t('proteins')}`,
                    `${date}\n${(getDisplayFormattedWeight(nutritionData.fiber, GRAMS, isImperial))}${macroUnit}\n${t('fibers')}`,
                ],
                // totalCalories: safeToFixed(totalMacroCalories),
                totalCalories: safeToFixed(nutritionData.calories),
                x: index,
                y: yData,
            };
        });
    }, [macroUnit, t, isImperial]);

    const aggregateNutritionAndWeightData = useCallback((
        nutritionData: NutritionStackedBarChartDataType[],
        weightData: AverageWeekDataType[] | ExtendedLineChartDataType[],
        isWeeklyAverages: boolean
    ) => {
        // Create a map of nutrition data by date
        const nutritionDataMap: { [date: string]: NutritionStackedBarChartDataType } = {};
        nutritionData.forEach((item) => {
            nutritionDataMap[formatDate(item.date, DATE_FORMAT)] = item;
        });

        // Create a map of weight data by date
        const weightDataMap: { [date: string]: ExtendedLineChartDataType } = {};
        weightData.forEach((item) => {
            weightDataMap[formatDate(item.date, DATE_FORMAT)] = item;
        });

        // Aggregate data by matching dates
        const aggregatedData = Object.keys(nutritionDataMap)
            .filter((date) => weightDataMap[date])
            .map((date, index) => ({
                date,
                nutritionData: {
                    ...nutritionDataMap[date],
                    x: index,
                },
                weightData: {
                    ...weightDataMap[date],
                    x: index,
                },
            }));

        if (isWeeklyAverages) {
            const weeklyAggregatedData: {
                date: string;
                nutritionData: NutritionStackedBarChartDataType;
                weightData: ExtendedLineChartDataType;
            }[] = [];

            let currentWeekData: {
                nutritionData: NutritionStackedBarChartDataType[];
                weightData: ExtendedLineChartDataType[];
            } = {
                nutritionData: [],
                weightData: [],
            };

            const startDate = new Date(aggregatedData[0].nutritionData.date);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);

            aggregatedData.forEach((data, index) => {
                const currentDate = new Date(data.nutritionData.date);

                if (currentDate <= endDate) {
                    currentWeekData.nutritionData.push(data.nutritionData);
                    currentWeekData.weightData.push(data.weightData);
                } else {
                    while (currentDate > endDate) {
                        if (currentWeekData.nutritionData.length > 0 || currentWeekData.weightData.length > 0) {
                            const avgNutritionData = currentWeekData.nutritionData.reduce((acc, item) => {
                                acc.y = acc.y.map((val, i) => val + item.y[i]);
                                return acc;
                            }, { ...currentWeekData.nutritionData[0], y: [0, 0, 0, 0] });

                            avgNutritionData.y = avgNutritionData.y.map((val) => val / currentWeekData.nutritionData.length);

                            const avgWeightData = currentWeekData.weightData.reduce((acc, item) => acc + item.y, 0) / currentWeekData.weightData.length;

                            weeklyAggregatedData.push({
                                date: `${formatDate(startDate.toISOString(), DATE_FORMAT)}-${formatDate(endDate.toISOString(), DATE_FORMAT)}`,
                                nutritionData: {
                                    ...avgNutritionData,
                                    x: weeklyAggregatedData.length,
                                },
                                weightData: {
                                    ...currentWeekData.weightData[0],
                                    marker: t('value_unit', {
                                        unit: weightUnit,
                                        value: safeToFixed(avgWeightData),
                                    }),
                                    x: weeklyAggregatedData.length,
                                    y: avgWeightData,
                                },
                            });

                            currentWeekData = {
                                nutritionData: [],
                                weightData: [],
                            };
                        }

                        startDate.setDate(startDate.getDate() + 7);
                        endDate.setDate(endDate.getDate() + 7);
                    }

                    currentWeekData.nutritionData.push(data.nutritionData);
                    currentWeekData.weightData.push(data.weightData);
                }

                if (index === aggregatedData.length - 1 && (currentWeekData.nutritionData.length > 0 || currentWeekData.weightData.length > 0)) {
                    const avgNutritionData = currentWeekData.nutritionData.reduce((acc, item) => {
                        acc.y = acc.y.map((val, i) => val + item.y[i]);
                        return acc;
                    }, { ...currentWeekData.nutritionData[0], y: [0, 0, 0, 0] });

                    avgNutritionData.y = avgNutritionData.y.map((val) => val / currentWeekData.nutritionData.length);

                    const avgWeightData = currentWeekData.weightData.reduce((acc, item) => acc + item.y, 0) / currentWeekData.weightData.length;

                    weeklyAggregatedData.push({
                        date: `${formatDate(startDate.toISOString(), DATE_FORMAT)}-${formatDate(endDate.toISOString(), DATE_FORMAT)}`,
                        nutritionData: {
                            ...avgNutritionData,
                            x: weeklyAggregatedData.length,
                        },
                        weightData: {
                            ...currentWeekData.weightData[0],
                            x: weeklyAggregatedData.length,
                            y: avgWeightData,
                        },
                    });
                }
            });

            return weeklyAggregatedData;
        }

        return aggregatedData;
    }, [t, weightUnit]);

    const loadUserMetricsAndNutrition = useCallback(async () => {
        // TODO: only reloads the data if the time range changes to a bigger value
        try {
            let loadedUserMetrics;
            let loadedUserNutrition;
            let recentWorkouts;
            let userMeasurements;

            if (startDate && endDate) {
                loadedUserMetrics = await getUserMetricsBetweenDates(startDate.toISOString(), endDate.toISOString());
                loadedUserNutrition = await getUserNutritionBetweenDates(startDate.toISOString(), endDate.toISOString());
                recentWorkouts = await getRecentWorkoutsBetweenDates(startDate.toISOString(), endDate.toISOString());
                userMeasurements = await getUserMeasurementsBetweenDates(startDate.toISOString(), endDate.toISOString());

                loadedUserMetrics = loadedUserMetrics
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                loadedUserNutrition = loadedUserNutrition
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                recentWorkouts = recentWorkouts
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                userMeasurements = userMeasurements
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            } else {
                const days = Number(dateRange);
                const someDaysAgo = new Date();
                someDaysAgo.setDate(someDaysAgo.getDate() - days);

                loadedUserMetrics = await getUserMetricsFromDate(someDaysAgo.toISOString());
                loadedUserNutrition = await getUserNutritionFromDate(someDaysAgo.toISOString());
                recentWorkouts = await getRecentWorkoutsFromDate(someDaysAgo.toISOString());
                userMeasurements = await getUserMeasurementsFromDate(someDaysAgo.toISOString());
            }

            // User Measurements
            const measurementsMap: Record<string, ExtendedLineChartDataType[]> = {};
            const labelsMap: Record<string, string[]> = {};

            userMeasurements.forEach((measurementData, index) => {
                const measurementDate = formatDate(measurementData.date, DATE_FORMAT);

                Object.entries(measurementData.measurements).forEach(([key, value]) => {
                    if (!measurementsMap[key]) {
                        measurementsMap[key] = [];
                        labelsMap[key] = [];
                    }

                    measurementsMap[key].push({
                        date: formatDate(measurementData.date, DATE_FORMAT),
                        marker: `${safeToFixed(Number(value))}\n${measurementDate}`,
                        x: index,
                        y: Number(value),
                    });

                    labelsMap[key].push(measurementDate);
                });
            });

            // Recent workouts
            const recentWorkoutsChartData: any[] = [];

            for (const [index, workout] of recentWorkouts.entries()) {
                const exerciseData = JSON.parse(workout?.exerciseData || '[]') as { exerciseId: number, sets: SetReturnType[] }[];

                const workoutVolume = parseFloat(workout.workoutVolume || '0') || await calculateWorkoutVolume(
                    exerciseData,
                    workout.bodyWeight || await getClosestWeightUserMetric(1, workout?.date) || 0
                ) || 0;

                recentWorkoutsChartData.push({
                    date: showWeeklyAverages ? workout.date : formatDate(workout.date, DATE_FORMAT),
                    marker: t('value_weight', { value: getDisplayFormattedWeight(workoutVolume, KILOGRAMS, isImperial), weightUnit }),
                    x: index,
                    y: getDisplayFormattedWeight(workoutVolume, KILOGRAMS, isImperial),
                });
            }

            const recentWorkoutsDataToShow = showWeeklyAverages ? calculatePastWorkoutsWeeklyAverages(recentWorkoutsChartData) : recentWorkoutsChartData;

            const filteredRecentWorkoutsData = recentWorkoutsDataToShow.filter((workout) => workout.y);

            setRecentWorkoutsData(filteredRecentWorkoutsData);
            setRecentWorkoutsDataLabels(filteredRecentWorkoutsData.map(({ date }) => date));

            // Nutrition
            const aggregatedNutritionData = prepareNutritionData(loadedUserNutrition);
            const filteredNutritionData = aggregatedNutritionData
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                // .slice(-parseInt(dateRange))
                .map((item, index) => ({
                    ...item,
                    x: index,
                }));

            const nutritionDataWithoutTotals = showWeeklyAverages ? calculateWeeklyNutritionAverages(filteredNutritionData) : filteredNutritionData;
            const nutritionDataToShow = nutritionDataWithoutTotals.map((item) => {
                return {
                    ...item,
                    date: showWeeklyAverages ? item.date : formatDate(item.date, DATE_FORMAT),
                    totalLabel: t('value_kcal', { value: item.totalCalories }),
                };
            });

            const totalCaloriesLabel = nutritionDataWithoutTotals.map(
                (item) => t('value_kcal', { value: item.totalCalories })
            );

            setTotalCaloriesLabel(totalCaloriesLabel);
            setFoodChartData(nutritionDataToShow);
            setFoodPieData(filteredNutritionData);

            // User metrics
            const sortedUserMetrics = loadedUserMetrics
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const filteredWeightMetrics = sortedUserMetrics
                .filter((metric) => metric.date && metric.weight)
                // .slice(-parseInt(dateRange))
            ;

            const filteredFatPercentageMetrics = sortedUserMetrics
                .filter((metric) => metric.date && metric.fatPercentage)
                // .slice(-parseInt(dateRange))
            ;

            const weightValues = filteredWeightMetrics.map((metric, index) => ({
                date: metric.date,
                marker: `${(getDisplayFormattedWeight(metric.weight || 0, KILOGRAMS, isImperial))}${weightUnit}\n${formatDate(metric.date, DATE_FORMAT)}`,
                x: index,
                y: getDisplayFormattedWeight(metric.weight || 0, KILOGRAMS, isImperial),
            })) as ExtendedLineChartDataType[];

            const fatPercentageValues = filteredFatPercentageMetrics.map((metric, index) => ({
                date: metric.date,
                marker: `${safeToFixed(metric.fatPercentage ?? 0)}%\n${formatDate(metric.date, DATE_FORMAT)}`,
                x: index,
                y: metric.fatPercentage || 0,
            })) as ExtendedLineChartDataType[];

            const weightDateLabels = filteredWeightMetrics.map((metric) => {
                return formatDate(metric.date, DATE_FORMAT);
            });

            const fatPercentageDateLabels = filteredFatPercentageMetrics.map((metric) => {
                return formatDate(metric.date, DATE_FORMAT);
            });

            const weightDataToShow = showWeeklyAverages ? calculateWeeklyAverages(sortedUserMetrics, 'weight') : weightValues;
            const fatPercentageDataToShow = showWeeklyAverages ? calculateWeeklyAverages(sortedUserMetrics, 'fatPercentage') : fatPercentageValues;

            if (sortedUserMetrics.length > 7) {
                const userMetricsByWeek = aggregateDataByWeek(sortedUserMetrics);

                const userMetricsByWeekWithAverages = userMetricsByWeek.map(({ data, weekEnd, weekStart }, index) => {
                    const validWeightPoints = data.filter((item) => item.weight);
                    const summedWeight = validWeightPoints.reduce((sum, item) => sum + (item.weight || 0), 0);

                    const validFatPercentagePoints = data.filter((item) => item.fatPercentage);
                    const summedFatPercentage = validFatPercentagePoints.reduce((sum, item) => sum + (item.fatPercentage || 0), 0);

                    return {
                        averageFatPercentage: summedFatPercentage ? summedFatPercentage / validFatPercentagePoints.length : undefined,
                        averageWeight: summedWeight ? summedWeight / validWeightPoints.length : undefined,
                        data,
                        weekEnd,
                        weekStart,
                    };
                });

                const weightTrend = userMetricsByWeekWithAverages.map((week, index) => {
                    if (index === 0 || !week.averageWeight || !userMetricsByWeekWithAverages[index - 1].averageWeight) {
                        return null;
                    }

                    // const [min, max] = eatingPhase === EATING_PHASES.BULKING ? BULKING_GAIN_WEIGHT_RATIO : CUTTING_LOSS_WEIGHT_RATIO;
                    return {
                        average: week.averageWeight - userMetricsByWeekWithAverages[index - 1].averageWeight!,
                        averageWeight: week.averageWeight,
                        // idealAverage: t('rate_min_max', {
                        //     max: t('value_weight', {
                        //         value: safeToFixed(week.averageWeight * max),
                        //         weightUnit: weightUnit,
                        //     }),
                        //     min: t('value_weight', {
                        //         value: safeToFixed(week.averageWeight * min),
                        //         weightUnit: weightUnit,
                        //     }),
                        // }),
                    };
                }).filter((val) => val !== null);

                const fatPercentageTrend = userMetricsByWeekWithAverages.map((week, index) => {
                    if (index === 0 || !week.averageFatPercentage || !userMetricsByWeekWithAverages[index - 1].averageFatPercentage) {
                        return null;
                    }

                    return {
                        average: week.averageFatPercentage - userMetricsByWeekWithAverages[index - 1].averageFatPercentage!,
                        averageFatPercentage: week.averageFatPercentage,
                        // idealAverage: '0.3%~0.5%',
                    };
                }).filter((val) => val !== null);

                const averageWeightDifference = weightTrend.reduce((sum, { average: val }) => sum + val, 0) / weightTrend.length;
                const averageFatPercentageDifference = fatPercentageTrend.reduce((sum, { average: val }) => sum + val, 0) / fatPercentageTrend.length;

                const averageWeight = weightTrend.reduce((sum, { averageWeight: val }) => sum + val, 0) / weightTrend.length;
                const averageFatPercentage = fatPercentageTrend.reduce((sum, { averageFatPercentage: val }) => sum + val, 0) / fatPercentageTrend.length;

                setMetricsAverages({
                    averageFatPercentage,
                    averageFatPercentageDifference,
                    averageWeight,
                    averageWeightDifference,
                    fatPercentageDataPointsCount: fatPercentageTrend.length,
                    weightDataPointsCount: weightTrend.length,
                });
            }

            const weightLabelsToShow = showWeeklyAverages ? (weightDataToShow as AverageWeekDataType[]).map(
                (data) => `${data.startDate}-${data.endDate}`
            ) : weightDateLabels;

            const fatPercentageLabelsToShow = showWeeklyAverages ? (fatPercentageDataToShow as AverageWeekDataType[]).map(
                (data) => `${data.startDate}-${data.endDate}`
            ) : fatPercentageDateLabels;

            setWeightData(weightDataToShow);
            setFatPercentageData(fatPercentageDataToShow);
            setWeightLabels(weightLabelsToShow);
            setFatPercentageLabels(fatPercentageLabelsToShow);

            setMeasurementsData(measurementsMap);
            setMeasurementLabels(labelsMap);

            const aggregatedNutritionAndWeightData = aggregateNutritionAndWeightData(
                filteredNutritionData,
                weightValues,
                showWeeklyAverages
            );

            setAggregatedNutritionAndWeightData(aggregatedNutritionAndWeightData);

            const weightMin = Math.min(...weightDataToShow.map((d) => d.y));
            const weightMax = Math.max(...weightDataToShow.map((d) => d.y));
            setYAxisWeight({
                axisMaximum: Math.round(weightMax * 1.05),
                axisMinimum: Math.round(weightMin * 0.95),
            });

            const fatMin = Math.min(...fatPercentageDataToShow.map((d) => d.y));
            const fatMax = Math.max(...fatPercentageDataToShow.map((d) => d.y));
            setYAxisFat({
                axisMaximum: Math.round(fatMax * 1.05),
                axisMinimum: Math.round(fatMin * 0.95),
            });

            // Calculate TDEE
            const aggregatedUserMetricsNutrition = aggregateUserMetricsNutrition(
                loadedUserNutrition,
                loadedUserMetrics,
                true
            );

            const {
                totalDays,
                weeklyAverages: userMetricsNutritionWeeklyAverages,
            } = calculateUserMetricsNutritionWeeklyAverages(
                aggregatedUserMetricsNutrition
            );

            // Calculate calories with reduce
            const totalCalories = userMetricsNutritionWeeklyAverages.reduce((sum, item) => sum + item.averageCalories, 0);
            const initialWeight = userMetricsNutritionWeeklyAverages?.at(0)?.averageWeight || 0;
            const finalWeight = userMetricsNutritionWeeklyAverages?.at(-1)?.averageWeight || 0;
            const initialFatPercentage = userMetricsNutritionWeeklyAverages?.at(0)?.averageFatPercentage || 0;
            const finalFatPercentage = userMetricsNutritionWeeklyAverages?.at(-1)?.averageFatPercentage || 0;

            const useFatPercentageTDEESetting = await getSettingByType(USE_FAT_PERCENTAGE_TDEE_TYPE);
            const useFatPercentageTDEE = useFatPercentageTDEESetting?.value === 'true';
            const user = await getUser();

            const tdee = calculateTDEE(
                (totalCalories / userMetricsNutritionWeeklyAverages.length) * totalDays,
                totalDays,
                initialWeight,
                finalWeight,
                useFatPercentageTDEE ? initialFatPercentage : undefined,
                useFatPercentageTDEE ? finalFatPercentage : undefined
            );

            if (user?.metrics?.height) {
                const userHeight = user.metrics.height;

                // Aggregate the user metrics by date to ensure weight and fatPercentage are combined
                const aggregatedMetrics = aggregateMetricsByDate(sortedUserMetrics) as UserMetricsDecryptedReturnType[];

                // Use the calculateWeeklyAverages function for FFMI
                const ffmiDataToShow = showWeeklyAverages
                    // TODO doesn't really matter if we use 'weight' or 'fatPercentage' here
                    ? calculateWeeklyAverages(aggregatedMetrics, 'weight', true, userHeight, isImperial)
                    : aggregatedMetrics
                        .filter((metric) => metric.weight && metric.fatPercentage)
                        .map((metric, index) => {
                            const { fatPercentage, weight } = metric;

                            const { ffmi } = calculateFFMI(weight!, userHeight, fatPercentage!, isImperial);

                            return {
                                date: metric.date,
                                marker: `${t('ffmi')}: ${safeToFixed(ffmi)}\n${formatDate(metric.date, DATE_FORMAT)}`,
                                x: index,
                                y: Number(ffmi),
                            } as ExtendedLineChartDataType;
                        });

                const ffmiDateLabels = ffmiDataToShow.map((metric) => {
                    if (showWeeklyAverages) {
                        return metric.date;
                    }

                    return formatDate(metric.date, DATE_FORMAT);
                });

                setFFMIData(ffmiDataToShow);
                setFFMILabels(ffmiDateLabels);

                const latestMetrics = aggregatedMetrics.at(-1);
                if (latestMetrics?.weight && latestMetrics?.fatPercentage && latestMetrics?.height) {
                    const ffmi = calculateFFMI(
                        latestMetrics.weight,
                        latestMetrics.height,
                        latestMetrics.fatPercentage,
                        isImperial
                    );

                    setFFMI(ffmi);
                }
            }

            setTDEE(tdee);
            setAverageCalories(totalCalories / userMetricsNutritionWeeklyAverages.length);

            const vendor = await getAiApiVendor();
            const isAiSettingsEnabled = await getSettingByType(AI_SETTINGS_TYPE);
            const hasAiEnabled = Boolean(vendor) && isAiSettingsEnabled?.value === 'true';
            setIsAiEnabled(hasAiEnabled);

            // TODO: also aggragate by week if toggle is on
            const setsDoneThisWeek = await (
                (startDate && endDate)
                    ? getSetsDoneBetweenDates(startDate.toISOString(), endDate.toISOString())
                    : getSetsDoneBetweenDates(getDaysAgoTimestampISOString(Number(dateRange)), getCurrentTimestampISOString())
            );

            setWeeklySets(setsDoneThisWeek);

            const weeklySetsEntries = Object.entries(setsDoneThisWeek);
            const weeklySetsData = weeklySetsEntries.map(([_, sets], index) => ({
                marker: `${sets} sets`,
                x: index,
                y: sets as number,
            }));

            setSetsChartData({
                label: t('sets_per_muscle'),
                values: weeklySetsData,
            });

            if (user?.metrics?.eatingPhase) {
                setEatingPhase(user.metrics.eatingPhase);
            }
        } catch (error) {
            console.error('Failed to load user metrics:', error);
        }
    }, [
        calculateWeeklyNutritionAverages,
        aggregateNutritionAndWeightData,
        calculateWeeklyAverages,
        prepareNutritionData,
        showWeeklyAverages,
        getSettingByType,
        weightUnit,
        isImperial,
        dateRange,
        startDate,
        endDate,
        t,
    ]);

    useFocusEffect(
        useCallback(() => {
            const loadData = async () => {
                setIsLoading(true);

                // this hack is necessary so that the UI can update before the async operation
                await new Promise((resolve) => setTimeout(async (data) => {
                    await loadUserMetricsAndNutrition();
                    return resolve(data);
                }, 1));

                setIsLoading(false);
            };

            loadData();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [
            showWeeklyAverages,
            shouldReloadData,
            dateRange,
        ])
    );

    useEffect(() => {
        if ((startDate && endDate) || (!startDate && !endDate)) {
            setShouldReloadData(Date.now());
        }
    }, [startDate, endDate]);

    const handleSyncHealthConnect = useCallback(async () => {
        setIsLoading(true);

        await syncHealthConnectData(
            checkReadIsPermitted,
            checkWriteIsPermitted,
            insertHealthData,
            getStartOfDayTimestampISOString(startDate?.toISOString() || getDaysAgoTimestampISOString(30)),
            getEndOfDayTimestampISOString(endDate?.toISOString() || getCurrentTimestampISOString()),
            1000
        );

        await loadUserMetricsAndNutrition();
        setIsLoading(false);
    }, [checkReadIsPermitted, checkWriteIsPermitted, insertHealthData, startDate, endDate, loadUserMetricsAndNutrition]);

    const foodLabels = [t('carbs'), t('fats'), t('proteins'), t('fibers')];
    const yAxisFood = useMemo(() => {
        return {
            axisMaximum: Math.round(Math.max(...foodChartData.flatMap(
                (d) => d.y.reduce((acc, val) => acc + val, 0)
            )) * 1.2),
            axisMinimum: 0,
        };
    }, [foodChartData]);

    const totalNutrition = useMemo(() => {
        const total = { carbs: 0, fats: 0, fibers: 0, proteins: 0 };

        foodPieData.forEach(({ y }) => {
            total.carbs += y[0] || 0;
            total.fats += y[1] || 0;
            total.proteins += y[2] || 0;
            total.fibers += y[3] || 0;
        });

        return total;
    }, [foodPieData]);

    const pieChartData = useMemo(() => {
        const carbsValue = totalNutrition.carbs / foodChartData.length;
        const fatsValue = totalNutrition.fats / foodChartData.length;
        const proteinsValue = totalNutrition.proteins / foodChartData.length;
        const fibersValue = totalNutrition.fibers / foodChartData.length;

        return [{
            color: colors.quaternaryContainer,
            label: t('carbs_kcal'),
            marker: `${(getDisplayFormattedWeight(carbsValue / CALORIES_IN_CARBS, GRAMS, isImperial))}${macroUnit}`,
            value: carbsValue,
        },
        {
            color: colors.secondaryContainer,
            label: t('fats_kcal'),
            marker: `${(getDisplayFormattedWeight(fatsValue / CALORIES_IN_FAT, GRAMS, isImperial))}${macroUnit}`,
            value: fatsValue,
        },
        {
            color: colors.primary,
            label: t('proteins_kcal'),
            marker: `${(getDisplayFormattedWeight(proteinsValue / CALORIES_IN_PROTEIN, GRAMS, isImperial))}${macroUnit}`,
            value: proteinsValue,
        },
        {
            color: colors.tertiaryContainer,
            label: t('fibers_kcal'),
            marker: `${(getDisplayFormattedWeight(fibersValue / CALORIES_IN_FIBER, GRAMS, isImperial))}${macroUnit}`,
            value: fibersValue,
        }];
    },
    [
        colors.quaternaryContainer,
        colors.secondaryContainer,
        colors.tertiaryContainer,
        totalNutrition.proteins,
        totalNutrition.fibers,
        totalNutrition.carbs,
        foodChartData.length,
        totalNutrition.fats,
        colors.primary,
        isImperial,
        macroUnit,
        t,
    ]
    );

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                navigation.navigate('profile');
                return true;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => {
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            };
        }, [navigation])
    );

    const handleGetAiInsights = useCallback(() => {
        setIsLoading(true);
        const days = Number(dateRange);
        const someDaysAgo = new Date();
        someDaysAgo.setDate(someDaysAgo.getDate() - days);

        setTimeout(async () => {
            try {
                setIsLoading(false);
                const message = await getNutritionInsights(
                    (startDate || someDaysAgo).toISOString(),
                    (endDate || new Date()).toISOString()
                );

                if (message) {
                    await addNewChat({
                        // remove quotes
                        message: message.replace(/^"([^"]+)"$/, '$1'),
                        misc: '',
                        sender: 'assistant',
                        type: 'text',
                    });
                    increaseUnreadMessages(1);
                    showSnackbar(t('your_trainer_answered'), t('see_message'), () => navigation.navigate('chat'));
                } else {
                    showSnackbar(t('failed_to_get_ai_insights'), t('retry'), handleGetAiInsights);
                }
            } catch (error) {
                console.error('Failed to get AI insights:', error);
                showSnackbar(t('failed_to_get_ai_insights'), t('retry'), handleGetAiInsights);
            }
        }, 500);
    }, [dateRange, startDate, endDate, addNewChat, increaseUnreadMessages, showSnackbar, t, navigation]);

    const fabActions = useMemo(() => {
        const actions = [{
            icon: () => <FontAwesome5 color={colors.primary} name="database" size={FAB_ICON_SIZE} />,
            label: t('manage_metrics'),
            onPress: () => navigation.navigate('listUserMetrics'),
            style: { backgroundColor: colors.surface },
        },
        {
            icon: () => <FontAwesome5 color={colors.primary} name="database" size={FAB_ICON_SIZE} />,
            label: t('manage_nutrition'),
            onPress: () => navigation.navigate('listUserNutrition'),
            style: { backgroundColor: colors.surface },
        },
        {
            icon: () => <FontAwesome5 color={colors.primary} name="database" size={FAB_ICON_SIZE} />,
            label: t('list_user_measurements'),
            onPress: () => navigation.navigate('listUserMeasurements'),
            style: { backgroundColor: colors.surface },
        },
        {
            icon: () => <FontAwesome5 color={colors.primary} name="sync" size={FAB_ICON_SIZE} />,
            label: t('sync_health_connect'),
            onPress: handleSyncHealthConnect,
            style: { backgroundColor: colors.surface },
        }];

        if (isAiEnabled) {
            actions.unshift({
                icon: () => <FontAwesome5 color={colors.primary} name="brain" size={ICON_SIZE} />,
                label: t('get_progression_insights'),
                onPress: handleGetAiInsights,
                style: { backgroundColor: colors.surface },
            });
        }

        return actions;
    }, [colors.primary, colors.surface, handleGetAiInsights, handleSyncHealthConnect, navigation, isAiEnabled, t]);

    // TODO one day do this
    // return (
    //     <UserFitnessReport
    //         aggregatedNutritionAndWeightData={aggregatedNutritionAndWeightData}
    //         fatPercentageData={fatPercentageData}
    //         fatPercentageLabels={fatPercentageLabels}
    //         foodChartData={foodChartData}
    //         foodLabels={foodLabels}
    //         metricsAverages={metricsAverages}
    //         period={Number(dateRange)}
    //         showWeeklyAverages={showWeeklyAverages}
    //         stackedMacrosYAxisConfig={yAxisFood}
    //         totalCaloriesLabel={totalCaloriesLabel}
    //         weightData={weightData}
    //         weightLabels={weightLabels}
    //         yAxisFat={yAxisFat}
    //         yAxisWeight={yAxisWeight}
    //     />
    // );

    return (
        <Screen style={styles.container}>
            <FABWrapper actions={fabActions} icon="cog" visible>
                <View style={styles.container}>
                    <Appbar.Header
                        mode="small"
                        statusBarHeight={0}
                        style={styles.appbarHeader}
                    >
                        <Appbar.Content title={t('user_metrics_charts')} titleStyle={styles.appbarTitle} />
                        <Button
                            mode="outlined"
                            onPress={() => navigation.navigate('profile')}
                            textColor={colors.onPrimary}
                        >
                            {t('back')}
                        </Button>
                    </Appbar.Header>
                    <Filters
                        aggregatedValuesLabel={t('weekly_averages')}
                        endDate={endDate}
                        setEndDate={handleSetEndDate}
                        setShowAggregatedValues={handleShowWeeklyAverages}
                        setStartDate={handleSetStartDate}
                        setTimeRange={handleSetDateRange}
                        showAggregatedValues={showWeeklyAverages}
                        showDateRange
                        startDate={startDate}
                        timeRange={dateRange}
                    />
                    <ScrollView contentContainerStyle={styles.scrollViewContainer} style={styles.scrollView}>
                        {fatPercentageData.length > 0 ? (
                            <LineChart
                                data={fatPercentageData}
                                granularity={showWeeklyAverages ? 1 : 3}
                                labelLeftMargin={-42}
                                labels={fatPercentageLabels}
                                title={t('fat_percentage')}
                                xAxisLabel={t('date')}
                                yAxis={yAxisFat}
                                yAxisLabel={t('fat_percentage')}
                            />
                        ) : null}
                        {weightData.length > 0 ? (
                            <WeightLineChart
                                metricsAverages={metricsAverages}
                                showWeeklyAverages={showWeeklyAverages}
                                weightData={weightData}
                                weightLabels={weightLabels}
                                yAxisConfig={yAxisWeight}
                            />
                        ) : null}
                        {ffmiData.length > 0 ? (
                            <LineChart
                                data={ffmiData}
                                granularity={showWeeklyAverages ? 1 : 3}
                                labelLeftMargin={-42}
                                labels={ffmiLabels}
                                title={t('ffmi')}
                                xAxisLabel={t('date')}
                                yAxis={{
                                    axisMaximum: Math.round(Math.max(...ffmiData.map((d) => d.y)) * 1.05),
                                    axisMinimum: Math.round(Math.min(...ffmiData.map((d) => d.y)) * 0.95),
                                }}
                                yAxisLabel={t('ffmi')}
                            />
                        ) : null}
                        {foodChartData.length > 0 ? (
                            <NutritionDetailedChart
                                aggregatedNutritionAndWeightData={aggregatedNutritionAndWeightData}
                                averageCalories={averageCalories}
                                ffmi={ffmi}
                                foodChartData={foodChartData}
                                foodLabels={foodLabels}
                                isLastChart={recentWorkoutsData.length === 0}
                                pieChartData={pieChartData}
                                showWeeklyAverages={showWeeklyAverages}
                                stackedMacrosYAxisConfig={yAxisFood}
                                tdee={tdee}
                                totalCaloriesLabel={totalCaloriesLabel}
                                weightData={weightData}
                            />
                        ) : null}
                        {(!showWeeklyAverages && setsChartData) ? (
                            <BarChart
                                data={[setsChartData]}
                                granularity={1}
                                labelLeftMargin={-30}
                                labels={Object.keys(weeklySets).map((group) => t(`muscle_groups.${group}`))}
                                padding={16}
                                shareButtonPosition="bottom"
                                showShareImageButton={true}
                                title={t('sets')}
                                xAxisLabel={t('muscle_groups_text')}
                                yAxis={{
                                    axisMaximum: Math.round(Math.max(...setsChartData.values.map((d) => d.y)) * 1.2),
                                    axisMinimum: 0,
                                }}
                                yAxisLabel={t('sets')}
                            />
                        ) : null}
                        {recentWorkoutsData.length > 0 ? (
                            <LineChart
                                data={recentWorkoutsData}
                                granularity={showWeeklyAverages ? 1 : 3}
                                labelLeftMargin={-42}
                                labels={recentWorkoutsDataLabels}
                                shareButtonPosition="top"
                                title={t('recent_workouts')}
                                xAxisLabel={t('date')}
                                yAxis={{
                                    axisMaximum: Math.round(Math.max(...recentWorkoutsData.map((d) => d.y)) * 1.2),
                                    axisMinimum: Math.round(Math.min(...recentWorkoutsData.map((d) => d.y)) * 0.5),
                                }}
                                yAxisLabel={t('workout_volume')}
                            />
                        ) : null}
                        {Object.keys(measurementsData).map((measurementKey) => (
                            <LineChart
                                data={measurementsData[measurementKey]}
                                granularity={showWeeklyAverages ? 1 : 3}
                                key={measurementKey}
                                labels={measurementLabels[measurementKey]}
                                title={t(measurementKey)}
                                xAxisLabel={t('date')}
                                yAxis={{
                                    axisMaximum: Math.round(Math.max(...measurementsData[measurementKey].map((d) => d.y)) * 1.2),
                                    axisMinimum: Math.round(Math.min(...measurementsData[measurementKey].map((d) => d.y)) * 0.8),
                                }}
                                yAxisLabel={t(measurementKey)}
                            />
                        ))}
                    </ScrollView>
                    {isLoading && (
                        <View style={styles.overlay}>
                            <ActivityIndicator color={colors.primary} size="large" />
                        </View>
                    )}
                </View>
            </FABWrapper>
        </Screen>
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
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        backgroundColor: addTransparency(colors.background, 0.5),
        flex: 1,
        justifyContent: 'center',
    },
    scrollView: {
        marginHorizontal: 16,
    },
    scrollViewContainer: {
        alignItems: 'center',
        paddingVertical: 16,
    },
});

export default UserMetricsCharts;
