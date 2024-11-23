import BarChart from '@/components/Charts/BarChart';
import CustomCombinedChart from '@/components/Charts/CustomCombinedChart';
import LineChart from '@/components/Charts/LineChart';
import StackedBarChart from '@/components/Charts/StackedBarChart';
import WeightLineChart from '@/components/Charts/WeightLineChart';
import { CALORIES_IN_CARBS, CALORIES_IN_FAT, CALORIES_IN_PROTEIN } from '@/constants/healthConnect';
import { GRAMS, IMPERIAL_SYSTEM, METRIC_SYSTEM, OUNCES } from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { safeToFixed } from '@/utils/string';
import { ExtendedLineChartDataType, LineChartDataType, NutritionStackedBarChartDataType } from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

type UserFitnessReportProps = {
    aggregatedNutritionAndWeightData: {
        date: string,
        nutritionData: NutritionStackedBarChartDataType,
        weightData: ExtendedLineChartDataType,
    }[];
    fatPercentageData: LineChartDataType[];
    fatPercentageLabels: string[];
    foodChartData: NutritionStackedBarChartDataType[];
    foodLabels: string[];
    metricsAverages: undefined | {
        averageFatPercentage: number;
        averageFatPercentageDifference: number;
        averageWeight: number;
        averageWeightDifference: number;
        fatPercentageDataPointsCount: number;
        weightDataPointsCount: number;
    };
    period: number;
    showWeeklyAverages: boolean;
    stackedMacrosYAxisConfig: {
        axisMaximum: number,
        axisMinimum: number
    };
    totalCaloriesLabel: string[];
    weightData: LineChartDataType[];
    weightLabels: string[];
    yAxisFat: { axisMaximum: number, axisMinimum: number };
    yAxisWeight: { axisMaximum: number, axisMinimum: number };
};

