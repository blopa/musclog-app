import type { HealthConnectRecord, RecordType } from 'react-native-health-connect/src/types';

import { HealthDataType } from '@/utils/types';
import React, { createContext, ReactNode, useContext } from 'react';

import data from '../data/healthDataExample.json';

const IS_PERMITTED = true;

type HealthConnectAccessType = 'read' | 'write';

interface HealthConnectContextValue {
    checkReadIsPermitted: (recordTypes?: RecordType[]) => Promise<boolean>;
    checkWriteIsPermitted: (recordTypes?: RecordType[]) => Promise<boolean>;
    deleteHealthData: (recordType: RecordType, dataIds: string[]) => Promise<void>;
    getHealthData: (pageSize?: number, recordTypes?: RecordType[]) => Promise<HealthDataType>;
    healthData: HealthDataType;
    insertHealthData: (data: HealthConnectRecord[]) => Promise<string[]>;
    requestPermissions: () => Promise<void>;
}

export const checkIsHealthConnectedPermitted = async (accessType: HealthConnectAccessType, recordTypes?: RecordType[]) => {
    return IS_PERMITTED;
};

export const getHealthConnectData = async (pageSize?: number): Promise<HealthDataType> => {
    return (IS_PERMITTED ? data : []) as unknown as HealthDataType;
};

const HealthConnectContext = createContext<HealthConnectContextValue>({
    checkReadIsPermitted: async (recordTypes?: RecordType[]) => IS_PERMITTED,
    checkWriteIsPermitted: async (recordTypes?: RecordType[]) => IS_PERMITTED,
    deleteHealthData: async (recordType: RecordType, dataIds: string[]) => {},
    getHealthData: async (pageSize?: number, recordTypes?: RecordType[]) => (IS_PERMITTED ? data : []) as unknown as HealthDataType,
    healthData: (IS_PERMITTED ? data : []) as unknown as HealthDataType,
    insertHealthData: async (data: HealthConnectRecord[]): Promise<string[]> => Promise.resolve([]),
    requestPermissions: async () => {},
});

export const useHealthConnect = () => useContext(HealthConnectContext);

interface HealthConnectProviderProps {
    children: ReactNode;
}

export const HealthConnectProvider = ({ children }: HealthConnectProviderProps) => {
    return (
        <HealthConnectContext.Provider
            value={{
                checkReadIsPermitted: async () => IS_PERMITTED,
                checkWriteIsPermitted: async () => IS_PERMITTED,
                deleteHealthData: async (recordType: RecordType, dataIds: string[]) => {},
                getHealthData: async () => (IS_PERMITTED ? data : []) as unknown as HealthDataType,
                healthData: (IS_PERMITTED ? data : []) as unknown as HealthDataType,
                insertHealthData: async (data: HealthConnectRecord[]) => Promise.resolve([]),
                requestPermissions: async () => {},
            }}
        >
            {children}
        </HealthConnectContext.Provider>
    );
};
