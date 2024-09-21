import { MANDATORY_PERMISSIONS, NEEDED_PERMISSIONS } from '@/constants/healthConnect';
import { METRIC_SYSTEM } from '@/constants/storage';
import {
    HealthConnectBodyFatRecordData,
    HealthConnectWeightRecord,
    HealthDataType,
    TotalMacrosType
} from '@/utils/types';
import * as IntentLauncher from 'expo-intent-launcher';
import React, { ReactNode, createContext, useCallback, useContext, useState } from 'react';
import DeviceInfo from 'react-native-device-info';
import {
    getGrantedPermissions,
    initialize,
    readRecords,
    requestPermission,
} from 'react-native-health-connect';
import { Permission } from 'react-native-health-connect/lib/typescript/types';

const packageName = DeviceInfo.getBundleId();

interface HealthConnectContextValue {
    checkIsPermitted: () => Promise<boolean>;
    getHealthData: (pageSize?: number) => Promise<HealthDataType>;
    healthData: HealthDataType;
    requestPermissions: () => Promise<void>;
}

const data = {
    latest: {
        date: new Date().toISOString().split('T')[0],
        fatPercentage: undefined,
        height: undefined,
        macros: undefined,
        totalCaloriesBurned: undefined,
        unitSystem: METRIC_SYSTEM,
        weight: undefined,
    },
};

function calculateTotals(data: any[]): TotalMacrosType {
    const totals: TotalMacrosType = {
        totalCalories: 0,
        totalCarbs: 0,
        totalFats: 0,
        totalProteins: 0,
        totalSaturatedFats: 0,
        totalTransFats: 0,
    };

    data?.forEach((item) => {
        totals.totalCalories += item.energy.inKilocalories || 0;
        totals.totalProteins += item.protein.inGrams || 0;
        totals.totalTransFats += item.transFat.inGrams || 0;
        totals.totalSaturatedFats += item.saturatedFat.inGrams || 0;
        totals.totalCarbs += item.totalCarbohydrate.inGrams || 0;
        totals.totalFats += item.totalFat.inGrams || 0;
    });

    return totals;
}

// TODO improve this
function areMandatoryPermissionsGranted(permissions: Permission[]) {
    const recordTypes = permissions.map(({ recordType }) => recordType) as string[];
    return MANDATORY_PERMISSIONS.every((recordType) => recordTypes.includes(recordType));
}

export const checkIsHealthConnectedPermitted = async () => {
    try {
        const isInitialized = await initialize();
        if (!isInitialized) {
            console.error('Failed to initialize Health Connect');
            return false;
        }

        const permissions = await getGrantedPermissions();

        return areMandatoryPermissionsGranted(permissions);
    } catch (error) {
        console.error('Error checking permissions:', error);
        return false;
    }
};

export const getHealthConnectData = async (pageSize?: number): Promise<HealthDataType> => {
    const timeRangeFilter = {
        operator: 'after',
        startTime: '2000-01-01T00:00:00.000Z',
    } as const;

    const { records: heightRecords } = await readRecords('Height', {
        ascendingOrder: false,
        pageSize: 1,
        timeRangeFilter,
    });

    const { records: weightRecords } = await readRecords('Weight', {
        ascendingOrder: false,
        pageSize,
        timeRangeFilter,
    });

    const { records: bodyFatRecords } = await readRecords('BodyFat', {
        ascendingOrder: false,
        pageSize,
        timeRangeFilter,
    });

    const { records: nutritionRecords } = await readRecords('Nutrition', {
        ascendingOrder: true,
        pageSize,
        timeRangeFilter: {
            ...timeRangeFilter,
            // startTime: new Date().toISOString().split('T')[0] + 'T00:00:00.000Z',
        }
    });

    const { records: totalCaloriesBurnedRecords } = await readRecords('TotalCaloriesBurned', {
        ascendingOrder: false,
        pageSize: 1,
        timeRangeFilter: {
            ...timeRangeFilter,
            startTime: new Date().toISOString().split('T')[0] + 'T00:00:00.000Z',
        }
    });

    const latestHeight = heightRecords[0]?.height?.inMeters;
    const latestWeight = weightRecords[0]?.weight?.inKilograms;
    const latestBodyFat = bodyFatRecords[0]?.percentage;
    const latestTotalCaloriesBurned = totalCaloriesBurnedRecords[0]?.energy?.inKilocalories;
    const dataId =
        weightRecords[0]?.metadata?.id
        || heightRecords[0]?.metadata?.id
        || bodyFatRecords[0]?.metadata?.id
        || nutritionRecords[0]?.metadata?.id
        || totalCaloriesBurnedRecords[0]?.metadata?.id;

    return {
        bodyFatRecords: bodyFatRecords as HealthConnectBodyFatRecordData[],
        heightRecords,
        latest: {
            dataId,
            date: weightRecords[0]?.time.split('T')[0]
                || heightRecords[0]?.time.split('T')[0]
                || bodyFatRecords[0]?.time.split('T')[0],
            fatPercentage: latestBodyFat,
            height: latestHeight,
            macros: calculateTotals(nutritionRecords),
            totalCaloriesBurned: latestTotalCaloriesBurned,
            weight: latestWeight,
        },
        nutritionRecords,
        totalCaloriesBurnedRecords,
        weightRecords: weightRecords as HealthConnectWeightRecord[]
    };
};

const HealthConnectContext = createContext<HealthConnectContextValue>({
    checkIsPermitted: async () => false,
    getHealthData: async (pageSize?: number) => data,
    healthData: data,
    requestPermissions: async () => {},
});

export const useHealthConnect = () => useContext(HealthConnectContext);

interface HealthConnectProviderProps {
    children: ReactNode;
}

export const HealthConnectProvider = ({ children }: HealthConnectProviderProps) => {
    const [healthData, setHealthData] = useState<HealthDataType>(data);

    const requestPermissions = useCallback(async () => {
        try {
            const isInitialized = await initialize();
            if (!isInitialized) {
                console.error('Failed to initialize Health Connect');
                return;
            }

            try {
                await requestPermission(NEEDED_PERMISSIONS);
            } catch (error) {
                IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, {
                    data: 'package:' + packageName,
                });
            }
        } catch (error) {
            console.error('Error requesting permissions:', error);
        }
    }, []);
    
    const checkIsPermitted = useCallback(async () => {
        return await checkIsHealthConnectedPermitted();
    }, []);

    const getHealthData = useCallback(async (pageSize?: number): Promise<HealthDataType> => {
        try {
            const isInitialized = await initialize();
            if (!isInitialized) {
                console.error('Failed to initialize Health Connect');
                return healthData;
            }

            const permissions = await getGrantedPermissions();
            if (!areMandatoryPermissionsGranted(permissions)) {
                return healthData;
            }
            
            const newHealthData = await getHealthConnectData(pageSize);
            setHealthData(newHealthData);

            return newHealthData;
        } catch (error) {
            console.error('Error reading health data:', error);
        }

        return healthData;
    }, [healthData]);

    return (
        <HealthConnectContext.Provider value={{
            checkIsPermitted,
            getHealthData,
            healthData,
            requestPermissions,
        }}>
            {children}
        </HealthConnectContext.Provider>
    );
};
