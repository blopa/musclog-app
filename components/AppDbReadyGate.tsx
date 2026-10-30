import { ReactNode, useEffect, useState } from 'react';

import { ErrorFallbackScreen } from '@/components/ErrorFallbackScreen';
import { SplashLoading } from '@/components/SplashLoading';
import { isStaticExport } from '@/constants/platform';
import { getDbReadyError, waitForDbReady } from '@/database/dbReady';
import i18n from '@/lang/lang';
import { reloadApp } from '@/utils/app';
import { captureBootException } from '@/utils/bootErrorReporting';
import { isOnboardingCompleted } from '@/utils/onboardingService';
import { getSettingsMirror, hydrateSettingsMirror } from '@/utils/settingsMirror';

/**
 * i18n starts in the phone's language; switching here, before anything renders,
 * keeps the first screen from being drawn in it and then redrawn in the app's.
 */
async function applyMirroredLanguage(): Promise<void> {
  const language = getSettingsMirror()?.language;
  if (!language || i18n.language === language) {
    return;
  }

  try {
    await i18n.changeLanguage(language);
  } catch (err) {
    // LanguageInitializer applies the stored language once settings load.
    captureBootException(err, 'AppDbReadyGate.applyMirroredLanguage');
  }
}

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
        // SettingsProvider starts from the settings mirror on its first render,
        // so it must be loaded before the children mount. Completed users wait
        // on the database far longer than this read takes; new installs only
        // pay a single AsyncStorage read.
        const settingsMirrorReady = hydrateSettingsMirror();

        // Completed users wait here while AppBoot proves the DB is usable; new
        // installs must render so seedProductionData can finish and mark ready.
        if (await isOnboardingCompleted()) {
          await waitForDbReady();
        }

        await settingsMirrorReady;
        await applyMirroredLanguage();
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
