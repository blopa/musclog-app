import { requireOptionalNativeModule } from 'expo';

/**
 * The native launcher-icon switcher (`android/…/ThemeAppIconModule.kt`,
 * `ios/ThemeAppIconModule.swift`). Icon names are the PascalCase theme names from
 * `constants/themeAppIcons.js`; `null` means the default icon.
 *
 * `null` on web, in Jest, and in any build made before the module existed —
 * callers treat that as "this platform cannot switch icons".
 */
export type ThemeAppIconNativeModule = {
  getAppIcon(): Promise<string | null>;
  setAppIcon(name: string | null): Promise<string | null>;
};

export const themeAppIconModule =
  requireOptionalNativeModule<ThemeAppIconNativeModule>('ThemeAppIcon');
