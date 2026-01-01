import { act, renderHook } from '@testing-library/react';

import useAsyncStorage from './useAsyncStorage';
import useRestTimer from './useRestTimer';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    removeItem: jest.fn(),
    setItem: jest.fn(),
}));

jest.mock('./useAsyncStorage');

describe('useRestTimer', () => {
    const mockedUseAsyncStorage = useAsyncStorage as jest.MockedFunction<typeof useAsyncStorage>;
    const mockGetStoredStartTime = jest.fn();
    const mockRemoveStoredStartTime = jest.fn();
    const mockSetStoredStartTime = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockedUseAsyncStorage.mockReturnValue({
            getValue: mockGetStoredStartTime,
            removeValue: mockRemoveStoredStartTime,
            setValue: mockSetStoredStartTime,
            value: null,
        });
    });

    it('should initialize with restTime as 0', () => {
        const { result } = renderHook(() => useRestTimer());
        expect(result.current.restTime).toBe(0);
    });

    it('should handle adding time', async () => {
        mockGetStoredStartTime.mockResolvedValueOnce(Date.now());
        const { result } = renderHook(() => useRestTimer());

        await act(async () => {
            await result.current.handleAddTime();
        });

        expect(result.current.restTime).toBeGreaterThan(0);
        expect(mockSetStoredStartTime).toHaveBeenCalled();
    });

    it('should handle subtracting time', async () => {
        mockGetStoredStartTime.mockResolvedValueOnce(Date.now());
        const { result } = renderHook(() => useRestTimer());

        await act(async () => {
            await result.current.handleAddTime();
            await result.current.handleSubtractTime();
        });

        expect(result.current.restTime).toBe(0);
        expect(mockSetStoredStartTime).toHaveBeenCalledTimes(2);
    });

    it('should reset rest time', async () => {
        const { result } = renderHook(() => useRestTimer());

        await act(async () => {
            await result.current.resetRestTime();
        });

        expect(result.current.restTime).toBe(0);
        expect(mockRemoveStoredStartTime).toHaveBeenCalled();
    });

    it('should force start countdown', async () => {
        const { result } = renderHook(() => useRestTimer());

        await act(async () => {
            await result.current.forceStartCountdown(10);
        });

        expect(mockRemoveStoredStartTime).toHaveBeenCalled();
        expect(mockSetStoredStartTime).toHaveBeenCalled();
    });

    it('should handle countdown completion', async () => {
        const startTime = Date.now() - 10000;
        mockGetStoredStartTime.mockResolvedValueOnce(startTime);
        const { result } = renderHook(() => useRestTimer());

        await act(async () => {
            await result.current.forceStartCountdown(5);
        });

        expect(result.current.restTime).toBe(0);
        expect(mockRemoveStoredStartTime).toHaveBeenCalledTimes(1);
    });
});
