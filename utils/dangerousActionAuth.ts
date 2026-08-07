import * as LocalAuthentication from 'expo-local-authentication';

import { handleError } from './handleError';

/**
 * Gate an irreversible action behind device biometrics.
 *
 * PASSES THROUGH when the device has no biometric hardware or the user has not enrolled any —
 * refusing there would lock those users out of actions they are entitled to take, and this is a
 * confirmation step, not an authorisation boundary. It returns false only when authentication was
 * genuinely available and did not succeed.
 *
 * Used by every path that destroys data the user cannot get back: clearing app data, and restoring
 * a backup (from a file or over optical transfer), both of which wipe the local database.
 */
export async function authenticateForDangerousAction(
  promptMessage: string,
  errorContext = 'dangerousActionAuth'
): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      return true;
    }

    const result = await LocalAuthentication.authenticateAsync({ promptMessage });
    return result.success;
  } catch (error) {
    handleError(error, errorContext);
    return false;
  }
}
