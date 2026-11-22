// The module-level state of the Premium screens and the one runner of their actions. It lives here,
// not in a hook, so it outlives every screen: closing the modal mid-purchase loses neither the
// result nor the overview, and a screen that opens later reads what is already there instead of
// asking the Worker again. Nothing runs at import or at boot: the overview loads when a screen that
// shows it asks (`refreshPremiumOverview`).
import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import {
  disableHostedIfRemoved,
  loadPremiumOverview,
  type PremiumOverview,
  resetPremiumOnThisDevice,
  restorePremiumAccess,
  subscribeToPremium,
} from '@/services/premium/premiumActions';
import { createListeners } from '@/utils/createListeners';
import {
  beginPremiumActivity,
  endPremiumActivity,
  type PremiumActivityKind,
  type PremiumActivityOutcome,
  type PremiumProgress,
  reportPremiumProgress,
} from '@/utils/premium/premiumActivity';
import type { PremiumActionFailure } from '@/utils/premium/premiumState';

let overview: PremiumOverview | null = null;
let inFlight: Promise<void> | null = null;
const { subscribe, notify } = createListeners();

export const subscribePremiumOverview = subscribe;

export function getPremiumOverview(): PremiumOverview | null {
  return overview;
}

/**
 * Reads the overview and publishes it. Concurrent callers share one request. A removed or revoked
 * subscription also switches hosted AI off (the screen shows the matching notice). Never throws.
 */
export function refreshPremiumOverview(): Promise<void> {
  if (!inFlight) {
    const run = loadPremiumOverview()
      .then(async (next) => {
        overview = next;
        notify();
        await disableHostedIfRemoved(next.status);
      })
      .catch(() => undefined)
      .finally(() => {
        inFlight = null;
      });

    inFlight = run;
  }

  return inFlight;
}

/** What an action reports: it went through, or it failed for a reason the screen shows. */
type ActionResult = { ok: true } | { ok: false; failure: PremiumActionFailure };

/**
 * Runs one Premium action at a time, tracked in the activity store. Resolves true when it went
 * through; false when it failed or another action is already running. After a success the overview
 * is read again, unless the action changes nothing the Worker reports (`reload: false`).
 */
export async function runPremiumAction(
  kind: PremiumActivityKind,
  action: (onProgress: (stage: PremiumProgress) => void) => Promise<ActionResult>,
  { reload = true }: { reload?: boolean } = {}
): Promise<boolean> {
  if (!beginPremiumActivity(kind)) {
    return false;
  }

  let outcome: PremiumActivityOutcome = { ok: false, failure: null };

  try {
    const result = await action(reportPremiumProgress);

    if (!result.ok) {
      outcome = { ok: false, failure: result.failure };

      return false;
    }

    outcome = { ok: true };

    if (reload) {
      await refreshPremiumOverview();
    }

    return true;
  } finally {
    endPremiumActivity(kind, outcome);
  }
}

export const subscribePremium = () => runPremiumAction('subscribe', subscribeToPremium);

export const restorePremium = () => runPremiumAction('restore', restorePremiumAccess);

export const resetPremiumDevice = () =>
  runPremiumAction('reset', async () => {
    await resetPremiumOnThisDevice();

    return { ok: true };
  });

/** Flips the AI switch. It changes nothing the Worker reports, so the overview is not read again. */
export async function setUseHostedAi(on: boolean): Promise<void> {
  await runPremiumAction(
    'toggle',
    async () => {
      await SettingsService.set(SETTINGS.useHostedAi, on);

      return { ok: true };
    },
    { reload: false }
  );
}

/** Tests only. */
export function resetPremiumStore(): void {
  overview = null;
  inFlight = null;
  notify();
}
