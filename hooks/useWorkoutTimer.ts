import { WORKOUT_START_TIME } from '@/constants/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// TODO: maybe use useAsyncStorage here
const useWorkoutTimer = (startTime: null | number) => {
    const [workoutTime, setWorkoutTime] = useState(0);
    // eslint-disable-next-line no-undef
    const [intervalTimer, setIntervalTimer] = useState<NodeJS.Timeout | undefined>(undefined);

    useEffect(() => {
        // eslint-disable-next-line no-undef
        let interval: NodeJS.Timeout;
        const initializeWorkoutTime = async () => {
            if (!startTime) {
                return;
            }

            let storedStartTime = await AsyncStorage.getItem(WORKOUT_START_TIME);

            if (!storedStartTime) {
                await AsyncStorage.setItem(WORKOUT_START_TIME, startTime.toString());
                storedStartTime = startTime.toString();
            }

            const workoutStartTime = storedStartTime ? parseInt(storedStartTime) : Date.now();
            interval = setInterval(async () => {
                const storedStartTime = await AsyncStorage.getItem(WORKOUT_START_TIME);
                if (!storedStartTime) {
                    clearInterval(interval);
                    return;
                }

                const now = Date.now();
                const elapsedTime = now - workoutStartTime;

                setWorkoutTime(elapsedTime);
            }, 1000);

            setIntervalTimer(interval);
        };

        initializeWorkoutTime();

        return () => clearInterval(interval);
    }, [startTime]);

    return {
        intervalTimer,
        workoutTime,
    };
};

export default useWorkoutTimer;
