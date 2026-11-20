import { needsPremiumConsent, PREMIUM_CONSENT_VERSION } from '../premiumConsent';
import { manageSubscriptionUrl, PREMIUM_PRIVACY_URL, PREMIUM_TERMS_URL } from '../premiumLinks';

describe('needsPremiumConsent', () => {
  it('asks only when turning on without the current version on record', () => {
    expect(PREMIUM_CONSENT_VERSION).toBe(1);
    expect(needsPremiumConsent(null, false, true)).toBe(true);
    expect(needsPremiumConsent(0, false, true)).toBe(true);
    expect(needsPremiumConsent(PREMIUM_CONSENT_VERSION - 1, false, true)).toBe(true);
    expect(needsPremiumConsent(PREMIUM_CONSENT_VERSION, false, true)).toBe(false);
  });

  it('never asks when turning off or when already on', () => {
    expect(needsPremiumConsent(null, true, false)).toBe(false);
    expect(needsPremiumConsent(null, false, false)).toBe(false);
    expect(needsPremiumConsent(null, true, true)).toBe(false);
  });
});

describe('premium links', () => {
  it('names the store subscription page per platform and none elsewhere', () => {
    expect(manageSubscriptionUrl('ios')).toBe('https://apps.apple.com/account/subscriptions');
    expect(manageSubscriptionUrl('android')).toBe(
      'https://play.google.com/store/account/subscriptions'
    );
    expect(manageSubscriptionUrl('web')).toBeNull();
    expect(manageSubscriptionUrl('windows')).toBeNull();
  });

  it('points at the English terms and privacy pages', () => {
    expect(PREMIUM_TERMS_URL).toBe('https://musclog.app/en/terms');
    expect(PREMIUM_PRIVACY_URL).toBe('https://musclog.app/en/privacy');
  });
});
