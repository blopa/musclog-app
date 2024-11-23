import type { DatabaseChangeEvent } from 'expo-sqlite/src/SQLiteDatabase';

import {
    addOrUpdateSetting,
    getAllSettings,
    getSetting,
    listenToDatabaseChanges,
} from '@/utils/database';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

interface Setting {
    createdAt?: string;
    deletedAt?: string;
    id?: number;
    type: string;
    value: string;
}

interface SettingsContextValue {
    addNewSetting: (type: string, value: string) => Promise<void>;
    addOrUpdateSettingValue: (type: string, value: string) => Promise<void>;
    getSettingByType: (type: string) => Promise<Setting | undefined>;
    settings: Setting[];
    updateSettingValue: (type: string, value: string) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
    addNewSetting: async () => {},
    addOrUpdateSettingValue: async () => {},
    getSettingByType: async () => undefined,
    settings: [],
    updateSettingValue: async () => {},
});

export const useSettings = () => useContext(SettingsContext);

interface SettingsProviderProps {
    children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
    const [settings, setSettings] = useState<Setting[]>([]);

    const loadSettings = useCallback(async () => {
        try {
            const allSettings = await getAllSettings();
            setSettings(allSettings);
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }, []);

    const addNewSetting = useCallback(async (type: string, value: string) => {
        try {
            await addOrUpdateSetting({ type, value });
            await loadSettings();
        } catch (error) {
            console.error('Error adding new setting:', error);
        }
    }, [loadSettings]);

    const getSettingByType = useCallback(async (type: string): Promise<Setting | undefined> => {
        try {
            return await getSetting(type);
        } catch (error) {
            console.error('Error getting setting by type:', error);
            return undefined;
        }
    }, []);

    const updateSettingValue = useCallback(async (type: string, value: string) => {
        try {
            await addOrUpdateSetting({ type, value });
            await loadSettings();
        } catch (error) {
            console.error('Error updating setting value:', error);
        }
    }, [loadSettings]);

    const addOrUpdateSettingValue = useCallback(async (type: string, value: string) => {
        try {
            await addOrUpdateSetting({ type, value });
            await loadSettings();
        } catch (error) {
            console.error('Error updating or adding setting value:', error);
        }
    }, [loadSettings]);

    useEffect(() => {
        loadSettings();
        const listener = (event: DatabaseChangeEvent) => {
            if (event.tableName === 'settings') {
                loadSettings();
            }
        };

        listenToDatabaseChanges(listener);
    }, [loadSettings]);

    return (
        <SettingsContext.Provider
            value={{
                addNewSetting,
                addOrUpdateSettingValue,
                getSettingByType,
                settings,
                updateSettingValue,
            }}
        >
            {children}
        </SettingsContext.Provider>
    );
};
