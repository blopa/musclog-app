import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { isStaticExport } from '@/constants/platform';
import { whatsNewReleases } from '@/data/whatsNew/releases';
import { waitForDbReady } from '@/database/dbReady';
import { getAppVersion } from '@/utils/appVersion';
import { isOnboardingCompleted } from '@/utils/onboardingService';
import { loadWhatsNewContext } from '@/utils/whatsNew/context';
import { selectWhatsNewFlow, type WhatsNewFlow } from '@/utils/whatsNew/flow';
import { getWhatsNewSeenThrough, markWhatsNewSeenThrough } from '@/utils/whatsNew/storage';

// A cached evaluation survives home blur/remount without consuming an unfinished tour.
let evaluation: Promise<WhatsNewFlow | null> | undefined;
let handled = false;

/** Debug tools only: re-arm the once-per-session gate after editing the stored version. */
export function resetWhatsNewAutoFlowSession() {
  evaluation = undefined;
  handled = false;
}

async function evaluate(): Promise<WhatsNewFlow | null> {
  await waitForDbReady();
  if (!(await isOnboardingCompleted())) {
    evaluation = undefined; // Fresh onboarding may complete later in this JS session.
    return null;
  }

  const currentVersion = getAppVersion();
  const flow = selectWhatsNewFlow({
    releases: whatsNewReleases,
    currentVersion,
    seenThrough: await getWhatsNewSeenThrough(),
    context: await loadWhatsNewContext(),
  });
  if (!flow.pages.length) {
    await markWhatsNewSeenThrough(currentVersion);
    handled = true;
    return null;
  }

  return flow;
}

export function useWhatsNewAutoFlow({ suppressed = false }: { suppressed?: boolean } = {}) {
  const focused = useIsFocused();
  const [flow, setFlow] = useState<WhatsNewFlow | null>(null);

  useEffect(() => {
    if (isStaticExport || !focused) {
      return;
    }

    if (suppressed) {
      handled = true;
      return;
    }

    if (handled) {
      return;
    }

    let cancelled = false;
    evaluation ??= evaluate().catch((error) => {
      evaluation = undefined;
      if (__DEV__) {
        console.warn('[WhatsNew] Could not check announcements', error);
      }

      return null;
    });
    void evaluation.then((selected) => {
      if (!cancelled && !handled) {
        setFlow(selected);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [focused, suppressed]);

  const dismiss = useCallback(async () => {
    // Failure leaves the tour open, so the user can retry and a route never races storage.
    await markWhatsNewSeenThrough(getAppVersion());
    handled = true;
    setFlow(null);
  }, []);

  return { flow, visible: focused && !suppressed && !handled && !!flow, dismiss };
}
