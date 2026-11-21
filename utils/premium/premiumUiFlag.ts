import { Platform } from 'react-native';

/**
 * The ONE definition of "is Premium (hosted AI) switched on in this build". Since 2.17.0 it is on
 * by default on native builds; the build-time public variable `EXPO_PUBLIC_HIDE_PREMIUM_UI`,
 * strictly the string '1', is the kill switch that hides the Premium card, modal, provider probe
 * and settings rows again. Web shows the screens only under the development server (`__DEV__`).
 * No EAS profile, app.json or package.json sets the switch (pinned by
 * `utils/premium/__tests__/premiumUiFlag.test.ts`), and nothing reads `process.env` for it anywhere
 * else. Jest sets it to '1' so the many suites that do not care see Premium hidden.
 */
export function isPremiumUiEnabledFor(input: {
  platform: string;
  hide: string | undefined;
  dev?: boolean;
}) {
  // Web has no store or RevenueCat (its Premium service reports `not_available`), so it shows the
  // screens only on the development server, where they can be looked at and laid out.
  return (input.platform !== 'web' || input.dev === true) && input.hide !== '1';
}

export function isPremiumUiEnabled(): boolean {
  return isPremiumUiEnabledFor({
    platform: Platform.OS,
    hide: process.env.EXPO_PUBLIC_HIDE_PREMIUM_UI,
    dev: __DEV__,
  });
}
