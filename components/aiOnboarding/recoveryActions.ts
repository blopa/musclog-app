import type { AiOnboardingErrorKind } from '@/utils/aiOnboarding/chatState';

export type RecoveryAction =
  | 'retry'
  /** Enter a new key for the same provider. */
  | 'replaceKey'
  | 'switchProvider'
  /** Free AI hit its daily limit: the way on is the person's own key. */
  | 'ownKey'
  | 'useExternal'
  | 'continueGuided';

export type Recovery = {
  titleKey: string;
  descriptionKey: string;
  actions: readonly RecoveryAction[];
};

/**
 * What the person is told, and which exits they are offered, for each way the chat can fail.
 * Every failure ends with a way to finish without this AI (`continueGuided`), so no provider
 * problem can trap anyone in the setup.
 */
export const RECOVERY: Record<AiOnboardingErrorKind, Recovery> = {
  offline: {
    titleKey: 'aiOnboarding.recovery.offline.title',
    descriptionKey: 'aiOnboarding.recovery.offline.description',
    actions: ['retry', 'useExternal', 'continueGuided'],
  },
  invalidKey: {
    titleKey: 'aiOnboarding.recovery.invalidKey.title',
    descriptionKey: 'aiOnboarding.recovery.invalidKey.description',
    actions: ['replaceKey', 'switchProvider', 'useExternal', 'continueGuided'],
  },
  credits: {
    titleKey: 'aiOnboarding.recovery.credits.title',
    descriptionKey: 'aiOnboarding.recovery.credits.description',
    actions: ['switchProvider', 'useExternal', 'continueGuided'],
  },
  gatewayLimit: {
    titleKey: 'aiOnboarding.recovery.gatewayLimit.title',
    descriptionKey: 'aiOnboarding.recovery.gatewayLimit.description',
    actions: ['ownKey', 'useExternal', 'continueGuided'],
  },
  timeout: {
    titleKey: 'aiOnboarding.recovery.timeout.title',
    descriptionKey: 'aiOnboarding.recovery.timeout.description',
    actions: ['retry', 'switchProvider', 'continueGuided'],
  },
  cancelled: {
    titleKey: 'aiOnboarding.recovery.cancelled.title',
    descriptionKey: 'aiOnboarding.recovery.cancelled.description',
    actions: ['retry', 'continueGuided'],
  },
  malformed: {
    titleKey: 'aiOnboarding.recovery.malformed.title',
    descriptionKey: 'aiOnboarding.recovery.malformed.description',
    actions: ['switchProvider', 'useExternal', 'continueGuided'],
  },
  unavailable: {
    titleKey: 'aiOnboarding.recovery.unavailable.title',
    descriptionKey: 'aiOnboarding.recovery.unavailable.description',
    actions: ['switchProvider', 'useExternal', 'continueGuided'],
  },
  unknown: {
    titleKey: 'aiOnboarding.recovery.unknown.title',
    descriptionKey: 'aiOnboarding.recovery.unknown.description',
    actions: ['retry', 'switchProvider', 'useExternal', 'continueGuided'],
  },
};

export const RECOVERY_ACTION_LABEL_KEYS: Record<RecoveryAction, string> = {
  retry: 'aiOnboarding.recovery.actions.retry',
  replaceKey: 'aiOnboarding.recovery.actions.replaceKey',
  switchProvider: 'aiOnboarding.recovery.actions.switchProvider',
  ownKey: 'aiOnboarding.recovery.actions.ownKey',
  useExternal: 'aiOnboarding.recovery.actions.useExternal',
  continueGuided: 'aiOnboarding.recovery.actions.continueGuided',
};
