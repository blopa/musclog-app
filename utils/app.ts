import { reloadAppAsync } from 'expo';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import { DevSettings } from 'react-native';

export function isProduction() {
  return !__DEV__;
}

export async function reloadApp() {
  // This branch used to be inverted — it read `if (isProduction())` while its own comment said
  // "in development mode", so release builds took the DevSettings path, which is a no-op there.
  // The symptom was silent: every restore (file import, Local Backups, optical transfer) finished
  // without reloading, leaving the app showing pre-restore data until the user killed it by hand.
  if (!isProduction()) {
    // Under Metro this is the only thing that reliably reloads.
    DevSettings.reload();
    return;
  }

  // Production mode: try multiple reload strategies
  try {
    if (reloadAppAsync) {
      await reloadAppAsync();
    } else if (Updates.isEnabled) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await Updates.reloadAsync();
    }

    router.replace('/app');
  } catch {
    router.replace('/app');
  }
}
