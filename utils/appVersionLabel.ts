export interface AppBuildInfo {
  appVersion: string;
  /** The store build number (iOS build / Android version code), or null in a dev or web build. */
  buildNumber: string | number | null;
  platform: string;
  osVersion: string;
}

/**
 * "2.12.3" or "2.12.3 (Build 123)" — the label shown in Settings and sent with a report. Pure, so
 * the link builders and their tests do not drag in the native modules `getAppBuildInfo` reads.
 */
export function formatAppVersion(info: Pick<AppBuildInfo, 'appVersion' | 'buildNumber'>): string {
  return info.buildNumber != null
    ? `${info.appVersion} (Build ${info.buildNumber})`
    : info.appVersion;
}
