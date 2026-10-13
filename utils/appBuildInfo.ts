import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getAppVersion } from '@/utils/appVersion';

import type { AppBuildInfo } from './appVersionLabel';

/**
 * What a bug report needs to know about this install, and nothing about the person: no ids, no
 * email, no settings. One definition, shared by the Settings footer and the Help & feedback links,
 * so the version a user reads off the screen is the version a report carries.
 */
export function getAppBuildInfo(): AppBuildInfo {
  return {
    appVersion: getAppVersion(),
    buildNumber:
      Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? null,
    platform: Platform.OS,
    osVersion: String(Platform.Version ?? ''),
  };
}
