import {
    NUTRITION_INSIGHT_DAILY,
    NUTRITION_INSIGHT_DISABLED,
    NUTRITION_INSIGHT_WEEKLY,
    NUTRITION_INSIGHTS_TYPE,
    WORKOUT_INSIGHT_DAILY,
    WORKOUT_INSIGHT_DISABLED,
    WORKOUT_INSIGHT_WEEKLY,
    WORKOUT_INSIGHTS_TYPE,
} from '@/constants/storage';
import { LAST_DAILY_TASK_RUN_DATE, LAST_WEEKLY_TASK_RUN_DATE } from '@/constants/tasks';
import packageJson from '@/package.json';
import { getNutritionInsights, getRecentWorkoutsInsights } from '@/utils/ai';
import { increaseUnreadMessages, showAlert } from '@/utils/alert';
import { addChat, getSetting } from '@/utils/database';
import {
    getDaysAgoTimestampISOString,
    getStartOfDayTimestampISOString,
} from '@/utils/date';
import { openPlayStore } from '@/utils/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetch } from 'expo/fetch';
import i18n from 'i18next';

export async function configureDailyTasks() {
    try {
        const currentDate = new Date();
        const today = currentDate.toISOString().split('T')[0];

        const lastDailyRun = await AsyncStorage.getItem(LAST_DAILY_TASK_RUN_DATE);
        if (lastDailyRun === today) {
            console.log('Daily tasks already ran today.');
            return;
        }

        const nutritionInsightType = await getSetting(NUTRITION_INSIGHTS_TYPE);
        const workoutInsightType = await getSetting(WORKOUT_INSIGHTS_TYPE);

        if (
            workoutInsightType?.value
            && workoutInsightType.value !== WORKOUT_INSIGHT_DISABLED
            && workoutInsightType.value === WORKOUT_INSIGHT_DAILY
        ) {
            const startDate = getStartOfDayTimestampISOString(
                getDaysAgoTimestampISOString(1)
            );
            const endDate = getStartOfDayTimestampISOString(
                getDaysAgoTimestampISOString(1)
            );
            const message = await getRecentWorkoutsInsights(startDate, endDate);

            if (message) {
                await addChat({
                    message,
                    misc: '',
                    sender: 'assistant',
                    type: 'text',
                });

                await increaseUnreadMessages(1);
            } else {
                console.log('No daily workout insight message to add.');
            }
        }

        // NUTRITION INSIGHTS - DAILY
        if (
            nutritionInsightType?.value
            && nutritionInsightType.value !== NUTRITION_INSIGHT_DISABLED
            && nutritionInsightType.value === NUTRITION_INSIGHT_DAILY
        ) {
            const startDate = getStartOfDayTimestampISOString(
                getDaysAgoTimestampISOString(1)
            );
            const endDate = getStartOfDayTimestampISOString(
                getDaysAgoTimestampISOString(1)
            );
            const message = await getNutritionInsights(startDate, endDate);

            if (message) {
                await addChat({
                    message,
                    misc: '',
                    sender: 'assistant',
                    type: 'text',
                });

                await increaseUnreadMessages(1);
            } else {
                console.log('No daily nutrition insight message to add.');
            }
        }

        // Update the last daily run date
        await AsyncStorage.setItem(LAST_DAILY_TASK_RUN_DATE, today);
        console.log('Daily tasks completed successfully.');
    } catch (error) {
        console.error('Error running daily tasks:', error);
    }
}

export async function configureWeeklyTasks() {
    try {
        const sevenDaysDiff = 7 * 24 * 60 * 60 * 1000;
        const currentDateTimestamp = Date.now();

        // Check if weekly tasks ran this week
        const lastWeeklyRun = await AsyncStorage.getItem(LAST_WEEKLY_TASK_RUN_DATE);
        if (lastWeeklyRun) {
            const lastRunDate = parseInt(lastWeeklyRun, 10) || Date.now();
            if (lastRunDate + sevenDaysDiff < currentDateTimestamp) {
                console.log('Weekly tasks already ran this week.');
                return;
            }
        }

        const nutritionInsightType = await getSetting(NUTRITION_INSIGHTS_TYPE);
        const workoutInsightType = await getSetting(WORKOUT_INSIGHTS_TYPE);

        if (
            workoutInsightType?.value
            && workoutInsightType.value !== WORKOUT_INSIGHT_DISABLED
            && workoutInsightType.value === WORKOUT_INSIGHT_WEEKLY
        ) {
            const startDate = getStartOfDayTimestampISOString(
                getDaysAgoTimestampISOString(7)
            );
            const endDate = getStartOfDayTimestampISOString(
                getDaysAgoTimestampISOString(0)
            );
            const message = await getRecentWorkoutsInsights(startDate, endDate);

            if (message) {
                await addChat({
                    message,
                    misc: '',
                    sender: 'assistant',
                    type: 'text',
                });

                await increaseUnreadMessages(1);
            } else {
                console.log('No weekly workout insight message to add.');
            }
        }

        if (
            nutritionInsightType?.value
            && nutritionInsightType.value !== NUTRITION_INSIGHT_DISABLED
            && nutritionInsightType.value === NUTRITION_INSIGHT_WEEKLY
        ) {
            const startDate = getStartOfDayTimestampISOString(
                getDaysAgoTimestampISOString(7)
            );
            const endDate = getStartOfDayTimestampISOString(
                getDaysAgoTimestampISOString(0)
            );
            const message = await getNutritionInsights(startDate, endDate);

            if (message) {
                await addChat({
                    message,
                    misc: '',
                    sender: 'assistant',
                    type: 'text',
                });

                await increaseUnreadMessages(1);
            } else {
                console.log('No weekly nutrition insight message to add.');
            }
        }

        try {
            const result = await fetch('https://raw.githubusercontent.com/blopa/musclog-app/refs/heads/main/package.json');
            const json = await result.json();
            if (json.version > packageJson.version) {
                showAlert(
                    i18n.t('new_version_available', { version: json.version }),
                    i18n.t('update'),
                    () => {
                        openPlayStore();
                    }
                );
            }
        } catch (error) {
            console.error('Error checking for app updates:', error);
        }

        // Update the last weekly run date
        await AsyncStorage.setItem(LAST_WEEKLY_TASK_RUN_DATE, currentDateTimestamp.toString());
        console.log('Weekly tasks completed successfully.');
    } catch (error) {
        console.error('Error running weekly tasks:', error);
    }
}
