import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useCameraPermissions } from '@/components/CameraView';
import { SplashLoading } from '@/components/SplashLoading';
import { ConfettiActivity, useConfettiInteractions } from '@/context/ConfettiInteractionsContext';
import { runEntryOnboardingRedirect } from '@/utils/entryOnboardingRedirect';

export default function Index() {
  const router = useRouter();
  const pathname = usePathname();
  const navigationState = useRootNavigationState();
  const { completeActivity } = useConfettiInteractions();

  // Warm up the camera TurboModule during the splash screen so it's ready by
  // the time the user opens the camera. useCameraPermissions() triggers the
  // ExpoCamera TurboModule init on first call; doing it here (while navigation
  // is still resolving) avoids the cold-start delay later.
  useCameraPermissions();

  useEffect(() => {
    if (!navigationState?.key) {
      return;
    }

    runEntryOnboardingRedirect(router, 'index', pathname).then((redirected) => {
      if (!redirected) {
        completeActivity(ConfettiActivity.ONBOARDING_CONFIRMED);
      }
    });
  }, [navigationState?.key, pathname, router, completeActivity]);

  return <SplashLoading />;
}
