import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Must stay in sync with `@media (min-width: …)` in global.css (`.expo-web-root` desktop phone frame).
 */
export const WEB_DESKTOP_PHONE_FRAME_MIN_WIDTH = 1024;

function getDesktopFrameMql(): MediaQueryList | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }
  return window.matchMedia(`(min-width: ${WEB_DESKTOP_PHONE_FRAME_MIN_WIDTH}px)`);
}

/**
 * True when web is in the desktop “phone frame” layout (wide viewport).
 * SSR: false. Client first paint matches `matchMedia` immediately to avoid modal flash.
 */
export function useWebDesktopPhoneFrame(): boolean {
  const [matches, setMatches] = useState(() => getDesktopFrameMql()?.matches ?? false);

  useEffect(() => {
    const mql = getDesktopFrameMql();
    if (!mql) {
      return;
    }

    const apply = () => setMatches(mql.matches);
    apply();

    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, []);

  return Platform.OS === 'web' && matches;
}

export type WebModalLayerVariant = 'fullscreen' | 'centered';

type WebModalLayerOptions = {
  variant?: WebModalLayerVariant;
};

/**
 * Web-only positioning for modal layers: full viewport on narrow web, shell-relative on desktop frame.
 */
export function useWebModalLayerStyle(
  options: WebModalLayerOptions = {}
): Record<string, unknown> | undefined {
  const { variant = 'fullscreen' } = options;
  const isDesktopFrame = useWebDesktopPhoneFrame();

  return useMemo(() => {
    if (Platform.OS !== 'web') {
      return undefined;
    }

    const centeredExtras =
      variant === 'centered'
        ? {
            display: 'flex' as const,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
          }
        : {};

    if (isDesktopFrame) {
      return {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        ...centeredExtras,
      };
    }

    return {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100dvh',
      ...(variant === 'fullscreen' ? { touchAction: 'pan-y' as const } : {}),
      ...centeredExtras,
    };
  }, [isDesktopFrame, variant]);
}

/**
 * Bottom-anchored overlay on web: full viewport width on narrow web, constrained to the phone shell on desktop frame.
 */
export function useWebBottomDockLayerStyle(): Record<string, unknown> | undefined {
  const isDesktopFrame = useWebDesktopPhoneFrame();

  return useMemo(() => {
    if (Platform.OS !== 'web') {
      return undefined;
    }

    if (isDesktopFrame) {
      return {
        position: 'absolute' as const,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        zIndex: 999_999,
      };
    }

    return {
      position: 'fixed' as const,
      bottom: 0,
      left: 0,
      right: 0,
      width: '100vw',
      zIndex: 999_999,
    };
  }, [isDesktopFrame]);
}
