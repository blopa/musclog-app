import { COUNTDOWN_START_TIME } from '@/constants/storage';
import { useCallback, useState } from 'react';

import useAsyncStorage from './useAsyncStorage';

const FIVE_SECONDS = 5000;

interface UseRestTimerReturnType {
    forceStartCountdown: (restTime: number, initialStartTime?: null | number) => Promise<void>;
    getStoredStartTime: () => Promise<null | number>;
    handleAddTime: () => void;
    handleSubtractTime: () => void;
    removeStoredStartTime: () => Promise<void>;
    resetRestTime: () => Promise<void>;
    restTime: number;
    setRestTime: (time: number) => void;
    setStoredStartTime: (time: number) => Promise<void>;
}

const useRestTimer = (): UseRestTimerReturnType => {
    const [restTime, setRestTime] = useState(0);

    const {
        getValue: getStoredStartTime,
        removeValue: removeStoredStartTime,
        setValue: setStoredStartTime,
    } = useAsyncStorage<null | number>(COUNTDOWN_START_TIME, null);

    const countdown = useCallback(async (restTime: number) => {
        const now = Date.now();
        const workoutStartTime = await getStoredStartTime();

        if (!workoutStartTime) {
            return;
        }

        const elapsedTime = (now + 5) - workoutStartTime;
        const remainingTime = (restTime * 1000) - elapsedTime;

        if (remainingTime <= 0) {
            setRestTime(0);
            await removeStoredStartTime();
        } else {
            setRestTime(remainingTime);
            setTimeout(() => countdown(restTime), 1000);
        }
    }, [getStoredStartTime, removeStoredStartTime]);

    const handleAddTime = useCallback(async () => {
        const currentStartTime = (await getStoredStartTime()) || Date.now();
        const newRestTime = currentStartTime + FIVE_SECONDS;

        setRestTime((prevTime) => {
            const newTime = prevTime + FIVE_SECONDS;
            setStoredStartTime(newRestTime);
            return newTime;
        });

        // await setStoredStartTime(newRestTime);
    }, [getStoredStartTime, setStoredStartTime]);

    const handleSubtractTime = useCallback(async () => {
        const currentStartTime = (await getStoredStartTime()) || Date.now();
        const newRestTime = currentStartTime - FIVE_SECONDS;

        setRestTime((prevTime) => {
            const newTime = Math.max(prevTime - FIVE_SECONDS, 0);
            setStoredStartTime(newRestTime);
            return newTime;
        });

        // await setStoredStartTime(newRestTime);
    }, [getStoredStartTime, setStoredStartTime]);

    const resetRestTime = useCallback(async () => {
        setRestTime(0);
        await removeStoredStartTime();
    }, [removeStoredStartTime]);

    const forceStartCountdown = useCallback(async (waitTime: number, existingStartTime: null | number = null) => {
        const startTime = existingStartTime || Date.now();
        await removeStoredStartTime();
        await setStoredStartTime(startTime);

        const workoutStartTime = await getStoredStartTime();
        if (!workoutStartTime) {
            await setStoredStartTime(startTime);
        }

        countdown(waitTime);
    }, [countdown, getStoredStartTime, removeStoredStartTime, setStoredStartTime]);

    return {
        forceStartCountdown,
        getStoredStartTime,
        handleAddTime,
        handleSubtractTime,
        removeStoredStartTime,
        resetRestTime,
        restTime,
        setRestTime,
        setStoredStartTime,
    };
};

export default useRestTimer;
