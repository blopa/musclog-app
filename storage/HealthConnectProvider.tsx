import type { HealthConnectRecord, RecordType } from 'react-native-health-connect/src/types';

import { DEFAULT_PAGE_SIZE, MANDATORY_PERMISSIONS, NEEDED_PERMISSIONS } from '@/constants/healthConnect';
import { METRIC_SYSTEM } from '@/constants/storage';
import { getCurrentTimestampISOString } from '@/utils/date';
import {
    HealthConnectBodyFatRecordData,
    HealthConnectWeightRecord,
    HealthDataType,
    TotalMacrosType,
} from '@/utils/types';
import * as IntentLauncher from 'expo-intent-launcher';
import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { PermissionsAndroid } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {
    deleteRecordsByUuids,
    getGrantedPermissions,
    initialize,
    insertRecords,
    readRecords,
    requestPermission,
} from 'react-native-health-connect';
import { Permission } from 'react-native-health-connect/lib/typescript/types';

const packageName = DeviceInfo.getBundleId();

export interface HealthConnectContextValue {
    checkReadIsPermitted: (recordTypes?: RecordType[]) => Promise<boolean>;
    checkWriteIsPermitted: (recordTypes?: RecordType[]) => Promise<boolean>;
    deleteHealthData: (recordType: RecordType, dataIds: string[]) => Promise<void>;
    getHealthData: (startTime: string, endTime: string, pageSize?: number, recordTypes?: RecordType[]) => Promise<HealthDataType>;
    healthData: HealthDataType;
    insertHealthData: (data: HealthConnectRecord[]) => Promise<string[]>;
    requestPermissions: () => Promise<void>;
}

type HealthConnectAccessType = 'read' | 'write';

const data = {
    latest: {
        date: getCurrentTimestampISOString()
            .split('T')[0],
        fatPercentage: undefined,
        height: undefined,
        macros: undefined,
        totalCaloriesBurned: undefined,
        unitSystem: METRIC_SYSTEM,
        weight: undefined,
    },
};

function areMandatoryPermissionsGranted(permissions: Permission[], accessType: HealthConnectAccessType) {
    return arePermissionsGranted(MANDATORY_PERMISSIONS, permissions, accessType);
}

function arePermissionsGranted(recordTypes: string[], permissions: Permission[], accessType: HealthConnectAccessType) {
    return recordTypes.every((recordType) =>
        permissions.some(
            (permission) => permission.recordType === recordType && permission.accessType === accessType
        )
    );
}

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

function isWritePermissionGranted(recordType: string, permissions: Permission[]) {
    return permissions.some(
        (permission) => permission.recordType === recordType && permission.accessType === 'write'
    );
}

export const hasAccessToHealthConnectDataHistory = async () => {
    return await PermissionsAndroid.check(
        // @ts-ignore permission exists but is not in the type definition
        'android.permission.health.READ_HEALTH_DATA_HISTORY'
    );
};

export const checkIsHealthConnectedPermitted = async (accessType: HealthConnectAccessType, recordTypes?: RecordType[]) => {
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

export const getHealthConnectData = async (
    startTime: string,
    endTime: string,
    pageSize: number = DEFAULT_PAGE_SIZE,
    recordTypes?: RecordType[]
): Promise<HealthDataType> => {
    const timeRangeFilter = {
        endTime,
        operator: 'between',
        startTime,
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
                ascendingOrder: false,
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
                timeRangeFilter,
            })
        ).records
        : [];

    const latestHeight = heightRecords[0]?.height?.inMeters;
    const latestWeight = weightRecords[0]?.weight?.inKilograms;
    const latestBodyFat = bodyFatRecords[0]?.percentage;
    const latestTotalCaloriesBurned = totalCaloriesBurnedRecords[0]?.energy?.inKilocalories;
    const dataId = weightRecords[0]?.metadata?.id
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
    checkReadIsPermitted: async (recordTypes?: RecordType[]) => false,
    checkWriteIsPermitted: async (recordTypes?: RecordType[]) => false,
    deleteHealthData: async (recordType: RecordType, dataIds: string[]): Promise<void> => {},
    getHealthData: async (startTime: string, endTime: string, pageSize?: number, recordTypes?: RecordType[]) => data,
    healthData: data,
    insertHealthData: async (data: HealthConnectRecord[]): Promise<string[]> => Promise.resolve([]),
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

    const checkReadIsPermitted = useCallback(async (recordTypes?: RecordType[]) => {
        return await checkIsHealthConnectedPermitted('read', recordTypes);
    }, []);

    const checkWriteIsPermitted = useCallback(async (recordTypes?: RecordType[]) => {
        return await checkIsHealthConnectedPermitted('write', recordTypes);
    }, []);

    const insertHealthData = useCallback(async (data: HealthConnectRecord[]): Promise<string[]> => {
        return await insertRecords(data);
    }, []);

    const deleteHealthData = useCallback(async (recordType: RecordType, dataIds: string[]): Promise<void> => {
        return await deleteRecordsByUuids(recordType, dataIds, []);
    }, []);

    const getHealthData = useCallback(
        async (startTime: string, endTime: string, pageSize: number = DEFAULT_PAGE_SIZE, recordTypes?: RecordType[]): Promise<HealthDataType> => {
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

                const newHealthData = await getHealthConnectData(startTime, endTime, pageSize, recordTypes);
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
                deleteHealthData,
                getHealthData,
                healthData,
                insertHealthData,
                requestPermissions,
            }}
        >
            {children}
        </HealthConnectContext.Provider>
    );
};
