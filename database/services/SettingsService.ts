import { Q } from '@nozbe/watermelondb';

import {
  ADVANCED_DATA_MANAGEMENT_SETTING_TYPE,
  ALWAYS_ALLOW_FOOD_EDITING_SETTING_TYPE,
  ANONYMOUS_BUG_REPORT_SETTING_TYPE,
  CHART_TOOLTIP_POSITION_SETTING_TYPE,
  CONNECT_HEALTH_DATA_SETTING_TYPE,
  CONVERSATION_CONTEXT,
  DAILY_NUTRITION_INSIGHTS_SETTING_TYPE,
  ENABLE_GOOGLE_GEMINI_SETTING_TYPE,
  ENABLE_LOCAL_LLM_SETTING_TYPE,
  ENABLE_OPENAI_SETTING_TYPE,
  FOOD_SEARCH_SOURCE_SETTING_TYPE,
  type FoodSearchSource,
  GOOGLE_GEMINI_API_KEY_SETTING_TYPE,
  GOOGLE_GEMINI_MODEL_SETTING_TYPE,
  INTUITIVE_EATING_MODE_SETTING_TYPE,
  LANGUAGE_SETTING_TYPE,
  LOCAL_LLM_API_KEY_SETTING_TYPE,
  LOCAL_LLM_BASE_URL_SETTING_TYPE,
  LOCAL_LLM_MODEL_SETTING_TYPE,
  MAX_AI_MEMORIES_SETTING_TYPE,
  MUSCLOG_GATEWAY_ANONYMOUS_ID_SETTING_TYPE,
  NAV_SLOT_1_SETTING_TYPE,
  NAV_SLOT_2_SETTING_TYPE,
  NAV_SLOT_3_SETTING_TYPE,
  type NavItemKey,
  NOTIFICATIONS_ACTIVE_WORKOUT_SETTING_TYPE,
  NOTIFICATIONS_MENSTRUAL_CYCLE_SETTING_TYPE,
  NOTIFICATIONS_NUTRITION_OVERVIEW_SETTING_TYPE,
  NOTIFICATIONS_REST_TIMER_SETTING_TYPE,
  NOTIFICATIONS_SETTING_TYPE,
  NOTIFICATIONS_WORKOUT_DURATION_SETTING_TYPE,
  NOTIFICATIONS_WORKOUT_REMINDERS_SETTING_TYPE,
  NUTRITION_DISPLAY_SETTING_TYPE,
  OPENAI_API_KEY_SETTING_TYPE,
  OPENAI_MODEL_SETTING_TYPE,
  PROGRESSION_MODE_SETTING_TYPE,
  type ProgressionMode,
  READ_HEALTH_DATA_SETTING_TYPE,
  REQUIRE_EXPORT_ENCRYPTION_SETTING_TYPE,
  SEND_FOUNDATION_FOODS_TO_LLM_SETTING_TYPE,
  SHOW_DAILY_MOOD_PROMPT_SETTING_TYPE,
  SHOW_WEIGHT_PREDICTION_SETTING_TYPE,
  THEME_SETTING_TYPE,
  UNITS_SETTING_TYPE,
  USE_MUSCLOG_FREE_TIER_SETTING_TYPE,
  USE_OCR_BEFORE_AI_SETTING_TYPE,
  USE_ON_DEVICE_AI_SETTING_TYPE,
  WORKOUT_INSIGHTS_SETTING_TYPE,
  WRITE_HEALTH_DATA_SETTING_TYPE,
} from '@/constants/settings';
import { database } from '@/database/database-instance';
import { encryptOptionalString } from '@/database/encryptionHelpers';
import Setting, { type SettingType } from '@/database/models/Setting';
import { decryptDatabaseValue } from '@/utils/encryption';
import { getDefaultUnits } from '@/utils/units';

