import { ReactNode, useEffect, useState } from 'react';

import { ErrorFallbackScreen } from '@/components/ErrorFallbackScreen';
import { SplashLoading } from '@/components/SplashLoading';
import { isStaticExport } from '@/constants/platform';
import { getDbReadyError, waitForDbReady } from '@/database/dbReady';
import { reloadApp } from '@/utils/app';
import { captureBootException } from '@/utils/bootErrorReporting';
import { isOnboardingCompleted } from '@/utils/onboardingService';

export function AppDbReadyGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(isStaticExport);
  const [error, setError] = useState<unknown>(() => getDbReadyError());

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
        if (!cancelled) {
          setError(err);
        }

        return;
      } finally {
        if (!cancelled && !getDbReadyError()) {
          setReady(true);
        }
      }
    };

    void waitForCompletedUserDb();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <ErrorFallbackScreen error={error} resetError={() => void reloadApp()} />;
  }

  if (!ready) {
    return <SplashLoading />;
  }

  return <>{children}</>;
}
