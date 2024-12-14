import {
    NUTRITION_INSIGHT_DAILY,
    NUTRITION_INSIGHT_DISABLED,
    NUTRITION_INSIGHTS_TYPE,
    UNREAD_MESSAGES_COUNT,
    WORKOUT_INSIGHT_DAILY,
    WORKOUT_INSIGHT_DISABLED,
    WORKOUT_INSIGHTS_TYPE,
} from '@/constants/storage';
import { LAST_DAILY_TASK_RUN_DATE } from '@/constants/tasks';
import { getNutritionInsights, getRecentWorkoutsInsights } from '@/utils/ai';
import { addChat, getSetting } from '@/utils/database';
import {
    getDaysAgoTimestampISOString,
    getStartOfDayTimestampISOString,
} from '@/utils/date';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function configureDailyTasks() {
    try {
        const currentDate = new Date();
        // const currentHour = currentDate.getHours();
        //
        // if (currentHour > 3) {
        //     return;
        // }

        // Check if it was already run today
        const lastTimeRun = await AsyncStorage.getItem(LAST_DAILY_TASK_RUN_DATE);
        const today = currentDate.toISOString().split('T')[0];
        if (lastTimeRun === today) {
            console.log('Task already ran today.');
            return;
        }

        const nutritionInsightType = await getSetting(NUTRITION_INSIGHTS_TYPE);
        const workoutInsightType = await getSetting(WORKOUT_INSIGHTS_TYPE);

        if (workoutInsightType?.value && workoutInsightType.value !== WORKOUT_INSIGHT_DISABLED) {
            const isDaily = workoutInsightType.value === WORKOUT_INSIGHT_DAILY;
            const startDate = getStartOfDayTimestampISOString(
                getDaysAgoTimestampISOString(isDaily ? 1 : 7)
            );

            const endDate = getStartOfDayTimestampISOString(getDaysAgoTimestampISOString(isDaily ? 1 : 0));
            const message = await getRecentWorkoutsInsights(startDate, endDate);

            if (message) {
                await addChat({
                    message,
                    misc: '',
                    sender: 'assistant',
                    type: 'text',
                });

                const currentCount = (await AsyncStorage.getItem(UNREAD_MESSAGES_COUNT)) || '0';
                await AsyncStorage.setItem(UNREAD_MESSAGES_COUNT, (parseInt(currentCount, 10) + 1).toString());
            } else {
                console.log('No workout insight message to add.');
            }
        }

        if (nutritionInsightType?.value && nutritionInsightType.value !== NUTRITION_INSIGHT_DISABLED) {
            const isDaily = nutritionInsightType.value === NUTRITION_INSIGHT_DAILY;
            const startDate = getStartOfDayTimestampISOString(
                getDaysAgoTimestampISOString(isDaily ? 1 : 7)
            );

            const endDate = getStartOfDayTimestampISOString(getDaysAgoTimestampISOString(isDaily ? 1 : 0));
            const message = await getNutritionInsights(startDate, endDate);

            if (message) {
                await addChat({
                    message,
                    misc: '',
                    sender: 'assistant',
                    type: 'text',
                });

                const currentCount = (await AsyncStorage.getItem(UNREAD_MESSAGES_COUNT)) || '0';
                await AsyncStorage.setItem(UNREAD_MESSAGES_COUNT, (parseInt(currentCount, 10) + 1).toString());
            } else {
                console.log('No nutrition insight message to add.');
            }
        }

        // Update the last run date
        await AsyncStorage.setItem(LAST_DAILY_TASK_RUN_DATE, today);

        console.log('Daily task completed successfully.');
    } catch (error) {
        console.error('Error running daily task:', error);
    }
}
