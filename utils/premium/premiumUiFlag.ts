import { Platform } from 'react-native';

/**
 * Premium (hosted AI) is invisible and unreachable until its release (plan phase P7): this is the
 * ONE definition of "is Premium switched on in this build". It is a build-time public variable,
 * strictly the string '1', on web only under the development server (`__DEV__`), and no EAS profile, app.json or package.json sets it
 * (pinned by `utils/premium/__tests__/premiumUiFlag.test.ts`). The Premium card, modal, provider
 * probe and settings rows all read it; nothing reads `process.env` for it anywhere else.
 */
export function isPremiumUiEnabledFor(input: {
  platform: string;
  flag: string | undefined;
  dev?: boolean;
}) {
  // Web has no store or RevenueCat (its Premium service reports `not_available`), so it shows the
  // screens only on the development server, where they can be looked at and laid out.
  return (input.platform !== 'web' || input.dev === true) && input.flag === '1';
}

export function isPremiumUiEnabled(): boolean {
  return isPremiumUiEnabledFor({
    platform: Platform.OS,
    flag: process.env.EXPO_PUBLIC_PREMIUM_UI,
    dev: __DEV__,
  });
}
