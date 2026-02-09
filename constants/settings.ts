/**
 * Setting type for units preference (stored in WatermelonDB settings table).
 * value: '0' = metric, '1' = imperial.
 */
export const UNITS_SETTING_TYPE = 'units';

/**
 * Setting type for theme preference (stored in WatermelonDB settings table).
 * value: 'system' | 'light' | 'dark'.
 */
export const THEME_SETTING_TYPE = 'theme';

/**
 * Setting type for health data connection (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const CONNECT_HEALTH_DATA_SETTING_TYPE = 'connect_health_data';

/**
 * Setting type for health data read permission (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const READ_HEALTH_DATA_SETTING_TYPE = 'read_health_data';

/**
 * Setting type for health data write permission (stored in WatermelonDB settings table).
 * value: 'true' | 'false'.
 */
export const WRITE_HEALTH_DATA_SETTING_TYPE = 'write_health_data';

export type Units = 'metric' | 'imperial';
export type ThemeOption = 'system' | 'light' | 'dark';

export type UseSettingsResult = {
  units: Units;
  isLoading: boolean;
  weightUnit: 'kg' | 'lbs';
  heightUnit: 'cm' | 'in';
};
