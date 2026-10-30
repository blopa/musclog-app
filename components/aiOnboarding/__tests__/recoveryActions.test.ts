import {
  RECOVERY,
  RECOVERY_ACTION_LABEL_KEYS,
  type RecoveryAction,
} from '@/components/aiOnboarding/recoveryActions';
import type { AiOnboardingErrorKind } from '@/utils/aiOnboarding/chatState';

const kinds = Object.keys(RECOVERY) as AiOnboardingErrorKind[];

describe('RECOVERY', () => {
  it.each(kinds)('%s always offers a way to finish without this AI', (kind) => {
    expect(RECOVERY[kind].actions).toContain('continueGuided');
  });

  it.each(kinds)('%s names an action label for everything it offers', (kind) => {
    for (const action of RECOVERY[kind].actions) {
      expect(RECOVERY_ACTION_LABEL_KEYS[action]).toBeTruthy();
    }
  });

  it('puts the specific fix first, and never offers the same action twice', () => {
    expect(RECOVERY.invalidKey.actions[0]).toBe('replaceKey');
    expect(RECOVERY.gatewayLimit.actions[0]).toBe('ownKey');
    expect(RECOVERY.offline.actions[0]).toBe('retry');
    for (const kind of kinds) {
      expect(new Set(RECOVERY[kind].actions).size).toBe(RECOVERY[kind].actions.length);
    }
  });

  it('does not offer to retry when retrying cannot help', () => {
    const retryable: RecoveryAction = 'retry';
    for (const kind of [
      'invalidKey',
      'credits',
      'gatewayLimit',
      'malformed',
      'unavailable',
    ] as const) {
      expect(RECOVERY[kind].actions).not.toContain(retryable);
    }
  });
});
