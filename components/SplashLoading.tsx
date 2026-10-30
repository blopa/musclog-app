import { ActivityIndicator, Image, View } from 'react-native';

import { BootProgressBar } from '@/components/BootProgressBar';
import { useBootColors } from '@/hooks/useBootColors';
import { useKeepScreenAwake } from '@/hooks/useKeepScreenAwake';

const LOGO_SIZE = 128;

/**
 * Inline styles only, no `className`: the root `/` route renders this before
 * `app/app/_layout.tsx` (which imports `global.css`) has been evaluated, so
 * NativeWind classes resolve to nothing here and the logo drew at its 1024px
 * intrinsic size. See `FIXES.md`.
 */
export function SplashLoading() {
  const colors = useBootColors();
  // Boot migrations/seeding can run for minutes on first launch; keep the
  // screen on so the device doesn't sleep and interrupt the work.
  useKeepScreenAwake('splash-loading');

  return (
    <View
      style={{
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceBase,
      }}
    >
      <Image
        source={require('@/assets/theme-icons/icon-bg-kinetic-depth.png')}
        style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
        resizeMode="contain"
      />
      <ActivityIndicator size="small" color={colors.brandVivid} style={{ marginTop: 32 }} />
      <BootProgressBar />
    </View>
  );
}
