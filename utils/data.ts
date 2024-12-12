import { NUTRITION_TYPES } from '@/constants/nutrition';
import i18n from '@/lang/lang';
import { formatDate, getCurrentTimestampISOString } from '@/utils/date';
import { generateHash, safeToFixed } from '@/utils/string';
import {
    AggregatedUserMetricsNutritionType,
    ExtendedLineChartDataType,
    UserMetricsDecryptedReturnType,
    UserNutritionDecryptedReturnType,
} from '@/utils/types';
import { endOfWeek, formatISO, parseISO, startOfWeek } from 'date-fns';

const CALORIES_STORED_KG_FAT = 7730;
const CALORIES_BUILD_KG_FAT = 8840;
const CALORIES_STORED_KG_MUSCLE = 1250;
const CALORIES_BUILD_KG_MUSCLE = 3900;

const DATE_FORMAT = 'MMM d';

export const calculateTDEE = (
    totalCalories: number,
    totalDays: number,
    initialWeight: number,
    finalWeight: number,
    initialFatPercentage?: number,
    finalFatPercentage?: number
) => {
    const weightDifference = finalWeight - initialWeight;

    let fatDifference = weightDifference * (weightDifference < 0 ? 0.75 : 0.5);
    let muscleDifference = weightDifference * (weightDifference < 0 ? 0.25 : 0.5);

    if (initialFatPercentage !== undefined && finalFatPercentage !== undefined) {
        const initialFat = (initialFatPercentage * initialWeight) / 100;
        const finalFat = (finalFatPercentage * finalWeight) / 100;

        fatDifference = finalFat - initialFat;
        muscleDifference = weightDifference - fatDifference;
    }

    const muscleCalories = muscleDifference > 0 ? (muscleDifference * CALORIES_BUILD_KG_MUSCLE) : (muscleDifference * CALORIES_STORED_KG_MUSCLE);
    const fatCalories = fatDifference > 0 ? (fatDifference * CALORIES_BUILD_KG_FAT) : (fatDifference * CALORIES_STORED_KG_FAT);

    return (totalCalories - (fatCalories + muscleCalories)) / totalDays;
};

export const calculateFFMI = (
    weight: number,
    height: number,
    bodyFatPercentage: number,
    isImperial: boolean
) => {
    // Convert height and weight to metric if necessary
    const metricWeight = isImperial ? weight * 0.453592 : weight;
    const metricHeight = isImperial ? height * 0.3048 : height;

    // Calculate fat-free mass
    const fatFreeMass = metricWeight * (1 - (bodyFatPercentage / 100));

    // Calculate FFMI
    const ffmi = fatFreeMass / (metricHeight * metricHeight);

    // Calculate normalized FFMI
    const normalizedFFMI = ffmi + 6.1 * (1.8 - metricHeight);

    return {
        ffmi: safeToFixed(ffmi),
        normalizedFFMI: safeToFixed(normalizedFFMI),
    };
};

export const aggregateNutritionData = (
    data: UserNutritionDecryptedReturnType[],
    formatStr: string = 'MMM d'
) => {
    return data.reduce((acc, curr) => {
        const date = formatDate(curr.createdAt || getCurrentTimestampISOString(), formatStr);

        if (curr.type === NUTRITION_TYPES.FULL_DAY) {
            acc[date] = {
                calories: curr.calories || 0,
                carbohydrate: curr.carbohydrate || 0,
                date: curr.createdAt,
                fat: curr.fat || 0,
                fiber: curr.fiber || 0,
                foods: [curr.name],
                protein: curr.protein || 0,
            };

            return acc;
        }

        if (acc[date] && acc[date].type === NUTRITION_TYPES.FULL_DAY) {
            return acc;
        }

        if (!acc[date]) {
            acc[date] = {
                calories: 0,
                carbohydrate: 0,
                date: curr.createdAt,
                fat: 0,
                fiber: 0,
                foods: [],
                protein: 0,
            };
        }

        acc[date].calories += curr.calories || 0;
        acc[date].fiber += curr.fiber || 0;
        acc[date].carbohydrate += curr.carbohydrate || 0;
        acc[date].fat += curr.fat || 0;
        acc[date].protein += curr.protein || 0;
        acc[date].foods.push(curr.name);

        return acc;
    }, {} as {
        [key: string]: {
            calories: number,
            carbohydrate: number,
            date: string | undefined;
            fat: number,
            fiber: number;
            foods: string[];
            protein: number,
            type?: string,
        }
    });
};

