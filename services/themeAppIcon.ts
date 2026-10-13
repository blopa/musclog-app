import { AppState, type NativeEventSubscription, Platform } from 'react-native';

import type { ThemeOption } from '@/constants/settings';
import { appIconNameForPreference } from '@/constants/themeAppIcons';
import { themeAppIconModule } from '@/modules/theme-app-icon';
import { handleError } from '@/utils/handleError';

/**
 * Android only: the icon a theme change asked for, applied the next time the app is
 * backgrounded. `undefined` means nothing is waiting.
 *
 * Switching launcher aliases while the app is in the foreground makes several
 * launchers (Pixel's among them) close the app's task or drop its home-screen
 * shortcut, so the switch waits until the user has left the app anyway.
 */
let pendingAndroidIcon: string | null | undefined;
let backgroundSubscription: NativeEventSubscription | null = null;

async function applyAppIcon(name: string | null): Promise<void> {
  if (!themeAppIconModule) {
    return;
  }

  // iOS shows a system alert on every change, so never "change" to the icon already shown.
  if ((await themeAppIconModule.getAppIcon()) === name) {
    return;
  }

  await themeAppIconModule.setAppIcon(name);
}

function reportFailure(error: unknown): void {
  void handleError(error, 'themeAppIcon.apply', { showSnackbar: false });
}

function ensureBackgroundSubscription(): void {
  if (backgroundSubscription) {
    return;
  }

  backgroundSubscription = AppState.addEventListener('change', (state) => {
    if (state !== 'background' || pendingAndroidIcon === undefined) {
      return;
    }

    const name = pendingAndroidIcon;
    pendingAndroidIcon = undefined;
    applyAppIcon(name).catch(reportFailure);
  });
}

/**
 * Switch the launcher icon to match a theme the user just picked. Call it only from
 * a manual theme change: the icon cannot follow anything that happens while the app
 * is not running, and iOS alerts on every switch. The `system` preference keeps the
 * default icon. Never throws — a failed switch leaves the old icon and is reported.
 */
export async function syncAppIconWithTheme(preference: ThemeOption): Promise<void> {
  if (!themeAppIconModule) {
    return;
  }

  const name = appIconNameForPreference(preference);
  if (Platform.OS === 'android') {
    pendingAndroidIcon = name;
    ensureBackgroundSubscription();
    return;
  }

  await applyAppIcon(name).catch(reportFailure);
}
