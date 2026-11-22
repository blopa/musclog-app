// Store and website links for the Premium screens. Pure constants.

export const MANAGE_SUBSCRIPTION_URLS = {
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
} as const;

/** Where the person manages the subscription; null where there is no store (web, other). */
export function manageSubscriptionUrl(platform: string): string | null {
  if (platform === 'ios') {
    return MANAGE_SUBSCRIPTION_URLS.ios;
  }

  if (platform === 'android') {
    return MANAGE_SUBSCRIPTION_URLS.android;
  }

  return null;
}

// The website's `/terms` and `/privacy` routes (components/website/websiteRoutes.json), in the
// app's language through `websitePageUrl` (the same addresses `localizedPath` builds).
export const PREMIUM_TERMS_PATH = '/terms';
export const PREMIUM_PRIVACY_PATH = '/privacy';