export const isEmptyObject = (obj: any) => {
    return Object.keys(obj).length === 0;
};

export const isTrendingUpwards = (data: { x: number, y: number }[]) => {
    let totalChange = 0;

    for (let i = 1; i < data.length; i++) {
        totalChange += (data[i].y || 0) - (data[i - 1].y || 0);
    }

    return totalChange > 0;
};

export const aggregateMetricsByDate = (metrics: UserMetricsDecryptedReturnType[]) => {
    const aggregatedMetrics: {
        [date: string]: { fatPercentage?: number; weight?: number };
    } = {};

    metrics.forEach((metric) => {
        const dateKey = metric.date;
        if (!aggregatedMetrics[dateKey]) {
            aggregatedMetrics[dateKey] = {
                ...metric,
            };
        }

        if (metric.weight) {
            aggregatedMetrics[dateKey].weight = metric.weight;
        }

        if (metric.fatPercentage) {
            aggregatedMetrics[dateKey].fatPercentage = metric.fatPercentage;
        }
    });

    return Object.entries(aggregatedMetrics).map(([date, values]) => ({
        date,
        ...values,
    }));
};

type AggregatedWeeklyData = {
    data: UserMetricsDecryptedReturnType[];
    weekEnd: string;
    weekStart: string;
};

type WeeklyAveragesReturnType = {
    totalDays: number;
    weeklyAverages: WeeklyAveragesType[];
};

type WeeklyAveragesType = {
    averageCalories: number;
    averageCarbs: number;
    averageFatPercentage: number;
    averageFats: number;
    averageProteins: number;
    averageWeight: number;
    weekEndDate: string;
    weekStartDate: string;
};

