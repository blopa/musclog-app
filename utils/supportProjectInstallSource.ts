import { Platform } from 'react-native';

/** F-Droid client package name when the app was installed from F-Droid. */
export const ANDROID_FDROID_INSTALLER = 'org.fdroid.fdroid';

/**
 * Whether to show the “Support the Project” link in the legal links list.
 * Shown only for web builds or Android installs from F-Droid (default: hidden).
 */
export function isSupportProjectListLinkVisible(
  os: typeof Platform.OS,
  installerPackageName: string
): boolean {
  if (os === 'web') {
    return true;
  }

  if (os === 'android' && installerPackageName === ANDROID_FDROID_INSTALLER) {
    return true;
  }

  return false;
}
