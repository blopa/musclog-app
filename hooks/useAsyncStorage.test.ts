import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react';

import useAsyncStorage from './useAsyncStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    removeItem: jest.fn(),
    setItem: jest.fn(),
}));

describe('useAsyncStorage', () => {
    const key = 'testKey';
    const initialValue = 'initialValue';

    beforeEach(() => {
        (AsyncStorage.getItem as jest.Mock).mockClear();
        (AsyncStorage.removeItem as jest.Mock).mockClear();
        (AsyncStorage.setItem as jest.Mock).mockClear();
        jest.spyOn(global.console, 'error').mockImplementation(() => {});
    });

    afterAll(() => {
        (console.error as jest.Mock).mockRestore();
    });

    it('should initialize with initialValue', () => {
        const { result } = renderHook(() => useAsyncStorage<string>(key, initialValue));

        expect(result.current.value).toBe(initialValue);
    });

    it('should load stored value from AsyncStorage on mount', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify('storedValue'));

        const { result } = renderHook(() => useAsyncStorage<string>(key, initialValue));

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(AsyncStorage.getItem).toHaveBeenCalledWith(key);
        expect(result.current.value).toBe('storedValue');
    });

    it('should handle setting a value', async () => {
        const { result } = renderHook(() => useAsyncStorage<string>(key, initialValue));

        await act(async () => {
            await result.current.setValue('newValue');
        });

        expect(result.current.value).toBe('newValue');
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(key, JSON.stringify('newValue'));
    });

    it('should handle removing a value', async () => {
        const { result } = renderHook(() => useAsyncStorage<string>(key, initialValue));

        await act(async () => {
            await result.current.removeValue();
        });

        expect(result.current.value).toBeNull();
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith(key);
    });

    it('should handle AsyncStorage errors gracefully', async () => {
        (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('getItem error'));
        (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('setItem error'));
        (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('removeItem error'));

        const { result } = renderHook(() => useAsyncStorage<string>(key, initialValue));

        console.error = jest.fn();

        await act(async () => {
            await result.current.getValue();
        });
        expect(console.error).toHaveBeenCalledTimes(2);

        (console.error as jest.Mock).mockClear();

        await act(async () => {
            await result.current.setValue('newValue');
        });
        expect(console.error).toHaveBeenCalledTimes(1);

        (console.error as jest.Mock).mockClear();

        await act(async () => {
            await result.current.removeValue();
        });
        expect(console.error).toHaveBeenCalledTimes(1);
    });
});
