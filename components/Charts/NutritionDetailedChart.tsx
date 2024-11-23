import BarChart from '@/components/Charts/BarChart';
import CustomCombinedChart from '@/components/Charts/CustomCombinedChart';
import PieChart from '@/components/Charts/PieChart';
import StackedBarChart from '@/components/Charts/StackedBarChart';
import CustomPicker from '@/components/CustomPicker';
import { CALORIES_IN_CARBS, CALORIES_IN_FAT, CALORIES_IN_FIBER, CALORIES_IN_PROTEIN } from '@/constants/healthConnect';
import { GRAMS, IMPERIAL_SYSTEM, METRIC_SYSTEM, OUNCES } from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { isTrendingUpwards } from '@/utils/data';
import { getUser } from '@/utils/database';
import { safeToFixed } from '@/utils/string';
import {
    EatingPhaseType,
    ExtendedLineChartDataType,
    LineChartDataType,
    NutritionStackedBarChartDataType,
} from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

type NutritionDetailedChartProps = {
    aggregatedNutritionAndWeightData: {
        date: string,
        nutritionData: NutritionStackedBarChartDataType,
        weightData: ExtendedLineChartDataType,
    }[],
    averageCalories: null | number,
    ffmi: undefined | { ffmi: string, normalizedFFMI: string },
    foodChartData: NutritionStackedBarChartDataType[],
    foodLabels: string[],
    isLastChart: boolean,
    pieChartData: {
        color: string,
        label: string,
        marker: string,
        value: number,
    }[],
    showWeeklyAverages: boolean,
    stackedMacrosYAxisConfig: {
        axisMaximum: number,
        axisMinimum: number
    },
    tdee: number,
    totalCaloriesLabel: string[],
    weightData: LineChartDataType[],
};

