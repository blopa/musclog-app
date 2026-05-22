import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useCameraPermissions } from '@/components/CameraView';
import { SplashLoading } from '@/components/SplashLoading';
import { runEntryOnboardingRedirect } from '@/utils/entryOnboardingRedirect';

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

    runEntryOnboardingRedirect(router, 'index', pathname);
  }, [navigationState?.key, pathname, router]);

  return <SplashLoading />;
}
