import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  ChatService,
  NutritionService,
  SettingsService,
  WorkoutService,
} from '../database/services';
import i18n from '../lang/lang';
import AiService from '../services/AiService';
import { getNutritionInsights, getRecentWorkoutsInsights } from './coachAI';

const DAILY_TASKS_TIMESTAMP_KEY = 'daily_tasks_last_run';

/**
 * Check if task should run today
 * Returns true if it's a new day since last run
 */
async function shouldRunToday(): Promise<boolean> {
  try {
    const lastRunTimestamp = await AsyncStorage.getItem(DAILY_TASKS_TIMESTAMP_KEY);
    if (!lastRunTimestamp) {
      return true; // First run ever
    }

    const lastRunDate = new Date(parseInt(lastRunTimestamp, 10));
    const today = new Date();

    // Compare dates (ignore time)
    return (
      lastRunDate.getFullYear() !== today.getFullYear() ||
      lastRunDate.getMonth() !== today.getMonth() ||
      lastRunDate.getDate() !== today.getDate()
    );
  } catch (error) {
    console.error('[shouldRunToday] Error:', error);
    return false;
  }
}

/**
 * Mark today as having run the daily tasks
 */
async function markTodayAsRun(): Promise<void> {
  try {
    await AsyncStorage.setItem(DAILY_TASKS_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error('[markTodayAsRun] Error:', error);
  }
}

/**
 * Configure and run daily AI insights tasks
 * Called on app startup (native only)
 */
export async function configureDailyTasks(onInsightsGenerated?: () => void): Promise<void> {
  try {
    // Only run on native platforms
    if (Platform.OS === 'web') {
      console.log('[configureDailyTasks] Skipping on web platform');
      return;
    }

    // Check if we've already run today
    const runToday = await shouldRunToday();
    if (!runToday) {
      console.log('[configureDailyTasks] Already ran today, skipping');
      return;
    }

    console.log('[configureDailyTasks] Starting daily tasks');

    // Get AI config
    const aiConfig = await AiService.getAiConfig();
    if (!aiConfig) {
      console.log('[configureDailyTasks] AI not configured, skipping insights');
      return;
    }

    // Calculate date range (last 7 days)
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 7);

    // Format dates as ISO strings
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = today.toISOString().split('T')[0];

    const [workoutInsightsEnabled, nutritionInsightsEnabled] = await Promise.all([
      SettingsService.getWorkoutInsights(),
      SettingsService.getDailyNutritionInsights(),
    ]);

    // Generate workout insights
    if (!workoutInsightsEnabled) {
      console.log('[configureDailyTasks] Workout insights disabled, skipping');
    } else {
      try {
        const startTs = new Date(startDateStr).setUTCHours(0, 0, 0, 0);
        const endTs = new Date(endDateStr).setUTCHours(23, 59, 59, 999);
        const workoutLogs = await WorkoutService.getWorkoutHistory({
          startDate: startTs,
          endDate: endTs,
        });

        let workoutMessage: string;
        if (workoutLogs.length === 0) {
          workoutMessage = i18n.t('coach.insights.noWorkoutLogs');
        } else {
          console.log('[configureDailyTasks] Generating workout insights...');
          workoutMessage =
            (await getRecentWorkoutsInsights(aiConfig, startDateStr, endDateStr)) ?? '';
        }

        if (workoutMessage) {
          await ChatService.saveMessage({
            sender: 'coach',
            message: workoutMessage,
            context: 'exercise',
            messageType: 'text',
            summarizedMessage: workoutMessage.substring(0, 200),
          });
          console.log('[configureDailyTasks] Workout insights saved');
        }
      } catch (error) {
        console.error('[configureDailyTasks] Error generating workout insights:', error);
      }
    }

    // Generate nutrition insights
    if (!nutritionInsightsEnabled) {
      console.log('[configureDailyTasks] Nutrition insights disabled, skipping');
    } else {
      try {
        const nutritionLogs = await NutritionService.getNutritionLogsForDateRange(
          new Date(startDateStr),
          new Date(endDateStr)
        );

        let nutritionMessage: string;
        if (nutritionLogs.length === 0) {
          nutritionMessage = i18n.t('coach.insights.noNutritionLogs');
        } else {
          console.log('[configureDailyTasks] Generating nutrition insights...');
          nutritionMessage = (await getNutritionInsights(aiConfig, startDateStr, endDateStr)) ?? '';
        }

        if (nutritionMessage) {
          await ChatService.saveMessage({
            sender: 'coach',
            message: nutritionMessage,
            context: 'nutrition',
            messageType: 'text',
            summarizedMessage: nutritionMessage.substring(0, 200),
          });
          console.log('[configureDailyTasks] Nutrition insights saved');
        }
      } catch (error) {
        console.error('[configureDailyTasks] Error generating nutrition insights:', error);
      }
    }

    // Mark today as complete and notify if insights were generated
    await markTodayAsRun();
    onInsightsGenerated?.();

    console.log('[configureDailyTasks] Daily tasks completed');
  } catch (error) {
    console.error('[configureDailyTasks] Unexpected error:', error);
  }
}