const NutritionDetailedChart = ({
    aggregatedNutritionAndWeightData,
    averageCalories,
    ffmi,
    foodChartData,
    foodLabels,
    isLastChart = false,
    pieChartData,
    showWeeklyAverages,
    stackedMacrosYAxisConfig,
    tdee,
    totalCaloriesLabel,
    weightData,
}: NutritionDetailedChartProps) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { unitSystem, weightUnit } = useUnit();
    const macroUnit = unitSystem === METRIC_SYSTEM ? GRAMS : OUNCES;
    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    const [eatingPhase, setEatingPhase] = useState<EatingPhaseType | undefined>(undefined);
    const [nutritionChartType, setNutritionChartType] = useState<string>(weightData.length > 0 ? 'combined' : 'stacked');

    useFocusEffect(useCallback(() => {
        const fetchUser = async () => {
            const user = await getUser();
            if (user?.metrics?.eatingPhase) {
                setEatingPhase(user.metrics.eatingPhase);
            }
        };

        fetchUser();
    }, []));

    const weightTrendUpwards = useMemo(() => {
        return isTrendingUpwards(weightData);
    }, [weightData]);

    return (
        <>
            <CustomPicker
                items={[
                    weightData.length > 0 ? { label: t('weight_and_calories'), value: 'combined' } : null,
                    { label: t('stacked'), value: 'stacked' },
                    { label: t('calories'), value: 'calories' },
                    { label: t('carbs'), value: 'carbs' },
                    { label: t('proteins'), value: 'proteins' },
                    { label: t('fats'), value: 'fats' },
                    { label: t('fibers'), value: 'fibers' },
                ].filter((item) => item !== null)}
                // label={t('nutrition_chart_type')}
                onValueChange={setNutritionChartType}
                selectedValue={nutritionChartType}
                wrapperStyle={{ marginTop: 8 }}
            />
            {nutritionChartType === 'combined' ? (
                <CustomCombinedChart
                    barData={[{
                        label: t('calories'),
                        values: aggregatedNutritionAndWeightData.map((data) => {
                            const { nutritionData: item } = data;

                            return {
                                marker: `${t('value_kcal', { value: item.totalCalories })}`,
                                x: item.x,
                                y: Number(item.totalCalories),
                            };
                        }),
                    }]}
                    granularity={showWeeklyAverages ? 1 : 3}
                    labels={aggregatedNutritionAndWeightData.map((d) => d.date)}
                    lineData={[{
                        label: t('weight', { weightUnit }),
                        values: aggregatedNutritionAndWeightData.map((data) => {
                            const { weightData: item } = data;

                            return {
                                marker: item.marker,
                                x: item.x,
                                y: item.y,
                            };
                        }),
                    }]}
                    title={t('weight_and_calories')}
                    xAxisLabel={t('date')}
                    yAxis={{
                        leftAxisMaximum: Math.round(Math.max(
                            ...aggregatedNutritionAndWeightData.map(({ nutritionData }) => Number(nutritionData.totalCalories))
                        ) * 1.05),
                        leftAxisMinimum: 0,
                        rightAxisMaximum: Math.round(Math.max(...aggregatedNutritionAndWeightData.map(({ weightData }) => weightData.y)) * 1.05),
                        rightAxisMinimum: Math.round(Math.min(...aggregatedNutritionAndWeightData.map(({ weightData }) => weightData.y)) * 0.95),
                    }}
                    yAxisLabel={t('weight_and_calories')}
                />
            ) : null}
            {nutritionChartType === 'stacked' ? (
                <StackedBarChart
                    data={foodChartData}
                    granularity={showWeeklyAverages ? 1 : 3}
                    labels={foodChartData.map((d) => d.date)}
                    secondaryLabels={totalCaloriesLabel}
                    stackLabels={foodLabels}
                    title={t('daily_calorie_distribution')}
                    xAxisLabel={t('date')}
                    yAxis={stackedMacrosYAxisConfig}
                    yAxisLabel={t('calories')}
                />
            ) : null}
            {nutritionChartType === 'calories' ? (
                <BarChart
                    data={[{
                        label: t('total_daily_calories'),
                        values: foodChartData.map((data) => {
                            return {
                                marker: t('value_kcal', { value: data.totalCalories }),
                                x: data.x,
                                y: Number(data.totalCalories),
                            };
                        }),
                    }]}
                    granularity={showWeeklyAverages ? 1 : 3}
                    labelLeftMargin={-48}
                    labels={foodChartData.map((d) => d.date)}
                    title={t('total_daily_calories')}
                    xAxisLabel={t('date')}
                    yAxis={{
                        axisMaximum: Math.round(Math.max(
                            ...foodChartData.map((data) => Number(data.totalCalories))
                        ) * 1.1),
                        axisMinimum: 0,
                    }}
                    yAxisLabel={t('total_daily_calories')}
                />
            ) : null}
            {nutritionChartType === 'carbs' ? (
                <CustomCombinedChart
                    barData={[{
                        label: t('total_daily_calories'),
                        values: foodChartData.map((data) => {
                            return {
                                marker: t('value_kcal', { value: data.totalCalories }),
                                x: data.x,
                                y: Number(data.totalCalories),
                            };
                        }),
                    }]}
                    granularity={showWeeklyAverages ? 1 : 3}
                    labelLeftMargin={-70}
                    labels={foodChartData.map((d) => d.date)}
                    lineData={[{
                        label: `${t('carbs')} (${macroUnit})`,
                        values: foodChartData.map((data) => ({
                            marker: `${getDisplayFormattedWeight(data.y[0] / CALORIES_IN_CARBS, GRAMS, isImperial)}${macroUnit}`,
                            x: data.x,
                            y: data.y[0] / CALORIES_IN_CARBS,
                        })),
                    }]}
                    title={t('carbs')}
                    xAxisLabel={t('date')}
                    yAxis={{
                        leftAxisMaximum: Math.round(Math.max(
                            ...foodChartData.map((data) => Number(data.totalCalories))
                        ) * 1.05),
                        leftAxisMinimum: 0,
                        rightAxisMaximum: Math.round(Math.max(...foodChartData.map((d) => d.y[0] / CALORIES_IN_CARBS)) * 1.2),
                        rightAxisMinimum: Math.round(Math.min(...foodChartData.map((d) => d.y[0] / CALORIES_IN_CARBS)) * 0.5),
                    }}
                    yAxisLabel={`${t('total_daily_calories')} / ${t('grams')}`}
                />
            ) : null}
            {nutritionChartType === 'fibers' ? (
                <CustomCombinedChart
                    barData={[{
                        label: t('total_daily_calories'),
                        values: foodChartData.map((data) => {
                            return {
                                marker: t('value_kcal', { value: data.totalCalories }),
                                x: data.x,
                                y: Number(data.totalCalories),
                            };
                        }),
                    }]}
                    granularity={showWeeklyAverages ? 1 : 3}
                    labelLeftMargin={-70}
                    labels={foodChartData.map((d) => d.date)}
                    lineData={[{
                        label: `${t('fibers')} (${macroUnit})`,
                        values: foodChartData.map((data) => ({
                            marker: `${getDisplayFormattedWeight(data.y[3] / CALORIES_IN_FIBER, GRAMS, isImperial)}${macroUnit}`,
                            x: data.x,
                            y: data.y[3] / CALORIES_IN_FIBER,
                        })),
                    }]}
                    title={t('fibers')}
                    xAxisLabel={t('date')}
                    yAxis={{
                        leftAxisMaximum: Math.round(Math.max(
                            ...foodChartData.map((data) => Number(data.totalCalories))
                        ) * 1.05),
                        leftAxisMinimum: 0,
                        rightAxisMaximum: Math.round(Math.max(...foodChartData.map((d) => d.y[3] / CALORIES_IN_FIBER)) * 1.2),
                        rightAxisMinimum: Math.round(Math.min(...foodChartData.map((d) => d.y[3] / CALORIES_IN_FIBER)) * 0.5),
                    }}
                    yAxisLabel={`${t('total_daily_calories')} / ${t('grams')}`}
                />
            ) : null}
            {nutritionChartType === 'fats' ? (
                <CustomCombinedChart
                    barData={[{
                        label: t('total_daily_calories'),
                        values: foodChartData.map((data) => {
                            return {
                                marker: t('value_kcal', { value: data.totalCalories }),
                                x: data.x,
                                y: Number(data.totalCalories),
                            };
                        }),
                    }]}
                    granularity={showWeeklyAverages ? 1 : 3}
                    labelLeftMargin={-70}
                    labels={foodChartData.map((d) => d.date)}
                    lineData={[{
                        label: `${t('fats')} (${macroUnit})`,
                        values: foodChartData.map((data) => ({
                            marker: `${getDisplayFormattedWeight(data.y[1] / CALORIES_IN_FAT, GRAMS, isImperial)}${macroUnit}`,
                            x: data.x,
                            y: data.y[1] / CALORIES_IN_FAT,
                        })),
                    }]}
                    title={t('fats')}
                    xAxisLabel={t('date')}
                    yAxis={{
                        leftAxisMaximum: Math.round(Math.max(
                            ...foodChartData.map((data) => Number(data.totalCalories))
                        ) * 1.05),
                        leftAxisMinimum: 0,
                        rightAxisMaximum: Math.round(Math.max(...foodChartData.map((d) => d.y[1] / CALORIES_IN_FAT)) * 1.2),
                        rightAxisMinimum: Math.round(Math.min(...foodChartData.map((d) => d.y[1] / CALORIES_IN_FAT)) * 0.5),
                    }}
                    yAxisLabel={`${t('total_daily_calories')} / ${t('grams')}`}
                />
            ) : null}
            {nutritionChartType === 'proteins' ? (
                <CustomCombinedChart
                    barData={[{
                        label: t('total_daily_calories'),
                        values: foodChartData.map((data) => {
                            return {
                                marker: t('value_kcal', { value: data.totalCalories }),
                                x: data.x,
                                y: Number(data.totalCalories),
                            };
                        }),
                    }]}
                    granularity={showWeeklyAverages ? 1 : 3}
                    labelLeftMargin={-70}
                    labels={foodChartData.map((d) => d.date)}
                    lineData={[{
                        label: `${t('proteins')} (${macroUnit})`,
                        values: foodChartData.map((data) => ({
                            marker: `${getDisplayFormattedWeight(data.y[2] / CALORIES_IN_PROTEIN, GRAMS, isImperial)}${macroUnit}`,
                            x: data.x,
                            y: data.y[2] / CALORIES_IN_PROTEIN,
                        })),
                    }]}
                    title={t('proteins')}
                    xAxisLabel={t('date')}
                    yAxis={{
                        leftAxisMaximum: Math.round(Math.max(
                            ...foodChartData.map((data) => Number(data.totalCalories))
                        ) * 1.05),
                        leftAxisMinimum: 0,
                        rightAxisMaximum: Math.round(Math.max(...foodChartData.map((d) => d.y[2] / CALORIES_IN_PROTEIN)) * 1.2),
                        rightAxisMinimum: Math.round(Math.min(...foodChartData.map((d) => d.y[2] / CALORIES_IN_PROTEIN)) * 0.5),
                    }}
                    yAxisLabel={`${t('total_daily_calories')} / ${t('grams')}`}
                />
            ) : null}
            {averageCalories && tdee > 0 ? (
                <View style={styles.insightsContainer}>
                    <Text style={styles.insightsTitle}>
                        {t('your_tdee')}
                    </Text>
                    <Text style={styles.insightsValue}>
                        {t('value_kcal_day', { value: safeToFixed(tdee) })}
                    </Text>
                    <Text style={styles.insightsTitle}>
                        {t('average_calories')}
                    </Text>
                    <Text style={styles.insightsValue}>
                        {t('value_kcal_day', {
                            value: safeToFixed(averageCalories),
                        })}
                    </Text>
                    <Text style={styles.eatingPhaseInsightTitle}>
                        {weightTrendUpwards ? t('your_weight_is_trending_upwards') : t('your_weight_is_trending_downwards')}
                    </Text>
                    {eatingPhase ? (
                        <Text style={styles.eatingPhaseInsight}>
                            {
                                eatingPhase === 'bulking' ? (
                                    weightTrendUpwards ? t('since_bulking_good_job') : t('since_bulking_eat_more')
                                ) : (
                                    weightTrendUpwards ? t('since_cutting_eat_less') : t('since_cutting_good_job')
                                )
                            }
                        </Text>
                    ) : null}
                    {ffmi ? (
                        <View style={styles.ffmiContainer}>
                            <Text style={styles.ffmiTitle}>
                                {t('your_ffmi')}
                            </Text>
                            <Text style={styles.ffmiValue}>
                                {t('item_value', { item: t('ffmi'), value: ffmi.ffmi })}
                            </Text>
                            {ffmi.ffmi !== ffmi.normalizedFFMI ? (
                                <>
                                    <Text style={styles.ffmiTitle}>
                                        {t('your_normalized_ffmi')}
                                    </Text>
                                    <Text style={styles.ffmiValue}>
                                        {t('item_value', { item: t('ffmi'), value: ffmi.normalizedFFMI })}
                                    </Text>
                                </>
                            ) : null}
                        </View>
                    ) : null}
                </View>
            ) : null}
            <PieChart
                backgroundColor={colors.surface}
                data={pieChartData}
                shareButtonPosition={isLastChart ? 'top' : 'bottom'}
                title={t('average_nutrition_distribution')}
            />
        </>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    eatingPhaseInsight: {
        color: colors.onBackground,
        fontSize: 14,
        textAlign: 'center',
    },
    eatingPhaseInsightTitle: {
        color: colors.onBackground,
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    ffmiContainer: {
        alignItems: 'center',
        marginTop: 16,
    },
    ffmiTitle: {
        color: colors.onBackground,
        fontSize: 18,
        fontWeight: 'bold',
    },
    ffmiValue: {
        color: colors.onBackground,
        fontSize: 24,
    },
    insightsContainer: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        marginVertical: 8,
        padding: 16,
        width: '100%',
    },
    insightsTitle: {
        color: colors.onBackground,
        fontSize: 18,
        fontWeight: 'bold',
    },
    insightsValue: {
        color: colors.onBackground,
        fontSize: 24,
    },
});

export default NutritionDetailedChart;
