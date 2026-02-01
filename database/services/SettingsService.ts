import { Q } from '@nozbe/watermelondb';

import { UNITS_SETTING_TYPE } from '../../constants/settings';
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
}

export default SettingsService;
