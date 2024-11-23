import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

type UseAsyncStorageReturn<T> = {
    getValue: () => Promise<T | null>;
    removeValue: () => Promise<void>;
    setValue: (value: T) => Promise<void>;
    value: T | null;
};

const useAsyncStorage = <T,>(key: string, initialValue: T): UseAsyncStorageReturn<T> => {
    const [storedValue, setStoredValue] = useState<T | null>(initialValue);

    useEffect(() => {
        const loadStoredValue = async () => {
            try {
                const value = await AsyncStorage.getItem(key);
                if (value !== null) {
                    setStoredValue(JSON.parse(value));
                }
            } catch (e) {
                console.error('Failed to load value from AsyncStorage', e);
            }
        };

        loadStoredValue();
    }, [key]);

    const setValue = useCallback(async (value: T) => {
        try {
            setStoredValue(value);
            await AsyncStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Failed to save value to AsyncStorage', e);
        }
    }, [key]);

    const removeValue = useCallback(async () => {
        try {
            setStoredValue(null);
            await AsyncStorage.removeItem(key);
        } catch (e) {
            console.error('Failed to remove value from AsyncStorage', e);
        }
    }, [key]);

    const getValue = useCallback(async (): Promise<T | null> => {
        try {
            const value = await AsyncStorage.getItem(key);
            if (value !== null) {
                const parsedValue = JSON.parse(value);
                setStoredValue(parsedValue);
                return parsedValue;
            }
            return null;
        } catch (e) {
            console.error('Failed to get value from AsyncStorage', e);
            return null;
        }
    }, [key]);

    return {
        getValue,
        removeValue,
        setValue,
        value: storedValue,
    };
};

export default useAsyncStorage;
