import {
    NUTRITION_INSIGHT_DAILY,
    NUTRITION_INSIGHT_DISABLED,
    NUTRITION_INSIGHTS_TYPE,
    UNREAD_MESSAGES_COUNT,
    WORKOUT_INSIGHT_DAILY,
    WORKOUT_INSIGHT_DISABLED,
    WORKOUT_INSIGHTS_TYPE,
} from '@/constants/storage';
import { DAILY_TASK, DAILY_TASK_INTERVAL } from '@/constants/tasks';
import { getNutritionInsights, getRecentWorkoutsInsights } from '@/utils/ai';
import { addChat, getSetting } from '@/utils/database';
import { getCurrentTimestampISOString, getDaysAgoTimestampISOString } from '@/utils/date';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

TaskManager.defineTask(DAILY_TASK, async () => {
    try {
        const nutritionInsightType = await getSetting(NUTRITION_INSIGHTS_TYPE);
        const workoutInsightType = await getSetting(WORKOUT_INSIGHTS_TYPE);

        if (workoutInsightType?.value && workoutInsightType.value !== WORKOUT_INSIGHT_DISABLED) {
            const startDate = getDaysAgoTimestampISOString(workoutInsightType.value === WORKOUT_INSIGHT_DAILY ? 1 : 7);
            const endDate = getCurrentTimestampISOString();
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
            }
        }

        if (nutritionInsightType?.value && nutritionInsightType.value !== NUTRITION_INSIGHT_DISABLED) {
            const startDate = getDaysAgoTimestampISOString(nutritionInsightType.value === NUTRITION_INSIGHT_DAILY ? 1 : 7);
            const endDate = getCurrentTimestampISOString();
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
            }
        }

        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

export const startBackgroundFetch = async () => {
    if (Platform.OS === 'web') {
        return;
    }

    await BackgroundFetch.registerTaskAsync(DAILY_TASK, {
        minimumInterval: DAILY_TASK_INTERVAL,
        startOnBoot: true,
        stopOnTerminate: false,
    });

    const status = await BackgroundFetch.getStatusAsync();
    console.log('Background fetch status:', status);
};
