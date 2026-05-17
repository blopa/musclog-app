import { reloadAppAsync } from 'expo';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import { DevSettings } from 'react-native';

export function isProduction() {
  return false; // TODO: REVERT THIS
}

export async function reloadApp() {
  if (isProduction()) {
    // In development mode, use DevSettings.reload() to reload the app (does not work in prod)
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
  } catch (error) {
    router.replace('/app');
  }
}
