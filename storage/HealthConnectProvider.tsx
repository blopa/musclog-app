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
    checkReadIsPermitted: (recordTypes?: string[]) => Promise<boolean>;
    checkWriteIsPermitted: (recordTypes?: string[]) => Promise<boolean>;
    getHealthData: (pageSize?: number, recordTypes?: string[]) => Promise<HealthDataType>;
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

function isReadPermissionGranted(recordType: string, permissions: Permission[]) {
    return permissions.some(
        (permission) => permission.recordType === recordType && permission.accessType === 'read'
    );
}

function arePermissionsGranted(recordTypes: string[], permissions: Permission[], accessType: 'read' | 'write') {
    return recordTypes.every((recordType) =>
        permissions.some(
            (permission) => permission.recordType === recordType && permission.accessType === accessType
        )
    );
}

function areMandatoryPermissionsGranted(permissions: Permission[], accessType: 'read' | 'write') {
    return arePermissionsGranted(MANDATORY_PERMISSIONS, permissions, accessType);
}

export const checkIsHealthConnectedPermitted = async (accessType: 'read' | 'write', recordTypes?: string[]) => {
    try {
        const isInitialized = await initialize();
        if (!isInitialized) {
            console.error('Failed to initialize Health Connect');
            return false;
        }

        const permissions = await getGrantedPermissions();

        if (recordTypes && recordTypes.length > 0) {
            return arePermissionsGranted(recordTypes, permissions, accessType);
        } else {
            return areMandatoryPermissionsGranted(permissions, accessType);
        }
    } catch (error) {
        console.error('Error checking permissions:', error);
        return false;
    }
};

export const getHealthConnectData = async (pageSize: number = 1000): Promise<HealthDataType> => {
    const timeRangeFilter = {
        operator: 'after',
        startTime: '2000-01-01T00:00:00.000Z',
    } as const;

    const grantedPermissions = await getGrantedPermissions();

    const heightRecords = isReadPermissionGranted('Height', grantedPermissions)
        ? (
            await readRecords('Height', {
                ascendingOrder: false,
                pageSize: 1,
                timeRangeFilter,
            })
        ).records
        : [];

    const weightRecords = isReadPermissionGranted('Weight', grantedPermissions)
        ? (
            await readRecords('Weight', {
                ascendingOrder: false,
                pageSize,
                timeRangeFilter,
            })
        ).records
        : [];

    const bodyFatRecords = isReadPermissionGranted('BodyFat', grantedPermissions)
        ? (
            await readRecords('BodyFat', {
                ascendingOrder: false,
                pageSize,
                timeRangeFilter,
            })
        ).records
        : [];

    const nutritionRecords = isReadPermissionGranted('Nutrition', grantedPermissions)
        ? (
            await readRecords('Nutrition', {
                ascendingOrder: true,
                pageSize,
                timeRangeFilter,
            })
        ).records
        : [];

    const totalCaloriesBurnedRecords = isReadPermissionGranted('TotalCaloriesBurned', grantedPermissions)
        ? (
            await readRecords('TotalCaloriesBurned', {
                ascendingOrder: false,
                pageSize: 1,
                timeRangeFilter: {
                    ...timeRangeFilter,
                    startTime: new Date().toISOString().split('T')[0] + 'T00:00:00.000Z',
                },
            })
        ).records
        : [];

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
            date:
                weightRecords[0]?.time.split('T')[0]
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
        weightRecords: weightRecords as HealthConnectWeightRecord[],
    };
};

const HealthConnectContext = createContext<HealthConnectContextValue>({
    checkReadIsPermitted: async (recordTypes?: string[]) => false,
    checkWriteIsPermitted: async (recordTypes?: string[]) => false,
    getHealthData: async (pageSize?: number, recordTypes?: string[]) => data,
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
                IntentLauncher.startActivityAsync(
                    IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, {
                        data: 'package:' + packageName,
                    });
            }
        } catch (error) {
            console.error('Error requesting permissions:', error);
        }
    }, []);

    const checkReadIsPermitted = useCallback(async (recordTypes?: string[]) => {
        return await checkIsHealthConnectedPermitted('read', recordTypes);
    }, []);

    const checkWriteIsPermitted = useCallback(async (recordTypes?: string[]) => {
        return false;
    }, []);

    const getHealthData = useCallback(
        async (pageSize: number = 1000, recordTypes?: string[]): Promise<HealthDataType> => {
            try {
                const isInitialized = await initialize();
                if (!isInitialized) {
                    console.error('Failed to initialize Health Connect');
                    return healthData;
                }

                const permissions = await getGrantedPermissions();
                if (recordTypes && recordTypes.length > 0) {
                    if (!arePermissionsGranted(recordTypes, permissions, 'read')) {
                        return healthData;
                    }
                } else if (!areMandatoryPermissionsGranted(permissions, 'read')) {
                    return healthData;
                }

                const newHealthData = await getHealthConnectData(pageSize);
                setHealthData(newHealthData);

                return newHealthData;
            } catch (error) {
                console.error('Error reading health data:', error);
            }

            return healthData;
        },
        [healthData]
    );

    return (
        <HealthConnectContext.Provider
            value={{
                checkReadIsPermitted,
                checkWriteIsPermitted,
                getHealthData,
                healthData,
                requestPermissions,
            }}
        >
            {children}
        </HealthConnectContext.Provider>
    );
};
