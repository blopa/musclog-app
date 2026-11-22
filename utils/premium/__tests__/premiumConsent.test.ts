import { needsPremiumConsent, PREMIUM_CONSENT_VERSION } from '../premiumConsent';
import { manageSubscriptionUrl, PREMIUM_PRIVACY_URL, PREMIUM_TERMS_URL } from '../premiumLinks';

describe('needsPremiumConsent', () => {
  it('asks only when turning on without the current version on record', () => {
    expect(PREMIUM_CONSENT_VERSION).toBe(1);
    expect(needsPremiumConsent({ storedVersion: null, currentlyOn: false, nextValue: true })).toBe(
      true
    );
    expect(needsPremiumConsent({ storedVersion: 0, currentlyOn: false, nextValue: true })).toBe(
      true
    );
    expect(
      needsPremiumConsent({
        storedVersion: PREMIUM_CONSENT_VERSION - 1,
        currentlyOn: false,
        nextValue: true,
      })
    ).toBe(true);
    expect(
      needsPremiumConsent({
        storedVersion: PREMIUM_CONSENT_VERSION,
        currentlyOn: false,
        nextValue: true,
      })
    ).toBe(false);
  });

  it('never asks when turning off or when already on', () => {
    expect(needsPremiumConsent({ storedVersion: null, currentlyOn: true, nextValue: false })).toBe(
      false
    );
    expect(needsPremiumConsent({ storedVersion: null, currentlyOn: false, nextValue: false })).toBe(
      false
    );
    expect(needsPremiumConsent({ storedVersion: null, currentlyOn: true, nextValue: true })).toBe(
      false
    );
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
