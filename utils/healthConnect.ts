import type { NutritionRecord } from 'react-native-health-connect/src/types/records.types';

import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { EATING_PHASES, MEAL_TYPE, NUTRITION_TYPES } from '@/constants/nutrition';
import { READ_HEALTH_CONNECT_TYPE, LAST_TIME_APP_USED } from '@/constants/storage';
import { LAST_RUN_KEY } from '@/constants/tasks';
import {
    checkIsHealthConnectedPermitted,
    getHealthConnectData,
    HealthConnectContextValue,
} from '@/storage/HealthConnectProvider';
import {
    addOrUpdateSetting,
    addUserMetrics,
    addUserNutrition,
    deleteHealthConnectUserMetricsBetweenDates,
    deleteHealthConnectUserNutritionBetweenDates,
    getAllUserNutritionBySource,
    getUser,
    updateUserNutrition,
} from '@/utils/database';
import { isValidDateParam } from '@/utils/date';
import { generateHash } from '@/utils/string';
import {
    HealthConnectBodyFatRecordData,
    HealthConnectHeightRecord,
    HealthConnectWeightRecord,
    UserMetricsInsertType,
} from '@/utils/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const combineHeightAndWeightHealthData = async (
    bodyFatRecords?: HealthConnectBodyFatRecordData[],
    weightRecords?: HealthConnectWeightRecord[]
) => {
    const combined: UserMetricsInsertType[] = [];

    const fatMap = (bodyFatRecords || []).reduce((acc, record) => {
        const date = record.time.split('T')[0];
        acc[date as string] = {
            createdAt: record.time,
            dataId: record.metadata.id,
            date: record.time,
            fatPercentage: record.percentage,
            source: USER_METRICS_SOURCES.HEALTH_CONNECT,
        };

        return acc;
    }, {} as { [key: string]: UserMetricsInsertType });

    const weightMap = (weightRecords || []).reduce((acc, record) => {
        const date = record.time.split('T')[0];
        acc[date as string] = {
            createdAt: record.time,
            dataId: record.metadata.id,
            date: record.time,
            source: USER_METRICS_SOURCES.HEALTH_CONNECT,
            weight: record.weight.inKilograms,
        };

        return acc;
    }, {} as { [key: string]: UserMetricsInsertType });

    // Combine the maps
    const allDates = new Set([
        ...Object.keys(fatMap),
        ...Object.keys(weightMap),
    ]);

    allDates.forEach((date) => {
        if (fatMap[date] && weightMap[date]) {
            combined.push({
                createdAt: fatMap[date].createdAt,
                dataId: fatMap[date].dataId,
                date: fatMap[date].date,
                fatPercentage: fatMap[date].fatPercentage,
                source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                weight: weightMap[date].weight,
            });
        } else if (fatMap[date]) {
            combined.push(fatMap[date]);
        } else if (weightMap[date]) {
            combined.push(weightMap[date]);
        }
    });

    return combined;
};

