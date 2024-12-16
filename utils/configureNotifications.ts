import {
    NUTRITION_INSIGHT_WEEKLY,
    NUTRITION_INSIGHTS_TYPE,
    WORKOUT_INSIGHT_DISABLED,
    WORKOUT_INSIGHT_WEEKLY,
    WORKOUT_INSIGHTS_TYPE,
} from '@/constants/storage';
import i18n from '@/lang/lang';
import { configureDailyTasks, configureWeeklyTasks } from '@/utils/configureDailyTasks';
import { getSetting } from '@/utils/database';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowAlert: true,
    }),
});

async function scheduleInsightsNotification() {
    // const { status } = await Notifications.requestPermissionsAsync();
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
        console.log('Notification permission not granted!');
        return;
    }

    // Cancel any previously scheduled notifications to avoid duplicates
    await Notifications.cancelAllScheduledNotificationsAsync();

    const nutritionInsightType = await getSetting(NUTRITION_INSIGHTS_TYPE);
    if (nutritionInsightType?.value && nutritionInsightType.value !== WORKOUT_INSIGHT_DISABLED) {
        await Notifications.scheduleNotificationAsync({
            content: {
                body: i18n.t('musclog_nutrition_insights_description'),
                data: {
                    triggeredBy: nutritionInsightType.value === NUTRITION_INSIGHT_WEEKLY ? 'weekly-insights' : 'daily-insights',
                },
                title: i18n.t('musclog_nutrition_insights'),
            },
            // @ts-ignore it's fine
            trigger: {
                hour: 0,
                minute: 1,
                type: nutritionInsightType.value === NUTRITION_INSIGHT_WEEKLY ? SchedulableTriggerInputTypes.WEEKLY : SchedulableTriggerInputTypes.DAILY,
                ...nutritionInsightType.value === NUTRITION_INSIGHT_WEEKLY && { weekday: 1 },
            },
        });
    }

    const workoutInsightType = await getSetting(WORKOUT_INSIGHTS_TYPE);
    if (workoutInsightType?.value && workoutInsightType.value !== WORKOUT_INSIGHT_DISABLED) {
        await Notifications.scheduleNotificationAsync({
            content: {
                body: i18n.t('musclog_workout_insights_description'),
                data: {
                    triggeredBy: workoutInsightType.value === WORKOUT_INSIGHT_WEEKLY ? 'weekly-insights' : 'daily-insights',
                },
                title: i18n.t('musclog_workout_insights'),
            },
            // @ts-ignore it's fine
            trigger: {
                hour: 0,
                minute: 1,
                type: workoutInsightType.value === WORKOUT_INSIGHT_WEEKLY ? SchedulableTriggerInputTypes.WEEKLY : SchedulableTriggerInputTypes.DAILY,
                ...workoutInsightType.value === WORKOUT_INSIGHT_WEEKLY && { weekday: 1 },
            },
        });
    }
}

Notifications.addNotificationResponseReceivedListener((response) => {
    if (['daily-insights', 'weekly-insights'].includes(response.notification.request.content.data.triggeredBy)) {
        configureDailyTasks();
        configureWeeklyTasks();
    }
});

export const configureNotifications = async () => {
    if (Platform.OS === 'web') {
        console.log('Notifications are not available on the web.');
        return;
    }

    await scheduleInsightsNotification();
};
