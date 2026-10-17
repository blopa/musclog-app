import type { AppLockScope } from '@/constants/settings';

export type ScopeChangeResult = 'changed' | 'noCredential' | 'cancelled';

type ScopeChangeDeps = {
  /** Whether the device has a biometric or PIN to unlock with. */
  canEnable: () => Promise<boolean>;
  /** Asks the device to authenticate; resolves true on success. */
  unlock: () => Promise<boolean>;
  read: () => Promise<AppLockScope[]>;
  write: (scopes: AppLockScope[]) => Promise<void>;
};

/**
 * Turns one lock on or off. Both directions need the person to authenticate first (fingerprint,
 * face or device PIN), so a phone left unlocked cannot have its lock removed; turning one on is
 * also refused on a device with nothing to unlock with, since that lock would protect nothing.
 * The list is read AFTER the prompt, which can take a while, so a concurrent change is not lost.
 */
export async function changeLockScope(
  scope: AppLockScope,
  enabled: boolean,
  { canEnable, unlock, read, write }: ScopeChangeDeps
): Promise<ScopeChangeResult> {
  if (enabled && !(await canEnable())) {
    return 'noCredential';
  }

  if (!(await unlock())) {
    return 'cancelled';
  }

  const current = await read();
  await write(enabled ? [...current, scope] : current.filter((candidate) => candidate !== scope));

  return 'changed';
}
