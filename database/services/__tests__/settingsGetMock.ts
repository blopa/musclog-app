import { SETTINGS, type SettingDefinition } from '@/constants/settingDefinitions';

export type SettingValues = { [K in keyof typeof SETTINGS]?: (typeof SETTINGS)[K]['defaultValue'] };

/**
 * A stand-in for `SettingsService.get` that answers per setting: the value given here, else the
 * setting's own default — what the real service returns with nothing stored. Tests stub one
 * setting by name exactly as they used to stub its getter.
 *
 *   SettingsService.get = settingsGetMock({ workoutAutonomy: 'manual' });
 */
export function settingsGetMock(values: SettingValues = {}) {
  return jest.fn(async <T>(setting: SettingDefinition<T>): Promise<T> => {
    const key = (Object.keys(SETTINGS) as (keyof typeof SETTINGS)[]).find(
      (name) => SETTINGS[name].type === setting.type
    );
    return key && key in values ? (values[key] as T) : setting.defaultValue;
  });
}
