import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react';

import useWorkoutTimer from './useWorkoutTimer';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
}));

describe('useWorkoutTimer', () => {
    const WORKOUT_START_TIME = 'workoutStartTime';

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.spyOn(global.console, 'error').mockImplementation(() => {});
    });

    afterAll(() => {
        jest.useRealTimers();
        (console.error as jest.Mock).mockRestore();
    });

    it('should not initialize workout time if startTime is null', async () => {
        const { result } = renderHook(() => useWorkoutTimer(null));

        expect(result.current.workoutTime).toBe(0);
        expect(AsyncStorage.getItem).not.toHaveBeenCalled();
        expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should set workout start time in AsyncStorage if not already set', async () => {
        const startTime = Date.now();
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

        const { result } = renderHook(() => useWorkoutTimer(startTime));

        await act(async () => {
            jest.advanceTimersByTime(1000);
        });

        expect(AsyncStorage.getItem).toHaveBeenCalledWith(WORKOUT_START_TIME);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(WORKOUT_START_TIME, startTime.toString());
    });

    it('should clear interval on unmount', async () => {
        const startTime = Date.now();
        const { unmount } = renderHook(() => useWorkoutTimer(startTime));

        await act(async () => {
            jest.advanceTimersByTime(1000);
        });

        const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

        unmount();

        expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should stop interval if AsyncStorage item is removed', async () => {
        const startTime = Date.now();
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(startTime.toString());

        const { result } = renderHook(() => useWorkoutTimer(startTime));

        await act(async () => {
            jest.advanceTimersByTime(1000);
        });

        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

        await act(async () => {
            jest.advanceTimersByTime(1000);
        });

        expect(result.current.intervalTimer).toBeCloseTo(1000000000000, -9);
    });
});
