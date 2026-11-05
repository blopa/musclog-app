export type AnalyticsConsentState = 'accepted' | 'rejected' | null;

export const ANALYTICS_CONSENT_STORAGE_KEY = 'musclog.analytics-consent';
export const ANALYTICS_RESET_EVENT = 'musclog-reset-consent';

const DEFAULT_GA_MEASUREMENT_ID = 'G-176QWPGYFM';
const GA_SCRIPT_ID = 'musclog-ga-script';
const GA_DEBUG_MODE =
  process.env.NODE_ENV === 'development' || process.env.EXPO_PUBLIC_GA_DEBUG === 'true';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

let gaLoadPromise: Promise<void> | null = null;
let gaConfiguredForId: string | null = null;

function canUseDom() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function getGaMeasurementId() {
  return process.env.EXPO_PUBLIC_GA_MEASUREMENT_ID ?? DEFAULT_GA_MEASUREMENT_ID;
}

function setGaDisabled(disabled: boolean) {
  if (!canUseDom()) {
    return;
  }

  window[`ga-disable-${getGaMeasurementId()}`] = disabled;
}

function ensureGtagStub() {
  if (!canUseDom()) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    };
}

function loadScriptOnce(src: string, id: string) {
  if (!canUseDom()) {
    return Promise.resolve();
  }

  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing) {
    if (existing.dataset.loaded === 'true') {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
        once: true,
      });
    });
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.src = src;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };

    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export function getAnalyticsConsent(): AnalyticsConsentState {
  if (!canUseDom()) {
    return null;
  }

  const storedValue = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
  return storedValue === 'accepted' || storedValue === 'rejected' ? storedValue : null;
}

export function setAnalyticsConsent(consent: AnalyticsConsentState) {
  if (!canUseDom()) {
    return;
  }

  if (consent === null) {
    window.localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
}

export function resetAnalyticsConsent() {
  if (!canUseDom()) {
    return;
  }

  setAnalyticsConsent(null);
  disableAnalytics();
  window.dispatchEvent(new Event(ANALYTICS_RESET_EVENT));
}

export function disableAnalytics() {
  setGaDisabled(true);
}

export async function ensureAnalytics(): Promise<void> {
  if (!canUseDom() || getAnalyticsConsent() !== 'accepted') {
    return;
  }

  const gaMeasurementId = getGaMeasurementId();

  ensureGtagStub();
  setGaDisabled(false);

  if (!gaLoadPromise) {
    gaLoadPromise = loadScriptOnce(
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`,
      GA_SCRIPT_ID
    );
  }

  await gaLoadPromise;

  if (gaConfiguredForId === gaMeasurementId) {
    return;
  }

  window.gtag?.('js', new Date());
  window.gtag?.('config', gaMeasurementId, {
    anonymize_ip: true,
    debug_mode: GA_DEBUG_MODE,
    send_page_view: false,
  });

  gaConfiguredForId = gaMeasurementId;
}

export function trackAnalyticsEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
) {
  if (getAnalyticsConsent() !== 'accepted') {
    return;
  }

  void ensureAnalytics().then(() => {
    setGaDisabled(false);
    window.gtag?.('event', eventName, params ?? {});
  });
}

export function trackPageView(pagePath: string, pageTitle?: string) {
  if (getAnalyticsConsent() !== 'accepted') {
    return;
  }

  void ensureAnalytics().then(() => {
    setGaDisabled(false);
    window.gtag?.('event', 'page_view', {
      page_path: pagePath,
      page_title: pageTitle ?? document.title,
    });
  });
}

const CAMPAIGN_STORAGE_KEY = 'musclog.campaign';
const CAMPAIGN_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign'] as const;

export type CampaignParams = Partial<Record<(typeof CAMPAIGN_PARAMS)[number], string>>;

/**
 * Remembers the `utm_*` tags of the landing URL for the tab's session (first touch wins), so a
 * store click several pages later can still say which post sent the visitor. Stays in
 * sessionStorage: nothing leaves the browser until the visitor accepts analytics.
 */
export function captureCampaign() {
  if (!canUseDom()) {
    return;
  }

  try {
    if (window.sessionStorage.getItem(CAMPAIGN_STORAGE_KEY)) {
      return;
    }

    const search = new URLSearchParams(window.location.search);
    const campaign: CampaignParams = {};
    for (const key of CAMPAIGN_PARAMS) {
      const value = search.get(key)?.slice(0, 64);
      if (value) {
        campaign[key] = value;
      }
    }

    if (Object.keys(campaign).length > 0) {
      window.sessionStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(campaign));
    }
  } catch {
    // Storage can be blocked (private windows); attribution is best effort.
  }
}

export function getCampaign(): CampaignParams {
  if (!canUseDom()) {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(CAMPAIGN_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const campaign: CampaignParams = {};
    if (typeof parsed === 'object' && parsed !== null) {
      for (const key of CAMPAIGN_PARAMS) {
        const value = (parsed as Record<string, unknown>)[key];
        if (typeof value === 'string') {
          campaign[key] = value;
        }
      }
    }

    return campaign;
  } catch {
    return {};
  }
}

/**
 * Adds the remembered campaign to a Google Play URL as the install `referrer`, which Play Console
 * reports per tag. Without a campaign the URL is returned unchanged.
 */
export function withPlayReferrer(url: string): string {
  const campaign = getCampaign();
  const referrer = new URLSearchParams(campaign as Record<string, string>).toString();

  return referrer ? `${url}&referrer=${encodeURIComponent(referrer)}` : url;
}

export function trackStoreButtonClick(params: {
  store: 'google_play' | 'app_store';
  availability: 'available' | 'coming_soon' | 'testflight';
}) {
  trackAnalyticsEvent('store_button_click', {
    availability: params.availability,
    store: params.store,
    ...getCampaign(),
  });
}

export function trackDemoStart() {
  trackAnalyticsEvent('demo_start', getCampaign());
}