const UserFitnessReport = ({
    aggregatedNutritionAndWeightData,
    fatPercentageData,
    fatPercentageLabels,
    foodChartData,
    foodLabels,
    metricsAverages,
    period,
    showWeeklyAverages,
    stackedMacrosYAxisConfig,
    totalCaloriesLabel,
    weightData,
    weightLabels,
    yAxisFat,
    yAxisWeight,
}: UserFitnessReportProps) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { unitSystem } = useUnit();
    const macroUnit = unitSystem === METRIC_SYSTEM ? GRAMS : OUNCES;
    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>
                {t('fitness_report', { period })}
            </Text>
            <View style={styles.chartContainer}>
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
            </View>
            <View style={styles.chartContainer}>
                {weightData.length > 0 ? (
                    <WeightLineChart
                        metricsAverages={metricsAverages}
                        showWeeklyAverages={showWeeklyAverages}
                        weightData={weightData}
                        weightLabels={weightLabels}
                        yAxisConfig={yAxisWeight}
                    />
                ) : null}
            </View>
            <View style={styles.chartContainer}>
                {aggregatedNutritionAndWeightData.length > 0 ? (
                    <CustomCombinedChart
                        barData={[{
                            label: t('calories'),
                            values: aggregatedNutritionAndWeightData.map((data) => {
                                const { nutritionData: item } = data;
                                const totalCalories = item.y.reduce((sum, val) => sum + val, 0);

                                return {
                                    marker: `${t('value_kcal', { value: safeToFixed(totalCalories) })}`,
                                    x: item.x,
                                    y: totalCalories,
                                };
                            }),
                        }]}
                        granularity={showWeeklyAverages ? 1 : 3}
                        labels={aggregatedNutritionAndWeightData.map((d) => d.date)}
                        lineData={[{
                            label: t('weight', { weightUnit: macroUnit }),
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
                            leftAxisMaximum: Math.max(...foodChartData.map((d) => d.y.reduce((sum, val) => sum + val, 0))) * 1.05,
                            leftAxisMinimum: 0,
                            rightAxisMaximum: Math.max(...weightData.map((d) => d.y)) * 1.05,
                            rightAxisMinimum: Math.min(...weightData.map((d) => d.y)) * 0.95,
                        }}
                        yAxisLabel={t('weight_and_calories')}
                    />
                ) : null}
            </View>
            <View style={styles.chartContainer}>
                {foodChartData.length > 0 ? (
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
            </View>
            <View style={styles.chartContainer}>
                {foodChartData.length > 0 ? (
                    <BarChart
                        data={[{
                            label: t('total_daily_calories'),
                            values: foodChartData.map((data) => {
                                const totalCalories = data.y.reduce((sum, val) => sum + val, 0);
                                return {
                                    marker: t('value_kcal', { value: safeToFixed(totalCalories) }),
                                    x: data.x,
                                    y: totalCalories,
                                };
                            }),
                        }]}
                        granularity={showWeeklyAverages ? 1 : 3}
                        labelLeftMargin={-48}
                        labels={foodChartData.map((d) => d.date)}
                        title={t('total_daily_calories')}
                        xAxisLabel={t('date')}
                        yAxis={{
                            axisMaximum: Math.round(Math.max(...foodChartData.map((d) => d.y.reduce((sum, val) => sum + val, 0))) * 1.2),
                            axisMinimum: 0,
                        }}
                        yAxisLabel={t('total_daily_calories')}
                    />
                ) : null}
            </View>
            <View style={styles.chartContainer}>
                {foodChartData.length > 0 ? (
                    <CustomCombinedChart
                        barData={[{
                            label: t('total_daily_calories'),
                            values: foodChartData.map((data) => {
                                const totalCalories = data.y.reduce((sum, val) => sum + val, 0);
                                return {
                                    marker: `${safeToFixed(totalCalories)} kcal`,
                                    x: data.x,
                                    y: totalCalories,
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
                            leftAxisMaximum: Math.round(Math.max(...foodChartData.map((d) => d.y.reduce((sum, val) => sum + val, 0))) * 1.05),
                            leftAxisMinimum: 0,
                            rightAxisMaximum: Math.round(Math.max(...foodChartData.map((d) => d.y[0] / CALORIES_IN_CARBS)) * 1.2),
                            rightAxisMinimum: Math.round(Math.min(...foodChartData.map((d) => d.y[0] / CALORIES_IN_CARBS)) * 0.5),
                        }}
                        yAxisLabel={`${t('total_daily_calories')} / ${t('grams')}`}
                    />
                ) : null}
            </View>
            <View style={styles.chartContainer}>
                {foodChartData.length > 0 ? (
                    <CustomCombinedChart
                        barData={[{
                            label: t('total_daily_calories'),
                            values: foodChartData.map((data) => {
                                const totalCalories = data.y.reduce((sum, val) => sum + val, 0);
                                return {
                                    marker: `${safeToFixed(totalCalories)} kcal`,
                                    x: data.x,
                                    y: totalCalories,
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
                            leftAxisMaximum: Math.round(Math.max(...foodChartData.map((d) => d.y.reduce((sum, val) => sum + val, 0))) * 1.05),
                            leftAxisMinimum: 0,
                            rightAxisMaximum: Math.round(Math.max(...foodChartData.map((d) => d.y[1] / CALORIES_IN_FAT)) * 1.2),
                            rightAxisMinimum: Math.round(Math.min(...foodChartData.map((d) => d.y[1] / CALORIES_IN_FAT)) * 0.5),
                        }}
                        yAxisLabel={`${t('total_daily_calories')} / ${t('grams')}`}
                    />
                ) : null}
            </View>
            <View style={styles.chartContainer}>
                {foodChartData.length > 0 ? (
                    <CustomCombinedChart
                        barData={[{
                            label: t('total_daily_calories'),
                            values: foodChartData.map((data) => {
                                const totalCalories = data.y.reduce((sum, val) => sum + val, 0);
                                return {
                                    marker: `${safeToFixed(totalCalories)} kcal`,
                                    x: data.x,
                                    y: totalCalories,
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
                            leftAxisMaximum: Math.round(Math.max(...foodChartData.map((d) => d.y.reduce((sum, val) => sum + val, 0))) * 1.05),
                            leftAxisMinimum: 0,
                            rightAxisMaximum: Math.round(Math.max(...foodChartData.map((d) => d.y[2] / CALORIES_IN_PROTEIN)) * 1.2),
                            rightAxisMinimum: Math.round(Math.min(...foodChartData.map((d) => d.y[2] / CALORIES_IN_PROTEIN)) * 0.5),
                        }}
                        yAxisLabel={`${t('total_daily_calories')} / ${t('grams')}`}
                    />
                ) : null}
            </View>
        </ScrollView>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    chartContainer: {
        marginBottom: 16,
    },
    container: {
        backgroundColor: colors.background,
        flexGrow: 1,
        padding: 16,
    },
    title: {
        color: colors.onBackground,
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
    },
});

export default UserFitnessReport;