export const getLatestHealthConnectData = async () => {
    if (Platform.OS === 'web') {
        return;
    }

    const now = new Date();
    const hours = now.getHours();

    const lastRunDate = await AsyncStorage.getItem(LAST_RUN_KEY);
    const lastTimeUsed = await AsyncStorage.getItem(LAST_TIME_APP_USED);
    const today = new Date().toISOString()
        .split('T')[0];

    if (hours >= 5 && (!lastRunDate || lastRunDate !== today)) {
        // await scheduleNextWorkout();

        const isPermitted = await checkIsHealthConnectedPermitted('read');
        if (!isPermitted) {
            await AsyncStorage.setItem(LAST_RUN_KEY, today);
            await addOrUpdateSetting({
                type: READ_HEALTH_CONNECT_TYPE,
                value: 'false',
            });

            return;
        }

        const lastTimeUsedDate = new Date(isValidDateParam(lastTimeUsed) ? lastTimeUsed : today);
        const daysSinceLastUse = Math.round(Math.abs(now.getTime() - lastTimeUsedDate.getTime()) / (1000 * 60 * 60 * 24));

        const healthData = await getHealthConnectData(daysSinceLastUse + 1);
        if (healthData) {
            const latestHeight = healthData?.heightRecords?.[0];
            const latestWeight = healthData?.weightRecords?.[0];
            const latestBodyFat = healthData?.bodyFatRecords?.[0];

            const aggregatedData = aggregateUserNutritionMetricsDataByDate(
                latestHeight,
                latestWeight,
                latestBodyFat
            );

            const user = await getUser();
            for (const [date, healthData] of Object.entries(aggregatedData)) {
                await addUserMetrics({
                    dataId: healthData.bodyFatData?.metadata?.id
                        || healthData.heightData?.metadata?.id
                        || healthData.weightData?.metadata?.id
                        || generateHash(),
                    date,
                    eatingPhase: user?.metrics?.eatingPhase || EATING_PHASES.MAINTENANCE,
                    fatPercentage: healthData.bodyFatData?.percentage || 0,
                    height: healthData.heightData?.height?.inMeters || 0,
                    source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                    weight: healthData.weightData?.weight?.inKilograms || 0,
                });
            }

            if (healthData.nutritionRecords) {
                for (const nutrition of healthData.nutritionRecords) {
                    await addUserNutrition({
                        calories: nutrition.energy?.inKilocalories || 0,
                        carbohydrate: nutrition.totalCarbohydrate?.inGrams || 0,
                        createdAt: nutrition.startTime,
                        dataId: nutrition?.metadata?.id || generateHash(),
                        date: nutrition.startTime,
                        fat: nutrition?.totalFat?.inGrams || 0,
                        fiber: nutrition?.dietaryFiber?.inGrams || 0,
                        monounsaturatedFat: nutrition?.monounsaturatedFat?.inGrams || 0,
                        name: nutrition?.name || '',
                        polyunsaturatedFat: nutrition?.polyunsaturatedFat?.inGrams || 0,
                        protein: nutrition?.protein?.inGrams || 0,
                        saturatedFat: nutrition?.saturatedFat?.inGrams || 0,
                        source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                        sugar: nutrition?.sugar?.inGrams || 0,
                        transFat: nutrition?.transFat?.inGrams || 0,
                        type: NUTRITION_TYPES.MEAL,
                        unsaturatedFat: nutrition?.unsaturatedFat?.inGrams || 0,
                    });
                }
            }

            await AsyncStorage.setItem(LAST_RUN_KEY, today);
        }
    }
};

export function aggregateUserNutritionMetricsDataByDate(
    latestHeight: HealthConnectHeightRecord | undefined,
    latestWeight: HealthConnectWeightRecord | undefined,
    latestBodyFat: HealthConnectBodyFatRecordData | undefined
) {
    const extractDate = (dateTime: string) => dateTime.split('T')[0];

    // Initialize the aggregated data object
    const aggregatedData: {
        [key: string]: {
            bodyFatData?: HealthConnectBodyFatRecordData;
            heightData?: HealthConnectHeightRecord;
            weightData?: HealthConnectWeightRecord;
        };
    } = {};

    // Aggregate height data
    if (latestHeight) {
        const heightDate = extractDate(latestHeight.time);
        aggregatedData[heightDate] = aggregatedData[heightDate] || {};
        aggregatedData[heightDate].heightData = latestHeight;
    }

    // Aggregate weight data
    if (latestWeight) {
        const weightDate = extractDate(latestWeight.time);
        aggregatedData[weightDate] = aggregatedData[weightDate] || {};
        aggregatedData[weightDate].weightData = latestWeight;
    }

    // Aggregate body fat data
    if (latestBodyFat) {
        const bodyFatDate = extractDate(latestBodyFat.time);
        aggregatedData[bodyFatDate] = aggregatedData[bodyFatDate] || {};
        aggregatedData[bodyFatDate].bodyFatData = latestBodyFat;
    }

    return aggregatedData;
}

