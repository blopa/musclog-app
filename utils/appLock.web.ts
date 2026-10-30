/** The browser has no device credential to unlock with, so the lock is not offered there. */
export const isAppLockSupported = false;

export async function canEnableAppLock(): Promise<boolean> {
  return false;
}

export async function authenticateToUnlock(_promptMessage: string): Promise<boolean> {
  return true;
}
