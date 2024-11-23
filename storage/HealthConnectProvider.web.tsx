import type { HealthConnectRecord, RecordType } from 'react-native-health-connect/src/types';

import { HealthDataType } from '@/utils/types';
import React, { ReactNode, createContext, useContext } from 'react';

import data from '../data/healthDataExample.json';

const IS_PERMITTED = true;

type HealthConnectAccessType = 'read' | 'write';

interface HealthConnectContextValue {
    checkReadIsPermitted: (recordTypes?: RecordType[]) => Promise<boolean>;
    checkWriteIsPermitted: (recordTypes?: RecordType[]) => Promise<boolean>;
    getHealthData: (pageSize?: number, recordTypes?: RecordType[]) => Promise<HealthDataType>;
    insertHealthData: (data: HealthConnectRecord[]) => Promise<string[]>;
    deleteHealthData: (recordType: RecordType, dataIds: string[]) => Promise<void>;
    healthData: HealthDataType;
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
    getHealthData: async (pageSize?: number, recordTypes?: RecordType[]) => (IS_PERMITTED ? data : []) as unknown as HealthDataType,
    insertHealthData: async (data: HealthConnectRecord[]): Promise<string[]> => Promise.resolve([]),
    deleteHealthData: async (recordType: RecordType, dataIds: string[]) => {},
    healthData: (IS_PERMITTED ? data : []) as unknown as HealthDataType,
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
                getHealthData: async () => (IS_PERMITTED ? data : []) as unknown as HealthDataType,
                healthData: (IS_PERMITTED ? data : []) as unknown as HealthDataType,
                requestPermissions: async () => {},
                insertHealthData: async (data: HealthConnectRecord[]) => Promise.resolve([]),
                deleteHealthData: async (recordType: RecordType, dataIds: string[]) => {},
            }}
        >
            {children}
        </HealthConnectContext.Provider>
    );
};
