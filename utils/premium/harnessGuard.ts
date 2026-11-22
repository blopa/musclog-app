import { Platform } from 'react-native';

/** Last segment of the debug-only Premium identity harness route (`app/app/test/premium-harness`). */
export const HARNESS_ROUTE_SEGMENT = 'premium-harness';

/**
 * The harness exists only in a store-signed build made with `EXPO_PUBLIC_PREMIUM_HARNESS=1`
 * (the `premium-harness` EAS profile), and never on web. Strictly the string '1'.
 */
export function isPremiumHarnessBuild(input: {
  platform: string;
  flag: string | undefined;
}): boolean {
  return input.platform !== 'web' && input.flag === '1';
}

export function premiumHarnessBuildEnabled(): boolean {
  return isPremiumHarnessBuild({
    platform: Platform.OS,
    flag: process.env.EXPO_PUBLIC_PREMIUM_HARNESS,
  });
}

export function isHarnessRouteAllowed(input: {
  lastSegment: string | undefined;
  platform: string;
  flag: string | undefined;
}): boolean {
  return (
    input.lastSegment === HARNESS_ROUTE_SEGMENT &&
    isPremiumHarnessBuild({ platform: input.platform, flag: input.flag })
  );
}
