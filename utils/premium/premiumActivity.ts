import { createListeners } from '@/utils/createListeners';

// What Premium is doing right now, kept at module level so it outlives the screen that started it:
// closing the modal mid-purchase must not lose the stage, the result or the consent question.
// Pure and relative-import-only (no React, no service). Never persisted, never carries a token.
import type { PremiumActionFailure } from './premiumState';

export type PremiumActivityKind = 'subscribe' | 'restore' | 'reset' | 'toggle';

/** What the purchase flow reports: the store sheet, then the Worker's check (once per attempt). */
export type PremiumProgress = 'store' | 'confirming';

/** The stage shown to the person: `slow` is `confirming` after `SLOW_CONFIRM_MS`. */
export type PremiumActivityStage = PremiumProgress | 'slow';

/** One line per thing Premium can be busy with (a whole-key table in the modal maps it to copy). */
export type PremiumBusyLine = PremiumActivityStage | 'reset' | 'toggle';

export type PremiumActivity = { kind: PremiumActivityKind; stage: PremiumActivityStage | null };

/** How an activity ended: it went through, or it failed for a reason the screen shows. */
export type PremiumActivityOutcome =
  { ok: true } | { ok: false; failure: PremiumActionFailure | null };

/** After this long confirming, the line admits it is slow. No countdown, no percentage. */
export const SLOW_CONFIRM_MS = 6000;

type Snapshot = {
  activity: PremiumActivity | null;
  consentPending: boolean;
  /** The last action's failure, until a new action starts, one succeeds or the screen is closed. */
  failure: PremiumActionFailure | null;
};

const IDLE: Snapshot = { activity: null, consentPending: false, failure: null };

let snapshot: Snapshot = IDLE;
let slowTimer: ReturnType<typeof setTimeout> | undefined;
const { subscribe, notify } = createListeners();

function publish(next: Snapshot): void {
  snapshot = next;
  notify();
}

function clearSlowTimer(): void {
  clearTimeout(slowTimer);
  slowTimer = undefined;
}

export const subscribePremiumActivity = subscribe;

export function getPremiumActivity(): PremiumActivity | null {
  return snapshot.activity;
}

export function getPremiumConsentPending(): boolean {
  return snapshot.consentPending;
}

/** The line to show for an activity, or null when nothing is running. */
export function busyLineFor(activity: PremiumActivity | null): PremiumBusyLine | null {
  if (!activity) {
    return null;
  }

  if (activity.kind === 'reset' || activity.kind === 'toggle') {
    return activity.kind;
  }

  return activity.stage ?? 'store';
}

/** Starts an activity. Returns false (and changes nothing) when another one is already running. */
export function beginPremiumActivity(kind: PremiumActivityKind): boolean {
  if (snapshot.activity) {
    return false;
  }

  const isPurchase = kind === 'subscribe' || kind === 'restore';

  publish({
    ...snapshot,
    activity: { kind, stage: isPurchase ? 'store' : null },
    failure: null,
  });

  return true;
}

/** Reported by the purchase flow. A repeated `confirming` (a retry) keeps the slow clock running. */
export function reportPremiumProgress(progress: PremiumProgress): void {
  const current = snapshot.activity;

  if (!current || (current.kind !== 'subscribe' && current.kind !== 'restore')) {
    return;
  }

  if (progress === 'store') {
    clearSlowTimer();
    publish({ ...snapshot, activity: { ...current, stage: 'store' } });

    return;
  }

  if (current.stage === 'confirming' || current.stage === 'slow') {
    return;
  }

  publish({ ...snapshot, activity: { ...current, stage: 'confirming' } });
  clearSlowTimer();
  slowTimer = setTimeout(() => {
    const now = snapshot.activity;

    if (now && now.stage === 'confirming') {
      publish({ ...snapshot, activity: { ...now, stage: 'slow' } });
    }
  }, SLOW_CONFIRM_MS);
}

/**
 * Ends the running activity. A purchase or restore that went through leaves the consent question
 * pending, so a modal that was closed meanwhile still asks it on its next open; a failure stays in
 * the store, so a screen that was closed meanwhile shows it when it opens.
 */
export function endPremiumActivity(
  kind: PremiumActivityKind,
  outcome: PremiumActivityOutcome
): void {
  clearSlowTimer();

  if (snapshot.activity?.kind !== kind) {
    return;
  }

  const isPurchase = kind === 'subscribe' || kind === 'restore';

  publish({
    activity: null,
    consentPending: snapshot.consentPending || (isPurchase && outcome.ok),
    failure: outcome.ok ? null : outcome.failure,
  });
}

/** Clears the pending consent question once a screen has taken it. */
export function takePremiumConsentPending(): boolean {
  const was = snapshot.consentPending;

  if (was) {
    publish({ ...snapshot, consentPending: false });
  }

  return was;
}

/** The failure of the last action, or null. */
export function getPremiumActionFailure(): PremiumActionFailure | null {
  return snapshot.failure;
}

/** Forgets the last failure; the Premium screen calls it when it closes, so a reopen starts clean. */
export function dismissPremiumActionFailure(): void {
  if (snapshot.failure !== null) {
    publish({ ...snapshot, failure: null });
  }
}

/** Tests only. */
export function resetPremiumActivity(): void {
  clearSlowTimer();
  publish(IDLE);
}
