/** @jest-environment jsdom */
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  ensureAnalytics,
  trackAnalyticsEvent,
} from '../websiteAnalytics.web';

// gtag.js executes only dataLayer entries that are `arguments` objects; a plain array is ignored.
// The site once pushed arrays, so GA4 received nothing for months while everything looked wired.
function isArgumentsObject(value: unknown) {
  return Object.prototype.toString.call(value) === '[object Arguments]';
}

describe('website gtag stub', () => {
  beforeEach(() => {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'accepted');
    // The GA script never loads in jsdom: resolve the injected <script> as if it had.
    jest.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      setTimeout(() => (node as HTMLScriptElement).onload?.(new Event('load')), 0);

      return node;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('pushes js, config and events as arguments objects, never arrays', async () => {
    await ensureAnalytics();
    trackAnalyticsEvent('store_button_click', { store: 'google_play' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const commands = window.dataLayer.map((entry) => Array.from(entry as ArrayLike<unknown>)[0]);

    expect(commands).toEqual(expect.arrayContaining(['js', 'config', 'event']));
    expect(window.dataLayer.every(isArgumentsObject)).toBe(true);
  });
});
