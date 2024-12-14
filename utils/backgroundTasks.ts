import {
    NUTRITION_INSIGHT_DAILY,
    NUTRITION_INSIGHT_DISABLED,
    NUTRITION_INSIGHTS_TYPE,
    UNREAD_MESSAGES_COUNT,
    WORKOUT_INSIGHT_DAILY,
    WORKOUT_INSIGHT_DISABLED,
    WORKOUT_INSIGHTS_TYPE,
} from '@/constants/storage';
import { DAILY_TASK, DAILY_TASK_INTERVAL, LAST_DAILY_TASK_RUN_DATE } from '@/constants/tasks';
import { getNutritionInsights, getRecentWorkoutsInsights } from '@/utils/ai';
import { addChat, getSetting } from '@/utils/database';
import {
    getCurrentTimestampISOString,
    getDaysAgoTimestampISOString,
    getStartOfDayTimestampISOString,
} from '@/utils/date';
import { captureMessage } from '@/utils/sentry';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

TaskManager.defineTask(DAILY_TASK, async () => {
    try {
        const currentDate = new Date();
        // const currentHour = currentDate.getHours();
        //
        // // Ensure the task only runs before 3am
        // if (currentHour < 3) {
        //     console.log('Task not running, outside of 3am window.');
        //     captureMessage('Task not running, outside of 3am window.');
        //     return BackgroundFetch.BackgroundFetchResult.NoData;
        // }

        captureMessage('Running daily task.');

        // Check if it was already run today
        const lastTimeRun = await AsyncStorage.getItem(LAST_DAILY_TASK_RUN_DATE);
        const today = currentDate.toISOString().split('T')[0];
        if (lastTimeRun === today) {
            console.log('Task already ran today.');
            captureMessage('Task already ran today.');
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        const nutritionInsightType = await getSetting(NUTRITION_INSIGHTS_TYPE);
        const workoutInsightType = await getSetting(WORKOUT_INSIGHTS_TYPE);

        if (workoutInsightType?.value && workoutInsightType.value !== WORKOUT_INSIGHT_DISABLED) {
            const startDate = getStartOfDayTimestampISOString(getDaysAgoTimestampISOString(workoutInsightType.value === WORKOUT_INSIGHT_DAILY ? 1 : 7));
            const endDate = getStartOfDayTimestampISOString(getCurrentTimestampISOString());
            const message = await getRecentWorkoutsInsights(startDate, endDate);

            if (message) {
                await addChat({
                    message,
                    misc: '',
                    sender: 'assistant',
                    type: 'text',
                });

                const currentCount = await AsyncStorage.getItem(UNREAD_MESSAGES_COUNT) || '0';
                await AsyncStorage.setItem(UNREAD_MESSAGES_COUNT, (parseInt(currentCount, 10) + 1).toString());
            } else {
                console.log('No workout insight message to add.');
                captureMessage('No workout insight message to add.');
            }
        }

        if (nutritionInsightType?.value && nutritionInsightType.value !== NUTRITION_INSIGHT_DISABLED) {
            const startDate = getStartOfDayTimestampISOString(getDaysAgoTimestampISOString(nutritionInsightType.value === NUTRITION_INSIGHT_DAILY ? 1 : 7));
            const endDate = getStartOfDayTimestampISOString(getCurrentTimestampISOString());
            const message = await getNutritionInsights(startDate, endDate);

            if (message) {
                await addChat({
                    message,
                    misc: '',
                    sender: 'assistant',
                    type: 'text',
                });

                const currentCount = await AsyncStorage.getItem(UNREAD_MESSAGES_COUNT) || '0';
                await AsyncStorage.setItem(UNREAD_MESSAGES_COUNT, (parseInt(currentCount, 10) + 1).toString());
            } else {
                console.log('No nutrition insight message to add.');
                captureMessage('No nutrition insight message to add.');
            }
        }

        // Update the last run date
        await AsyncStorage.setItem(LAST_DAILY_TASK_RUN_DATE, today);

        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
        console.error('Error running daily task:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

export const startBackgroundFetch = async () => {
    try {
        if (Platform.OS === 'web') {
            console.log('Background fetch is not available on the web.');
            return;
        }

        await BackgroundFetch.registerTaskAsync(DAILY_TASK, {
            minimumInterval: DAILY_TASK_INTERVAL,
            startOnBoot: true,
            stopOnTerminate: false,
        });

        const status = await BackgroundFetch.getStatusAsync();
        if (status === BackgroundFetch.BackgroundFetchStatus.Available) {
            console.log('Background fetch is available and registered.');
        } else if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
            console.log('Background fetch is restricted.');
        } else if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
            console.log('Background fetch is denied.');
        } else {
            console.log('Background fetch status:', status);
        }
    } catch (error) {
        console.error('Error starting background fetch:', error);
    }
};
