import { Q } from '@nozbe/watermelondb';

import {
  CONNECT_HEALTH_DATA_SETTING_TYPE,
  READ_HEALTH_DATA_SETTING_TYPE,
  THEME_SETTING_TYPE,
  UNITS_SETTING_TYPE,
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
}

export default SettingsService;
