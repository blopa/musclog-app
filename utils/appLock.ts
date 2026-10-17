import * as LocalAuthentication from 'expo-local-authentication';

import { handleError } from './handleError';

export const isAppLockSupported = true;

/**
 * An app lock needs something to unlock WITH. Unlike `authenticateForDangerousAction`, which lets a
 * device with no credential through, a lock that anyone can open protects nothing, so enabling it
 * is refused when the device has no biometrics and no PIN, pattern or password.
 */
export async function canEnableAppLock(): Promise<boolean> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();

    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch (error) {
    handleError(error, 'appLock.canEnable');

    return false;
  }
}

/** Biometrics first, falling back to the device PIN / pattern / password. */
export async function authenticateToUnlock(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      disableDeviceFallback: false,
    });

    return result.success;
  } catch (error) {
    handleError(error, 'appLock.authenticate');

    return false;
  }
}
