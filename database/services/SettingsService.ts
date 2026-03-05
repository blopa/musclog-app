import { Q } from '@nozbe/watermelondb';

import {
  ANONYMOUS_BUG_REPORT_SETTING_TYPE,
  CONNECT_HEALTH_DATA_SETTING_TYPE,
  DAILY_NUTRITION_INSIGHTS_SETTING_TYPE,
  ENABLE_GOOGLE_GEMINI_SETTING_TYPE,
  ENABLE_OPENAI_SETTING_TYPE,
  GOOGLE_GEMINI_API_KEY_SETTING_TYPE,
  GOOGLE_GEMINI_MODEL_SETTING_TYPE,
  LANGUAGE_SETTING_TYPE,
  NOTIFICATIONS_SETTING_TYPE,
  OPENAI_API_KEY_SETTING_TYPE,
  OPENAI_MODEL_SETTING_TYPE,
  READ_HEALTH_DATA_SETTING_TYPE,
  THEME_SETTING_TYPE,
  UNITS_SETTING_TYPE,
  USE_OCR_BEFORE_AI_SETTING_TYPE,
  WORKOUT_INSIGHTS_SETTING_TYPE,
  WRITE_HEALTH_DATA_SETTING_TYPE,
} from '../../constants/settings';
import { database } from '../../database';
import Setting, { type SettingType } from '../models/Setting';

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
      return 'metric';
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
   * Upsert the Google Gemini API key setting
   */
  static async setGoogleGeminiApiKey(value: string) {
    await SettingsService.setStringSetting(GOOGLE_GEMINI_API_KEY_SETTING_TYPE, value);
  }

  /**
   * Upsert the Google Gemini model setting
   */
  static async setGoogleGeminiModel(value: string) {
    await SettingsService.setStringSetting(GOOGLE_GEMINI_MODEL_SETTING_TYPE, value);
  }

  /**
   * Upsert the OpenAI API key setting
   */
  static async setOpenAiApiKey(value: string) {
    await SettingsService.setStringSetting(OPENAI_API_KEY_SETTING_TYPE, value);
  }

  /**
   * Upsert the OpenAI model setting
   */
  static async setOpenAiModel(value: string) {
    await SettingsService.setStringSetting(OPENAI_MODEL_SETTING_TYPE, value);
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
   * Upsert the use OCR before AI setting
   */
  static async setUseOcrBeforeAi(value: boolean) {
    await SettingsService.setBooleanSetting(USE_OCR_BEFORE_AI_SETTING_TYPE, value);
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
    return SettingsService.getStringSetting(GOOGLE_GEMINI_API_KEY_SETTING_TYPE, '');
  }

  static async getGoogleGeminiModel(): Promise<string> {
    return SettingsService.getStringSetting(GOOGLE_GEMINI_MODEL_SETTING_TYPE, '');
  }

  static async getOpenAiApiKey(): Promise<string> {
    return SettingsService.getStringSetting(OPENAI_API_KEY_SETTING_TYPE, '');
  }

  static async getOpenAiModel(): Promise<string> {
    return SettingsService.getStringSetting(OPENAI_MODEL_SETTING_TYPE, '');
  }

  static async getEnableGoogleGemini(): Promise<boolean> {
    return SettingsService.getBooleanSetting(ENABLE_GOOGLE_GEMINI_SETTING_TYPE, false);
  }

  static async getEnableOpenAi(): Promise<boolean> {
    return SettingsService.getBooleanSetting(ENABLE_OPENAI_SETTING_TYPE, false);
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
