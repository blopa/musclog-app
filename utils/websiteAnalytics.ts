export type AnalyticsConsentState = 'accepted' | 'rejected' | null;

export const ANALYTICS_CONSENT_STORAGE_KEY = 'musclog.analytics-consent';
export const ANALYTICS_RESET_EVENT = 'musclog-reset-consent';

export function getAnalyticsConsent(): AnalyticsConsentState {
  return null;
}

export function setAnalyticsConsent(_consent: AnalyticsConsentState) {}

export function resetAnalyticsConsent() {}

export function disableAnalytics() {}

export async function ensureAnalytics(): Promise<void> {}

export function trackAnalyticsEvent(
  _eventName: string,
  _params?: Record<string, string | number | boolean>
) {}

export function trackPageView(_pagePath: string, _pageTitle?: string) {}

export function trackStoreButtonClick(_params: {
  store: 'google_play' | 'app_store';
  availability: 'available' | 'coming_soon' | 'testflight';
}) {}
