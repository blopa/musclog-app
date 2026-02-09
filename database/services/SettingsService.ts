import { Q } from '@nozbe/watermelondb';

import {
  ANONYMOUS_BUG_REPORT_SETTING_TYPE,
  CONNECT_HEALTH_DATA_SETTING_TYPE,
  DAILY_NUTRITION_INSIGHTS_SETTING_TYPE,
  ENABLE_GOOGLE_GEMINI_SETTING_TYPE,
  ENABLE_OPENAI_SETTING_TYPE,
  GOOGLE_GEMINI_API_KEY_SETTING_TYPE,
  GOOGLE_GEMINI_MODEL_SETTING_TYPE,
  OPENAI_API_KEY_SETTING_TYPE,
  OPENAI_MODEL_SETTING_TYPE,
  READ_HEALTH_DATA_SETTING_TYPE,
  THEME_SETTING_TYPE,
  UNITS_SETTING_TYPE,
  WORKOUT_INSIGHTS_SETTING_TYPE,
  WRITE_HEALTH_DATA_SETTING_TYPE,
} from '../../constants/settings';
import { database } from '../../database';
import Setting from '../models/Setting';

export class SettingsService {
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
    await this.setBooleanSetting(CONNECT_HEALTH_DATA_SETTING_TYPE, value);
  }

  /**
   * Upsert the read health data setting
   */
  static async setReadHealthData(value: boolean) {
    await this.setBooleanSetting(READ_HEALTH_DATA_SETTING_TYPE, value);
  }

  /**
   * Upsert the write health data setting
   */
  static async setWriteHealthData(value: boolean) {
    await this.setBooleanSetting(WRITE_HEALTH_DATA_SETTING_TYPE, value);
  }

  /**
   * Upsert the anonymous bug report setting
   */
  static async setAnonymousBugReport(value: boolean) {
    await this.setBooleanSetting(ANONYMOUS_BUG_REPORT_SETTING_TYPE, value);
  }

  /**
   * Upsert the Google Gemini API key setting
   */
  static async setGoogleGeminiApiKey(value: string) {
    await this.setStringSetting(GOOGLE_GEMINI_API_KEY_SETTING_TYPE, value);
  }

  /**
   * Upsert the Google Gemini model setting
   */
  static async setGoogleGeminiModel(value: string) {
    await this.setStringSetting(GOOGLE_GEMINI_MODEL_SETTING_TYPE, value);
  }

  /**
   * Upsert the OpenAI API key setting
   */
  static async setOpenAiApiKey(value: string) {
    await this.setStringSetting(OPENAI_API_KEY_SETTING_TYPE, value);
  }

  /**
   * Upsert the OpenAI model setting
   */
  static async setOpenAiModel(value: string) {
    await this.setStringSetting(OPENAI_MODEL_SETTING_TYPE, value);
  }

  /**
   * Upsert the enable Google Gemini setting
   */
  static async setEnableGoogleGemini(value: boolean) {
    await this.setBooleanSetting(ENABLE_GOOGLE_GEMINI_SETTING_TYPE, value);
  }

  /**
   * Upsert the enable OpenAI setting
   */
  static async setEnableOpenAi(value: boolean) {
    await this.setBooleanSetting(ENABLE_OPENAI_SETTING_TYPE, value);
  }

  /**
   * Upsert the daily nutrition insights setting
   */
  static async setDailyNutritionInsights(value: boolean) {
    await this.setBooleanSetting(DAILY_NUTRITION_INSIGHTS_SETTING_TYPE, value);
  }

  /**
   * Upsert the workout insights setting
   */
  static async setWorkoutInsights(value: boolean) {
    await this.setBooleanSetting(WORKOUT_INSIGHTS_SETTING_TYPE, value);
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
        await existingSetting[0].update((setting) => {
          setting.value = value.toString();
          setting.updatedAt = now;
        });
      } else {
        await database.get<Setting>('settings').create((setting) => {
          setting.type = type;
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
          setting.type = type;
          setting.value = value;
          setting.createdAt = now;
          setting.updatedAt = now;
        });
      }
    });
  }
}

export default SettingsService;
