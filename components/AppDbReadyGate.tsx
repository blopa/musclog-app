import { ReactNode, useEffect, useState } from 'react';

import { SplashLoading } from '@/components/SplashLoading';
import { isStaticExport } from '@/constants/platform';
import { waitForDbReady } from '@/database/dbReady';
import { captureBootException } from '@/utils/bootErrorReporting';
import { isOnboardingCompleted } from '@/utils/onboardingService';

export function AppDbReadyGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(isStaticExport);

  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    let cancelled = false;

    const waitForCompletedUserDb = async () => {
      try {
        // Completed users wait here while AppBoot proves the DB is usable; new
        // installs must render so seedProductionData can finish and mark ready.
        if (await isOnboardingCompleted()) {
          await waitForDbReady();
        }
      } catch (err) {
        captureBootException(err, 'AppDbReadyGate.waitForDbReady');
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    };

    void waitForCompletedUserDb();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <SplashLoading />;
  }

  return <>{children}</>;
}