export class SettingsService {
  /**
   * Get the current units setting ('metric' | 'imperial').
   * Defaults to 'metric' if not set.
   */
  static async getUnits(): Promise<'metric' | 'imperial'> {
    const settings = await database
      .get<Setting>('settings')
      .query(Q.where('type', UNITS_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)))
      .fetch();
    if (settings.length === 0) {
      return getDefaultUnits();
    }
    return settings[0].value === '1' ? 'imperial' : 'metric';
  }

  /**
   * Upsert the units setting ('metric' | 'imperial')
   */
  static async setUnits(units: 'metric' | 'imperial') {
    const now = Date.now();

    const existingUnitsSetting = await database
      .get<Setting>('settings')
      .query(Q.where('type', UNITS_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    const unitsValue = units === 'imperial' ? 1 : 0;

    await database.write(async () => {
      if (existingUnitsSetting.length > 0) {
        await existingUnitsSetting[0].update((setting) => {
          setting.value = unitsValue.toString();
          setting.updatedAt = now;
        });
      } else {
        await database.get<Setting>('settings').create((setting) => {
          setting.type = UNITS_SETTING_TYPE;
          setting.value = unitsValue.toString();
          setting.createdAt = now;
          setting.updatedAt = now;
        });
      }
    });
  }

  /**
   * Get the theme preference setting ('system' | 'light' | 'dark').
   * Defaults to 'system' if not set.
   */
  static async getThemePreference(): Promise<'system' | 'light' | 'dark'> {
    return (await SettingsService.getStringSetting(THEME_SETTING_TYPE, 'system')) as
      | 'system'
      | 'light'
      | 'dark';
  }

  /**
   * Upsert the theme setting ('system' | 'light' | 'dark')
   */
  static async setTheme(theme: 'system' | 'light' | 'dark') {
    const now = Date.now();

    const existingThemeSetting = await database
      .get<Setting>('settings')
      .query(Q.where('type', THEME_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    await database.write(async () => {
      if (existingThemeSetting.length > 0) {
        await existingThemeSetting[0].update((setting) => {
          setting.value = theme;
          setting.updatedAt = now;
        });
      } else {
        await database.get<Setting>('settings').create((setting) => {
          setting.type = THEME_SETTING_TYPE;
          setting.value = theme;
          setting.createdAt = now;
          setting.updatedAt = now;
        });
      }
    });
  }

  /**
   * Upsert the connect health data setting
   */
  static async setConnectHealthData(value: boolean) {
    await SettingsService.setBooleanSetting(CONNECT_HEALTH_DATA_SETTING_TYPE, value);
  }

  /**
   * Upsert the read health data setting
   */
  static async setReadHealthData(value: boolean) {
    await SettingsService.setBooleanSetting(READ_HEALTH_DATA_SETTING_TYPE, value);
  }

  /**
   * Upsert the write health data setting
   */
  static async setWriteHealthData(value: boolean) {
    await SettingsService.setBooleanSetting(WRITE_HEALTH_DATA_SETTING_TYPE, value);
  }

  /**
   * Upsert the anonymous bug report setting
   */
  static async setAnonymousBugReport(value: boolean) {
    await SettingsService.setBooleanSetting(ANONYMOUS_BUG_REPORT_SETTING_TYPE, value);
  }

  /**
   * Get the anonymous bug report setting
   */
  static async getAnonymousBugReport(): Promise<boolean> {
    const settings = await database
      .get<Setting>('settings')
      .query(Q.where('type', ANONYMOUS_BUG_REPORT_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    if (settings.length === 0) {
      return true; // Default to true for existing users
    }

    // If multiple settings exist, use the most recent one
    const mostRecent = settings.reduce((latest, current) =>
      current.updatedAt > latest.updatedAt ? current : latest
    );

    return mostRecent.value === 'true';
  }

  /**
   * Upsert the Google Gemini API key setting (stored encrypted)
   */
  static async setGoogleGeminiApiKey(value: string) {
    await SettingsService.setEncryptedStringSetting(GOOGLE_GEMINI_API_KEY_SETTING_TYPE, value);
  }

  /**
   * Upsert the Google Gemini model setting
   */
  static async setGoogleGeminiModel(value: string) {
    await SettingsService.setStringSetting(GOOGLE_GEMINI_MODEL_SETTING_TYPE, value);
  }

  /**
   * Upsert the OpenAI API key setting (stored encrypted)
   */
  static async setOpenAiApiKey(value: string) {
    await SettingsService.setEncryptedStringSetting(OPENAI_API_KEY_SETTING_TYPE, value);
  }

  /**
   * Upsert the OpenAI model setting
   */
  static async setOpenAiModel(value: string) {
    await SettingsService.setStringSetting(OPENAI_MODEL_SETTING_TYPE, value);
  }

  /**
   * Upsert the Local LLM API key setting (stored encrypted)
   */
  static async setLocalLlmApiKey(value: string) {
    await SettingsService.setEncryptedStringSetting(LOCAL_LLM_API_KEY_SETTING_TYPE, value);
  }

  /**
   * Upsert the Local LLM model setting
   */
  static async setLocalLlmModel(value: string) {
    await SettingsService.setStringSetting(LOCAL_LLM_MODEL_SETTING_TYPE, value);
  }

  /**
   * Upsert the Local LLM base URL setting
   */
  static async setLocalLlmBaseUrl(value: string) {
    await SettingsService.setStringSetting(LOCAL_LLM_BASE_URL_SETTING_TYPE, value);
  }

  /**
   * Upsert the enable Google Gemini setting
   */
  static async setEnableGoogleGemini(value: boolean) {
    try {
      await SettingsService.setBooleanSetting(ENABLE_GOOGLE_GEMINI_SETTING_TYPE, value);
    } catch (error) {
      console.error('[SettingsService] Error in setEnableGoogleGemini:', error);
      throw error;
    }
  }

  /**
   * Upsert the enable OpenAI setting
   */
  static async setEnableOpenAi(value: boolean) {
    try {
      await SettingsService.setBooleanSetting(ENABLE_OPENAI_SETTING_TYPE, value);
    } catch (error) {
      console.error('[SettingsService] Error in setEnableOpenAi:', error);
      throw error;
    }
  }

  /**
   * Upsert the enable Local LLM setting
   */
  static async setEnableLocalLlm(value: boolean) {
    try {
      await SettingsService.setBooleanSetting(ENABLE_LOCAL_LLM_SETTING_TYPE, value);
    } catch (error) {
      console.error('[SettingsService] Error in setEnableLocalLlm:', error);
      throw error;
    }
  }

  /**
   * Upsert the daily nutrition insights setting
   */
  static async setDailyNutritionInsights(value: boolean) {
    try {
      await SettingsService.setBooleanSetting(DAILY_NUTRITION_INSIGHTS_SETTING_TYPE, value);
    } catch (error) {
      console.error('[SettingsService] Error in setDailyNutritionInsights:', error);
      throw error;
    }
  }

  /**
   * Upsert the workout insights setting
   */
  static async setWorkoutInsights(value: boolean) {
    try {
      await SettingsService.setBooleanSetting(WORKOUT_INSIGHTS_SETTING_TYPE, value);
    } catch (error) {
      console.error('[SettingsService] Error in setWorkoutInsights:', error);
      throw error;
    }
  }

  /**
   * Upsert the notifications setting
   */
  static async setNotifications(value: boolean) {
    await SettingsService.setBooleanSetting(NOTIFICATIONS_SETTING_TYPE, value);
  }

  /**
   * Upsert the workout reminders notification setting
   */
  static async setNotificationsWorkoutReminders(value: boolean) {
    await SettingsService.setBooleanSetting(NOTIFICATIONS_WORKOUT_REMINDERS_SETTING_TYPE, value);
  }

  /**
   * Upsert the active workout notification setting
   */
  static async setNotificationsActiveWorkout(value: boolean) {
    await SettingsService.setBooleanSetting(NOTIFICATIONS_ACTIVE_WORKOUT_SETTING_TYPE, value);
  }

  /**
   * Upsert the nutrition overview notification setting
   */
  static async setNotificationsNutritionOverview(value: boolean) {
    await SettingsService.setBooleanSetting(NOTIFICATIONS_NUTRITION_OVERVIEW_SETTING_TYPE, value);
  }

  /**
   * Upsert the menstrual cycle notification setting
   */
  static async setNotificationsMenstrualCycle(value: boolean) {
    await SettingsService.setBooleanSetting(NOTIFICATIONS_MENSTRUAL_CYCLE_SETTING_TYPE, value);
  }

  /**
   * Upsert the rest timer alert notification setting
   */
  static async setNotificationsRestTimer(value: boolean) {
    await SettingsService.setBooleanSetting(NOTIFICATIONS_REST_TIMER_SETTING_TYPE, value);
  }

  /**
   * Upsert the workout duration warning notification setting
   */
  static async setNotificationsWorkoutDuration(value: boolean) {
    await SettingsService.setBooleanSetting(NOTIFICATIONS_WORKOUT_DURATION_SETTING_TYPE, value);
  }

  /**
   * Set the coach conversation context
   */
  static async setCoachConversationContext(value: 'general' | 'exercise' | 'nutrition') {
    await SettingsService.setStringSetting(CONVERSATION_CONTEXT, value);
  }

  /**
   * Upsert the use OCR before AI setting
   */
  static async setUseOcrBeforeAi(value: boolean) {
    await SettingsService.setBooleanSetting(USE_OCR_BEFORE_AI_SETTING_TYPE, value);
  }

  /**
   * Upsert the send foundation foods to LLM setting
   */
  static async setSendFoundationFoodsToLlm(value: boolean) {
    await SettingsService.setBooleanSetting(SEND_FOUNDATION_FOODS_TO_LLM_SETTING_TYPE, value);
  }

  /**
   * Upsert the language setting
   */
  static async setLanguage(language: string) {
    await SettingsService.setStringSetting(LANGUAGE_SETTING_TYPE, language);
  }

  /**
   * Get the language setting
   */
  static async getLanguage(): Promise<string> {
    const settings = await database
      .get<Setting>('settings')
      .query(Q.where('type', LANGUAGE_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    if (settings.length === 0) {
      return 'en-US';
    }

    return settings[0].value;
  }

  // --- AI Settings Getters ---

  static async getGoogleGeminiApiKey(): Promise<string> {
    return SettingsService.getEncryptedStringSetting(GOOGLE_GEMINI_API_KEY_SETTING_TYPE);
  }

  static async getGoogleGeminiModel(): Promise<string> {
    return SettingsService.getStringSetting(GOOGLE_GEMINI_MODEL_SETTING_TYPE, '');
  }

  static async getOpenAiApiKey(): Promise<string> {
    return SettingsService.getEncryptedStringSetting(OPENAI_API_KEY_SETTING_TYPE);
  }

  static async getOpenAiModel(): Promise<string> {
    return SettingsService.getStringSetting(OPENAI_MODEL_SETTING_TYPE, '');
  }

  static async getLocalLlmApiKey(): Promise<string> {
    return SettingsService.getEncryptedStringSetting(LOCAL_LLM_API_KEY_SETTING_TYPE);
  }

  static async getLocalLlmModel(): Promise<string> {
    return SettingsService.getStringSetting(LOCAL_LLM_MODEL_SETTING_TYPE, '');
  }

  static async getLocalLlmBaseUrl(): Promise<string> {
    return SettingsService.getStringSetting(LOCAL_LLM_BASE_URL_SETTING_TYPE, '');
  }

  static async getEnableGoogleGemini(): Promise<boolean> {
    return SettingsService.getBooleanSetting(ENABLE_GOOGLE_GEMINI_SETTING_TYPE, true);
  }

  static async getEnableOpenAi(): Promise<boolean> {
    return SettingsService.getBooleanSetting(ENABLE_OPENAI_SETTING_TYPE, true);
  }

  static async getEnableLocalLlm(): Promise<boolean> {
    return SettingsService.getBooleanSetting(ENABLE_LOCAL_LLM_SETTING_TYPE, false);
  }

  static async getNotifications(): Promise<boolean> {
    return SettingsService.getBooleanSetting(NOTIFICATIONS_SETTING_TYPE, false);
  }

  static async getNotificationsWorkoutReminders(): Promise<boolean> {
    return SettingsService.getBooleanSetting(NOTIFICATIONS_WORKOUT_REMINDERS_SETTING_TYPE, false);
  }

  static async getNotificationsActiveWorkout(): Promise<boolean> {
    return SettingsService.getBooleanSetting(NOTIFICATIONS_ACTIVE_WORKOUT_SETTING_TYPE, false);
  }

  static async getNotificationsNutritionOverview(): Promise<boolean> {
    return SettingsService.getBooleanSetting(NOTIFICATIONS_NUTRITION_OVERVIEW_SETTING_TYPE, false);
  }

  static async getNotificationsMenstrualCycle(): Promise<boolean> {
    return SettingsService.getBooleanSetting(NOTIFICATIONS_MENSTRUAL_CYCLE_SETTING_TYPE, false);
  }

  static async getNotificationsRestTimer(): Promise<boolean> {
    return SettingsService.getBooleanSetting(NOTIFICATIONS_REST_TIMER_SETTING_TYPE, false);
  }

  static async getNotificationsWorkoutDuration(): Promise<boolean> {
    return SettingsService.getBooleanSetting(NOTIFICATIONS_WORKOUT_DURATION_SETTING_TYPE, false);
  }

  static async getCoachConversationContext(): Promise<'general' | 'exercise' | 'nutrition'> {
    return (await SettingsService.getStringSetting(CONVERSATION_CONTEXT, 'general')) as unknown as
      | 'general'
      | 'exercise'
      | 'nutrition';
  }

  static async getSendFoundationFoodsToLlm(): Promise<boolean> {
    return SettingsService.getBooleanSetting(SEND_FOUNDATION_FOODS_TO_LLM_SETTING_TYPE, true);
  }

  static async getDailyNutritionInsights(): Promise<boolean> {
    return SettingsService.getBooleanSetting(DAILY_NUTRITION_INSIGHTS_SETTING_TYPE, true);
  }

  static async getWorkoutInsights(): Promise<boolean> {
    return SettingsService.getBooleanSetting(WORKOUT_INSIGHTS_SETTING_TYPE, false);
  }

  /**
   * Upsert the food search source setting ('both' | 'openfood' | 'usda')
   */
  static async setFoodSearchSource(source: FoodSearchSource) {
    await SettingsService.setStringSetting(FOOD_SEARCH_SOURCE_SETTING_TYPE, source);
  }

  /**
   * Upsert the chart tooltip position setting ('left' | 'right')
   */
  static async setChartTooltipPosition(position: 'left' | 'right') {
    await SettingsService.setStringSetting(CHART_TOOLTIP_POSITION_SETTING_TYPE, position);
  }

  /**
   * Upsert the max AI memories setting
   */
  static async setMaxAiMemories(value: number) {
    await SettingsService.setStringSetting(MAX_AI_MEMORIES_SETTING_TYPE, value.toString());
  }

  /**
   * Upsert the show daily mood prompt setting
   */
  static async setShowDailyMoodPrompt(value: boolean) {
    await SettingsService.setBooleanSetting(SHOW_DAILY_MOOD_PROMPT_SETTING_TYPE, value);
  }

  /**
   * Upsert the always allow food editing setting
   */
  static async setAlwaysAllowFoodEditing(value: boolean) {
    await SettingsService.setBooleanSetting(ALWAYS_ALLOW_FOOD_EDITING_SETTING_TYPE, value);
  }

  /**
   * Upsert the show weight prediction setting
   */
  static async setShowWeightPrediction(value: boolean) {
    await SettingsService.setBooleanSetting(SHOW_WEIGHT_PREDICTION_SETTING_TYPE, value);
  }

  /**
   * Upsert the require export encryption setting
   */
  static async setRequireExportEncryption(value: boolean) {
    await SettingsService.setBooleanSetting(REQUIRE_EXPORT_ENCRYPTION_SETTING_TYPE, value);
  }

  /**
   * One-time migration: enable require-export-encryption by default for users
   * who have never explicitly configured it. Safe to call on every boot — exits
   * immediately if the setting already exists in the DB.
   */
  static async migrateRequireExportEncryptionDefault() {
    const existing = await database
      .get<Setting>('settings')
      .query(
        Q.where('type', REQUIRE_EXPORT_ENCRYPTION_SETTING_TYPE),
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();

    if (existing.length === 0) {
      await SettingsService.setBooleanSetting(REQUIRE_EXPORT_ENCRYPTION_SETTING_TYPE, true);
    }
  }

  /**
   * Get the require export encryption setting
   */
  static async getRequireExportEncryption(): Promise<boolean> {
    return SettingsService.getBooleanSetting(REQUIRE_EXPORT_ENCRYPTION_SETTING_TYPE, true);
  }

  /**
   * Get the always allow food editing setting
   */
  static async getAlwaysAllowFoodEditing(): Promise<boolean> {
    return SettingsService.getBooleanSetting(ALWAYS_ALLOW_FOOD_EDITING_SETTING_TYPE, false);
  }

  /**
   * Upsert the advanced data management setting
   */
  static async setAdvancedDataManagement(value: boolean) {
    await SettingsService.setBooleanSetting(ADVANCED_DATA_MANAGEMENT_SETTING_TYPE, value);
  }

  /**
   * Upsert the intuitive eating mode setting
   */
  static async setIntuitiveEatingMode(value: boolean) {
    await SettingsService.setBooleanSetting(INTUITIVE_EATING_MODE_SETTING_TYPE, value);
  }

  /**
   * Get the intuitive eating mode setting
   */
  static async getIntuitiveEatingMode(): Promise<boolean> {
    return SettingsService.getBooleanSetting(INTUITIVE_EATING_MODE_SETTING_TYPE, false);
  }

  /**
   * Get the progression mode setting ('reps_first' | 'weight_first').
   * Defaults to 'reps_first'.
   */
  static async getProgressionMode(): Promise<ProgressionMode> {
    return (await SettingsService.getStringSetting(
      PROGRESSION_MODE_SETTING_TYPE,
      'reps_first'
    )) as ProgressionMode;
  }

  /**
   * Upsert the progression mode setting ('reps_first' | 'weight_first')
   */
  static async setProgressionMode(mode: ProgressionMode) {
    await SettingsService.setStringSetting(PROGRESSION_MODE_SETTING_TYPE, mode);
  }

  /**
   * Upsert the nutrition display setting.
   * Binary string of length 5: positions 0-4 map to carbs, protein, fats, fiber, alcohol.
   * '1' = visible, '0' = hidden. Default: '11111'.
   */
  static async setNutritionDisplay(value: string) {
    await SettingsService.setStringSetting(NUTRITION_DISPLAY_SETTING_TYPE, value);
  }

  /**
   * Get the nutrition display setting.
   * Returns a 5-char binary string. Defaults to '11111' (all visible).
   */
  static async getNutritionDisplay(): Promise<string> {
    return SettingsService.getStringSetting(NUTRITION_DISPLAY_SETTING_TYPE, '11111');
  }

  /**
   * Get the max AI memories setting.
   * Defaults to 50 if not set.
   */
  static async getMaxAiMemories(): Promise<number> {
    const value = await SettingsService.getStringSetting(MAX_AI_MEMORIES_SETTING_TYPE, '50');
    return parseInt(value, 10) || 50;
  }

  /**
   * Get the food search source setting.
   * Defaults to 'both' if not set.
   */
  static async getFoodSearchSource(): Promise<FoodSearchSource> {
    return (await SettingsService.getStringSetting(
      FOOD_SEARCH_SOURCE_SETTING_TYPE,
      'both'
    )) as FoodSearchSource;
  }

  // --- Private helpers ---

  private static async getStringSetting(type: string, defaultValue: string): Promise<string> {
    const settings = await database
      .get<Setting>('settings')
      .query(Q.where('type', type), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    if (settings.length === 0) {
      return defaultValue;
    }

    const mostRecent = settings.reduce((latest, current) =>
      current.updatedAt > latest.updatedAt ? current : latest
    );

    return mostRecent.value ?? defaultValue;
  }

  private static async getBooleanSetting(type: string, defaultValue: boolean): Promise<boolean> {
    const settings = await database
      .get<Setting>('settings')
      .query(Q.where('type', type), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    if (settings.length === 0) {
      return defaultValue;
    }

    const mostRecent = settings.reduce((latest, current) =>
      current.updatedAt > latest.updatedAt ? current : latest
    );

    return mostRecent.value === 'true';
  }

  /**
   * Helper method to upsert boolean settings
   */
  private static async setBooleanSetting(type: string, value: boolean) {
    const now = Date.now();

    const existingSetting = await database
      .get<Setting>('settings')
      .query(Q.where('type', type), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    await database.write(async () => {
      if (existingSetting.length > 0) {
        // Find the most recent setting
        const mostRecent = existingSetting.reduce((latest, current) =>
          current.updatedAt > latest.updatedAt ? current : latest
        );

        await mostRecent.update((setting) => {
          setting.value = value.toString();
          setting.updatedAt = now;
        });

        // Clean up any duplicate settings
        if (existingSetting.length > 1) {
          for (const setting of existingSetting) {
            if (setting.id !== mostRecent.id) {
              await setting.update((s) => {
                s.deletedAt = now;
              });
            }
          }
        }
      } else {
        await database.get<Setting>('settings').create((setting) => {
          setting.type = type as SettingType;
          setting.value = value.toString();
          setting.createdAt = now;
          setting.updatedAt = now;
        });
      }
    });
  }

  /**
   * Get the nav item key for a customizable nav slot (1=left, 2=right of camera, 3=rightmost).
   * Defaults: slot 1 = workouts, slot 2 = food, slot 3 = profile.
   */
  static async getNavSlot(slot: 1 | 2 | 3): Promise<NavItemKey> {
    const defaults: Record<1 | 2 | 3, NavItemKey> = {
      1: 'workouts',
      2: 'food',
      3: 'profile',
    };
    const type =
      slot === 1
        ? NAV_SLOT_1_SETTING_TYPE
        : slot === 2
          ? NAV_SLOT_2_SETTING_TYPE
          : NAV_SLOT_3_SETTING_TYPE;
    const value = await SettingsService.getStringSetting(type, defaults[slot]);
    return value as NavItemKey;
  }

  /**
   * Upsert the nav item key for a customizable nav slot.
   */
  static async setNavSlot(slot: 1 | 2 | 3, item: NavItemKey) {
    const type =
      slot === 1
        ? NAV_SLOT_1_SETTING_TYPE
        : slot === 2
          ? NAV_SLOT_2_SETTING_TYPE
          : NAV_SLOT_3_SETTING_TYPE;
    await SettingsService.setStringSetting(type, item);
  }

  /**
   * Atomically swap two nav slots in a single database write to avoid intermediate
   * states that would cause the nav bar to briefly show duplicate items.
   */
  static async swapNavSlots(
    slotA: 1 | 2 | 3,
    itemA: NavItemKey,
    slotB: 1 | 2 | 3,
    itemB: NavItemKey
  ) {
    const typeA =
      slotA === 1
        ? NAV_SLOT_1_SETTING_TYPE
        : slotA === 2
          ? NAV_SLOT_2_SETTING_TYPE
          : NAV_SLOT_3_SETTING_TYPE;
    const typeB =
      slotB === 1
        ? NAV_SLOT_1_SETTING_TYPE
        : slotB === 2
          ? NAV_SLOT_2_SETTING_TYPE
          : NAV_SLOT_3_SETTING_TYPE;

    const now = Date.now();
    const [existingA, existingB] = await Promise.all([
      database
        .get<Setting>('settings')
        .query(Q.where('type', typeA), Q.where('deleted_at', Q.eq(null)))
        .fetch(),
      database
        .get<Setting>('settings')
        .query(Q.where('type', typeB), Q.where('deleted_at', Q.eq(null)))
        .fetch(),
    ]);

    await database.write(async () => {
      if (existingA.length > 0) {
        await existingA[0].update((s) => {
          s.value = itemA;
          s.updatedAt = now;
        });
      } else {
        await database.get<Setting>('settings').create((s) => {
          s.type = typeA as SettingType;
          s.value = itemA;
          s.createdAt = now;
          s.updatedAt = now;
        });
      }

      if (existingB.length > 0) {
        await existingB[0].update((s) => {
          s.value = itemB;
          s.updatedAt = now;
        });
      } else {
        await database.get<Setting>('settings').create((s) => {
          s.type = typeB as SettingType;
          s.value = itemB;
          s.createdAt = now;
          s.updatedAt = now;
        });
      }
    });
  }

  /**
   * One-time boot migration: if an API key is stored as plaintext (pre-encryption),
   * re-save it encrypted. Already-encrypted values are left untouched.
   */
  static async migrateApiKeysToEncrypted(): Promise<void> {
    await Promise.all([
      SettingsService.migrateApiKey(GOOGLE_GEMINI_API_KEY_SETTING_TYPE),
      SettingsService.migrateApiKey(OPENAI_API_KEY_SETTING_TYPE),
      SettingsService.migrateApiKey(LOCAL_LLM_API_KEY_SETTING_TYPE),
    ]);
  }

  private static async migrateApiKey(type: string): Promise<void> {
    const raw = await SettingsService.getStringSetting(type, '');
    if (!raw) {
      return;
    }
    const decrypted = await decryptDatabaseValue(raw);
    if (decrypted) {
      // Non-empty decryption result → already encrypted, nothing to do.
      return;
    }
    // Decryption returned empty → value is legacy plaintext → encrypt and re-save.
    await SettingsService.setEncryptedStringSetting(type, raw);
  }

  /**
   * Read an encrypted string setting and decrypt it.
   * Falls back to the raw value for legacy plaintext entries already in the DB.
   */
  private static async getEncryptedStringSetting(type: string): Promise<string> {
    const raw = await SettingsService.getStringSetting(type, '');
    if (!raw) {
      return '';
    }
    const decrypted = await decryptDatabaseValue(raw);
    // If AES decryption produced a non-empty result, it was an encrypted value.
    // Otherwise fall back to the raw value (legacy plaintext stored before encryption was added).
    return decrypted || raw;
  }

  /**
   * Encrypt a string value and upsert it into the settings table.
   * Stores an empty string when the value is empty.
   */
  private static async setEncryptedStringSetting(type: string, value: string) {
    const encrypted = await encryptOptionalString(value);
    await SettingsService.setStringSetting(type, encrypted);
  }

  static async setUseOnDeviceAi(value: boolean) {
    await SettingsService.setBooleanSetting(USE_ON_DEVICE_AI_SETTING_TYPE, value);
  }

  static async getUseOnDeviceAi(): Promise<boolean> {
    return SettingsService.getBooleanSetting(USE_ON_DEVICE_AI_SETTING_TYPE, false);
  }

  static async setUseMusclogFreeTier(value: boolean) {
    await SettingsService.setBooleanSetting(USE_MUSCLOG_FREE_TIER_SETTING_TYPE, value);
  }

  static async getUseMusclogFreeTier(): Promise<boolean> {
    return SettingsService.getBooleanSetting(USE_MUSCLOG_FREE_TIER_SETTING_TYPE, false);
  }

  static async setMusclogGatewayAnonymousId(id: string) {
    await SettingsService.setStringSetting(MUSCLOG_GATEWAY_ANONYMOUS_ID_SETTING_TYPE, id);
  }

  static async getMusclogGatewayAnonymousId(): Promise<string> {
    return SettingsService.getStringSetting(MUSCLOG_GATEWAY_ANONYMOUS_ID_SETTING_TYPE, '');
  }

  /**
   * Helper method to upsert string settings
   */
  private static async setStringSetting(type: string, value: string) {
    const now = Date.now();

    const existingSetting = await database
      .get<Setting>('settings')
      .query(Q.where('type', type), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    await database.write(async () => {
      if (existingSetting.length > 0) {
        await existingSetting[0].update((setting) => {
          setting.value = value;
          setting.updatedAt = now;
        });
      } else {
        await database.get<Setting>('settings').create((setting) => {
          setting.type = type as SettingType;
          setting.value = value;
          setting.createdAt = now;
          setting.updatedAt = now;
        });
      }
    });
  }
}

export default SettingsService;
