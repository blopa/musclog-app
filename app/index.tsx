import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useCameraPermissions } from '@/components/CameraView';
import { SplashLoading } from '@/components/SplashLoading';
import { waitForDbReady } from '@/database/dbReady';
import { runEntryOnboardingRedirect } from '@/utils/entryOnboardingRedirect';
import { isOnboardingCompleted } from '@/utils/onboardingService';

export default function Index() {
  const router = useRouter();
  const pathname = usePathname();
  const navigationState = useRootNavigationState();

  // Warm up the camera TurboModule during the splash screen so it's ready by
  // the time the user opens the camera. useCameraPermissions() triggers the
  // ExpoCamera TurboModule init on first call; doing it here (while navigation
  // is still resolving) avoids the cold-start delay later.
  useCameraPermissions();

  useEffect(() => {
    if (!navigationState?.key) {
      return;
    }

    const go = async () => {
      // For upgrading users (onboarding already done), wait for the WatermelonDB JSI
      // driver to finish migration before navigating home. Without this gate, home
      // screen data hooks fire while the 909-step v18 migration is still running,
      // causing "No driver with tag 1 available" crashes and dialog cascades.
      //
      // New installs skip this wait: they'll be redirected to onboarding landing,
      // which calls seedProductionData() → markDbReady() itself.
      const completed = await isOnboardingCompleted();
      if (completed) {
        await waitForDbReady();
      }

      runEntryOnboardingRedirect(router, 'index', pathname);
    };

    void go();
  }, [navigationState?.key, pathname, router]);

  return <SplashLoading />;
}
