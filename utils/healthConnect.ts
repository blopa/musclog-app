import type { NutritionRecord } from 'react-native-health-connect/src/types/records.types';

import { DEFAULT_PAGE_SIZE, USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { EATING_PHASES, MEAL_TYPE, NUTRITION_TYPES } from '@/constants/nutrition';
import { LAST_TIME_APP_USED, READ_HEALTH_CONNECT_TYPE } from '@/constants/storage';
import { LAST_HEALTH_CONNECT_SYNC_TIME } from '@/constants/tasks';
import {
    checkIsHealthConnectedPermitted,
    getHealthConnectData,
    HealthConnectContextValue,
} from '@/storage/HealthConnectProvider';
import {
    addOrUpdateSetting,
    addUserMetrics,
    addUserNutrition,
    addUserNutritions,
    deleteHealthConnectUserMetricsBetweenDates,
    deleteHealthConnectUserNutritionBetweenDates,
    getAllUserNutritionBySource,
    getUser,
    updateUserNutrition,
} from '@/utils/database';
import { getCurrentTimestampISOString, getDaysAgoTimestampISOString, isValidDateParam } from '@/utils/date';
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

    const lastRunDate = await AsyncStorage.getItem(LAST_HEALTH_CONNECT_SYNC_TIME);
    const lastTimeUsed = await AsyncStorage.getItem(LAST_TIME_APP_USED);
    const today = getCurrentTimestampISOString()
        .split('T')[0];

    if (hours >= 5 && (!lastRunDate || lastRunDate !== today)) {
        // await scheduleNextWorkout();

        const isPermitted = await checkIsHealthConnectedPermitted('read');
        if (!isPermitted) {
            await AsyncStorage.setItem(LAST_HEALTH_CONNECT_SYNC_TIME, today);
            await addOrUpdateSetting({
                type: READ_HEALTH_CONNECT_TYPE,
                value: 'false',
            });

            return;
        }

        const lastTimeUsedDate = new Date(isValidDateParam(lastTimeUsed) ? lastTimeUsed : today);
        const daysSinceLastUse = Math.round(Math.abs(now.getTime() - lastTimeUsedDate.getTime()) / (1000 * 60 * 60 * 24));

        const startTime = getDaysAgoTimestampISOString(daysSinceLastUse);
        const endTime = getCurrentTimestampISOString();

        const healthData = await getHealthConnectData(startTime, endTime, daysSinceLastUse + 1);
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

            await AsyncStorage.setItem(LAST_HEALTH_CONNECT_SYNC_TIME, today);
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
    insertHealthData: HealthConnectContextValue['insertHealthData'],
    startTime: string,
    endTime: string,
    pageSize = DEFAULT_PAGE_SIZE
) => {
    const user = await getUser();
    const isReadPermitted = await checkReadIsPermitted(['BodyFat', 'Weight', 'Nutrition']);
    if (isReadPermitted) {
        const healthData = await getHealthConnectData(startTime, endTime, pageSize, ['BodyFat', 'Weight', 'Nutrition']);

        const combinedData = await combineHeightAndWeightHealthData(
            healthData.bodyFatRecords,
            healthData.weightRecords
        );

        const currentHealthConnectNutritionDates = [
            ...(healthData.nutritionRecords?.map((n) => n.startTime) || []),
        ].filter((date) => date) as string[];

        const currentHealthConnectMetricsDates = [
            ...(healthData.weightRecords?.map((n) => n.time) || []),
            ...combinedData.map((d) => d.date),
            ...combinedData.map((d) => d.createdAt),
        ].filter((date) => date) as string[];

        if (currentHealthConnectNutritionDates.length > 0) {
            // Sort dates in ascending order
            currentHealthConnectNutritionDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
            currentHealthConnectMetricsDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

            // Get the first and last date
            const nutritionStartDate = currentHealthConnectNutritionDates[0];
            const nutritionEndDate = currentHealthConnectNutritionDates[currentHealthConnectNutritionDates.length - 1];

            const metricsStartDate = currentHealthConnectMetricsDates[0];
            const metricsEndDate = currentHealthConnectMetricsDates[currentHealthConnectMetricsDates.length - 1];

            // Delete all existing Health Connect data in the date range
            await deleteHealthConnectUserNutritionBetweenDates(nutritionStartDate, nutritionEndDate);
            await deleteHealthConnectUserMetricsBetweenDates(metricsStartDate, metricsEndDate);
        }

        if (healthData?.nutritionRecords?.length) {
            const userNutritions = healthData.nutritionRecords.map((nutrition) => ({
                calories: nutrition.energy?.inKilocalories || 0,
                carbohydrate: nutrition.totalCarbohydrate?.inGrams || 0,
                createdAt: nutrition.startTime,
                dataId: nutrition?.metadata?.id || generateHash(),
                date: nutrition.startTime,
                fat: nutrition?.totalFat?.inGrams || 0,
                fiber: nutrition?.dietaryFiber?.inGrams || 0,
                mealType: nutrition.mealType || MEAL_TYPE.UNKNOWN,
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
            }));

            await addUserNutritions(userNutritions);
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
                dietaryFiber: {
                    unit: 'grams',
                    value: userNutrition.fiber || 0,
                },
                endTime: new Date((new Date()).getTime() + 10000).toISOString(),
                energy: {
                    unit: 'kilocalories',
                    value: userNutrition.calories || 0,
                },
                mealType: userNutrition?.mealType || MEAL_TYPE.UNKNOWN,
                name: userNutrition.name,
                protein: {
                    unit: 'grams',
                    value: userNutrition.protein || 0,
                },
                recordType: 'Nutrition',
                startTime: userNutrition.date || getCurrentTimestampISOString(),
                sugar: {
                    unit: 'grams',
                    value: userNutrition.sugar || 0,
                },
                totalCarbohydrate: {
                    unit: 'grams',
                    value: userNutrition.carbohydrate || 0,
                },
                totalFat: {
                    unit: 'grams',
                    value: userNutrition.fat || 0,
                },
            };

            try {
                const results = await insertHealthData([nutritionRecord]);
                if (results[0]) {
                    await updateUserNutrition(userNutrition.id, {
                        ...userNutrition,
                        dataId: results[0],
                        source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                    });
                }
            } catch (error) {
                console.error(`Failed to insert health data for userNutri ID ${userNutrition.id}:`, error);
            }
        }
    }
};