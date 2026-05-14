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

export function trackStoreButtonClick(params: {
  store: 'google_play' | 'app_store';
  availability: 'available' | 'coming_soon' | 'testflight';
}) {
  trackAnalyticsEvent('store_button_click', {
    availability: params.availability,
    store: params.store,
  });
}