export const syncHealthConnectData = async (
    checkReadIsPermitted: HealthConnectContextValue['checkReadIsPermitted'],
    checkWriteIsPermitted: HealthConnectContextValue['checkWriteIsPermitted'],
    getHealthData: HealthConnectContextValue['getHealthData'],
    insertHealthData: HealthConnectContextValue['insertHealthData']
) => {
    const user = await getUser();
    const isReadPermitted = await checkReadIsPermitted(['BodyFat', 'Weight', 'Nutrition']);
    if (isReadPermitted) {
        const dataPointsCount = 1000;
        const healthData = await getHealthData(dataPointsCount, ['BodyFat', 'Weight', 'Nutrition']);

        const combinedData = await combineHeightAndWeightHealthData(
            healthData.bodyFatRecords,
            healthData.weightRecords
        );

        const currentHealthConnectDates = [
            ...(healthData.nutritionRecords?.map((n) => n.startTime) || []),
            ...(healthData.weightRecords?.map((n) => n.time) || []),
            ...combinedData.map((d) => d.date),
            ...combinedData.map((d) => d.createdAt),
        ].filter((date) => date) as string[];

        // TODO: maybe simply get last 30 days of data
        if (currentHealthConnectDates.length > 0) {
            // Sort dates in ascending order
            currentHealthConnectDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

            // Get the first and last date
            const startDate = currentHealthConnectDates[0];
            const endDate = currentHealthConnectDates[currentHealthConnectDates.length - 1];

            // Delete all existing Health Connect data in the date range
            await deleteHealthConnectUserNutritionBetweenDates(startDate, endDate);
            await deleteHealthConnectUserMetricsBetweenDates(startDate, endDate);
        }

        if (healthData?.nutritionRecords?.length) {
            for (const nutrition of healthData.nutritionRecords) {
                await addUserNutrition({
                    calories: nutrition.energy?.inKilocalories || 0,
                    carbohydrate: nutrition.totalCarbohydrate?.inGrams || 0,
                    createdAt: nutrition.startTime,
                    dataId: nutrition?.metadata?.id || generateHash(),
                    date: nutrition.startTime,
                    fat: nutrition?.totalFat?.inGrams || 0,
                    fiber: nutrition?.dietaryFiber?.inGrams || 0,
                    monounsaturatedFat: nutrition?.monounsaturatedFat?.inGrams || 0,
                    name: nutrition?.name || '',
                    polyunsaturatedFat: nutrition?.polyunsaturatedFat?.inGrams || 0,
                    protein: nutrition?.protein?.inGrams || 0,
                    saturatedFat: nutrition?.saturatedFat?.inGrams || 0,
                    source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                    sugar: nutrition?.sugar?.inGrams || 0,
                    transFat: nutrition?.transFat?.inGrams || 0,
                    type: NUTRITION_TYPES.MEAL,
                    unsaturatedFat: nutrition?.unsaturatedFat?.inGrams || 0,
                    mealType: nutrition.mealType || 0,
                });
            }
        }

        for (const data of combinedData) {
            await addUserMetrics({
                createdAt: data.createdAt,
                dataId: data.dataId,
                date: data.date,
                // TODO: get eating phase from that date
                eatingPhase: user?.metrics?.eatingPhase || EATING_PHASES.MAINTENANCE,
                fatPercentage: data.fatPercentage,
                height: data.height,
                source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                weight: data.weight,
            });
        }
    }

    const isWritePermitted = await checkWriteIsPermitted(['Nutrition']);
    if (isWritePermitted) {
        const userNutritions = await getAllUserNutritionBySource(USER_METRICS_SOURCES.USER_INPUT);

        // console.log(`Adding ${userNutritions.length} userNutritions to Health Connect`);
        for (const userNutrition of userNutritions) {
            const nutritionRecord: NutritionRecord = {
                startTime: userNutrition.date || new Date().toISOString(),
                endTime: new Date((new Date()).getTime() + 10000).toISOString(),
                mealType: userNutrition?.mealType || MEAL_TYPE.UNKNOWN,
                energy: {
                    value: userNutrition.calories || 0,
                    unit: 'kilocalories',
                },
                protein: {
                    value: userNutrition.protein || 0,
                    unit: 'grams',
                },
                totalCarbohydrate: {
                    value: userNutrition.carbohydrate || 0,
                    unit: 'grams',
                },
                totalFat: {
                    value: userNutrition.fat || 0,
                    unit: 'grams',
                },
                dietaryFiber: {
                    value: userNutrition.fiber || 0,
                    unit: 'grams',
                },
                sugar: {
                    value: userNutrition.sugar || 0,
                    unit: 'grams',
                },
                name: userNutrition.name,
                recordType: 'Nutrition',
            };

            try {
                const results = await insertHealthData([nutritionRecord]);
                if (results[0]) {
                    await updateUserNutrition(userNutrition.id, {
                        ...userNutrition,
                        source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                        dataId: results[0],
                    });
                }
            } catch (error) {
                console.error(`Failed to insert health data for userNutri ID ${userNutrition.id}:`, error);
            }
        }
    }
};