export function aggregateDataByWeek(data: UserMetricsDecryptedReturnType[]): AggregatedWeeklyData[] {
    const weeksMap = new Map<string, UserMetricsDecryptedReturnType[]>();

    data.forEach((entry) => {
        const parsedDate = parseISO(entry.date);
        const weekStart = startOfWeek(parsedDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(parsedDate, { weekStartsOn: 1 });

        const weekKey = `${formatISO(weekStart)}_${formatISO(weekEnd)}`;

        if (!weeksMap.has(weekKey)) {
            weeksMap.set(weekKey, []);
        }

        weeksMap.get(weekKey)?.push(entry);
    });

    return Array.from(weeksMap.entries()).map(([weekKey, entries]) => {
        const [weekStart, weekEnd] = weekKey.split('_');

        return {
            data: entries,
            weekEnd,
            weekStart,
        };
    });
}

export function aggregateUserMetricsNutrition(
    nutritionData: UserNutritionDecryptedReturnType[],
    metricsData: UserMetricsDecryptedReturnType[],
    skipCurrentDay = false
): AggregatedUserMetricsNutritionType {
    const aggregatedData: AggregatedUserMetricsNutritionType = {};

    // Get today's date in the same format used by the data
    const today = formatDate((new Date()).toISOString(), DATE_FORMAT);

    // Process nutrition data
    nutritionData
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach((nutrition) => {
            const date = formatDate(nutrition.date, DATE_FORMAT);

            // Skip if the current day is to be skipped and the date is today
            if (skipCurrentDay && date === today) {
                return;
            }

            if (!aggregatedData[date]) {
                aggregatedData[date] = {
                    dataId: generateHash(), // create a unique id for the data
                    date,
                    source: nutrition.source,
                    totalCalories: 0,
                    totalCarbs: 0,
                    totalFats: 0,
                    totalProteins: 0,
                };
            }

            aggregatedData[date].totalCalories += nutrition.calories || 0;
            aggregatedData[date].totalCarbs += nutrition.carbohydrate || 0;
            aggregatedData[date].totalProteins += nutrition.protein || 0;
            aggregatedData[date].totalFats += nutrition.fat || 0;
        });

    // Process metrics data
    metricsData
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach((metrics) => {
            const date = formatDate(metrics.date, DATE_FORMAT);

            // Skip if the current day is to be skipped and the date is today
            if (skipCurrentDay && date === today) {
                return;
            }

            if (!aggregatedData[date]) {
                aggregatedData[date] = {
                    dataId: generateHash(),
                    date,
                    source: metrics.source,
                    totalCalories: 0,
                    totalCarbs: 0,
                    totalFats: 0,
                    totalProteins: 0,
                };
            }

            aggregatedData[date] = {
                ...aggregatedData[date],
                ...metrics,
                date,
            };
        });

    return aggregatedData;
}

export function calculateUserMetricsNutritionWeeklyAverages(
    aggregatedUserMetricsNutrition: AggregatedUserMetricsNutritionType
    // timeRange: number,
): WeeklyAveragesReturnType {
    const weeklyAverages: WeeklyAveragesType[] = [];
    let currentWeek: (AggregatedUserMetricsNutritionType[keyof AggregatedUserMetricsNutritionType])[] = [];

    const filteredUserMetricsNutrition = Object.values(aggregatedUserMetricsNutrition).filter(
        (data) => data.weight !== undefined
    );

    const sortedData = filteredUserMetricsNutrition
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        // .slice(-timeRange)
    ;

    // Check if we have less than 10 days of data
    if (sortedData.length < 10) {
        // Aggregate by day
        sortedData.forEach((data) => {
            const { date, fatPercentage, totalCalories, totalCarbs, totalFats, totalProteins, weight } = data;

            weeklyAverages.push({
                averageCalories: totalCalories,
                averageCarbs: totalCarbs,
                averageFatPercentage: fatPercentage || 0,
                averageFats: totalFats,
                averageProteins: totalProteins,
                averageWeight: weight || 0,
                weekEndDate: date,
                weekStartDate: date,
            });
        });

        return {
            totalDays: sortedData.length,
            weeklyAverages,
        };
    }

    // Continue with the weekly aggregation as before
    sortedData.forEach((data, index) => {
        currentWeek.push(data);

        if (currentWeek.length === 7 || index === sortedData.length - 1) {
            const totalWeight = currentWeek.reduce((sum, item) => sum + item.weight!, 0);
            const totalFatPercentage = currentWeek.reduce((sum, item) => sum + item.fatPercentage!, 0);

            const daysWithNoWeight = currentWeek.filter((item) => (Number(item.weight) || 0) <= 0).length;
            const daysWithNoFatPercentage = currentWeek.filter((item) => (Number(item.fatPercentage) || 0) <= 0).length;

            if (currentWeek.length === daysWithNoWeight || currentWeek.length === daysWithNoFatPercentage) {
                currentWeek = [];
                return;
            }

            const totalCalories = currentWeek.reduce((sum, item) => sum + item.totalCalories, 0);
            const totalCarbs = currentWeek.reduce((sum, item) => sum + item.totalCarbs, 0);
            const totalProteins = currentWeek.reduce((sum, item) => sum + item.totalProteins, 0);
            const totalFats = currentWeek.reduce((sum, item) => sum + item.totalFats, 0);

            const averageCalories = totalCalories / currentWeek.length;
            const averageCarbs = totalCarbs / currentWeek.length;
            const averageProteins = totalProteins / currentWeek.length;
            const averageFats = totalFats / currentWeek.length;
            const averageWeight = totalWeight / (currentWeek.length - daysWithNoWeight);
            const averageFatPercentage = totalFatPercentage / (currentWeek.length - daysWithNoFatPercentage);

            const weekStartDate = currentWeek[0].date;
            const weekEndDate = currentWeek[currentWeek.length - 1].date;

            weeklyAverages.push({
                averageCalories,
                averageCarbs,
                averageFatPercentage,
                averageFats,
                averageProteins,
                averageWeight,
                weekEndDate,
                weekStartDate,
            });

            currentWeek = [];
        }
    });

    return {
        totalDays: sortedData.length,
        weeklyAverages,
    };
}

export const calculatePastWorkoutsWeeklyAverages = (data: ExtendedLineChartDataType[]) => {
    if (data.length === 0) {
        return [];
    }

    const weeklyAverages: ExtendedLineChartDataType[] = [];
    let currentWeek: ExtendedLineChartDataType[] = [];

    const startDate = new Date(data[0].date);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    data.forEach((dataPoint, index) => {
        const currentDate = new Date(dataPoint.date);

        if (currentDate <= endDate) {
            currentWeek.push(dataPoint);
        } else {
            // Process the current week
            if (currentWeek.length > 0) {
                const summedData = currentWeek.reduce((sum, item) => sum + (item.y || 0), 0);
                const daysWithNoData = currentWeek.filter((item) => !item.y).length;
                const averageVolume = summedData / (currentWeek.length - daysWithNoData);

                const weekStartDate = formatDate(startDate.toISOString(), DATE_FORMAT);
                const weekEndDate = formatDate(endDate.toISOString(), DATE_FORMAT);

                weeklyAverages.push({
                    date: `${weekStartDate}-${weekEndDate}`,
                    marker: i18n.t('week_x_avg_val', {
                        value: safeToFixed(averageVolume),
                        week: weeklyAverages.length + 1,
                    }),
                    x: weeklyAverages.length,
                    y: averageVolume,
                });
            }

            currentWeek = [];

            // Advance to the next week
            while (currentDate > endDate) {
                startDate.setDate(startDate.getDate() + 7);
                endDate.setDate(endDate.getDate() + 7);
            }

            currentWeek.push(dataPoint);
        }

        // Handle the last data point
        if (index === data.length - 1 && currentWeek.length > 0) {
            const summedData = currentWeek.reduce((sum, item) => sum + (item.y || 0), 0);
            const daysWithNoData = currentWeek.filter((item) => !item.y).length;
            const averageVolume = summedData / (currentWeek.length - daysWithNoData);

            const weekStartDate = formatDate(startDate.toISOString(), DATE_FORMAT);
            const weekEndDate = formatDate(endDate.toISOString(), DATE_FORMAT);

            weeklyAverages.push({
                date: `${weekStartDate}-${weekEndDate}`,
                marker: i18n.t('week_x_avg_val', {
                    value: safeToFixed(averageVolume),
                    week: weeklyAverages.length + 1,
                }),
                x: weeklyAverages.length,
                y: averageVolume,
            });
        }
    });

    return weeklyAverages;
};

type MacrosToNormalize = {
    carbs: number;
    fat: number;
    grams?: number;
    kcal: number;
    kj?: number;
    protein: number;
};

const KCAL_KJ_RATIO = 4.184;

const DEFAULT_GRAMS = 100;

export const convertKcalToKj = (kcal: number): number => {
    return kcal * KCAL_KJ_RATIO;
};

export const convertKjToKcal = (kj: number): number => {
    return kj / KCAL_KJ_RATIO;
};

export const normalizeMacrosByGrams = (macros: MacrosToNormalize): MacrosToNormalize => {
    const servingSize = macros.grams || DEFAULT_GRAMS;
    const multiplier = DEFAULT_GRAMS / servingSize;

    return {
        ...macros,
        carbs: macros.carbs * multiplier,
        fat: macros.fat * multiplier,
        grams: DEFAULT_GRAMS,
        kcal: macros.kcal * multiplier,
        kj: macros.kj ? macros.kj * multiplier : convertKcalToKj(macros.kcal),
        protein: macros.protein * multiplier,
    };
};

export const calculateBMR = (
    weight: number,
    height: number,
    age: number,
    gender: string
) => {
    let bmr;
    if (gender === 'male') {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    return bmr;
};
