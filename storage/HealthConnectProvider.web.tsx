import { HealthDataType } from '@/utils/types';
import React, { ReactNode, createContext, useContext } from 'react';

import data from '../data/healthDataExample.json';

const IS_PERMITTED = true;

interface HealthConnectContextValue {
    checkReadIsPermitted: (recordTypes?: string[]) => Promise<boolean>;
    checkWriteIsPermitted: (recordTypes?: string[]) => Promise<boolean>;
    getHealthData: (pageSize?: number, recordTypes?: string[]) => Promise<HealthDataType>;
    healthData: HealthDataType;
    requestPermissions: () => Promise<void>;
}

export const checkIsReadHealthConnectedPermitted = async () => {
    return IS_PERMITTED;
}

export const getHealthConnectData = async (pageSize?: number): Promise<HealthDataType> => {
    return (IS_PERMITTED ? data : []) as unknown as HealthDataType;
}

const HealthConnectContext = createContext<HealthConnectContextValue>({
    checkReadIsPermitted: async (recordTypes?: string[]) => IS_PERMITTED,
    checkWriteIsPermitted: async (recordTypes?: string[]) => IS_PERMITTED,
    getHealthData: async (pageSize?: number, recordTypes?: string[]) => (IS_PERMITTED ? data : []) as unknown as HealthDataType,
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
            }}
        >
            {children}
        </HealthConnectContext.Provider>
    );
};
