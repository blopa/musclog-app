import { needsPremiumConsent, PREMIUM_CONSENT_VERSION } from '../premiumConsent';
import { manageSubscriptionUrl, PREMIUM_PRIVACY_PATH, PREMIUM_TERMS_PATH } from '../premiumLinks';
import { websitePageUrl } from '../../websiteUrl';

describe('needsPremiumConsent', () => {
  it('asks only when turning on without the current version on record', () => {
    expect(PREMIUM_CONSENT_VERSION).toBe(6);
    expect(needsPremiumConsent({ storedVersion: null, nextValue: true })).toBe(true);
    expect(needsPremiumConsent({ storedVersion: 0, nextValue: true })).toBe(true);
    expect(
      needsPremiumConsent({
        storedVersion: PREMIUM_CONSENT_VERSION - 1,
        nextValue: true,
      })
    ).toBe(true);
    expect(
      needsPremiumConsent({
        storedVersion: PREMIUM_CONSENT_VERSION,
        nextValue: true,
      })
    ).toBe(false);
  });

  it('asks again, on the next turn-on, from a consent given before meal photos were named', () => {
    // Version 2 named workouts, meals and body measurements but not photos.
    expect(needsPremiumConsent({ storedVersion: 2, nextValue: true })).toBe(true);
  });

  it('asks again, on the next turn-on, from a consent that named only OpenRouter', () => {
    // Version 3 named one gateway; version 4 names OpenRouter and Otari.
    expect(needsPremiumConsent({ storedVersion: 3, nextValue: true })).toBe(true);
  });

  it('never asks when turning off and flags stale consent while already on', () => {
    expect(needsPremiumConsent({ storedVersion: null, nextValue: false })).toBe(false);
    expect(needsPremiumConsent({ storedVersion: PREMIUM_CONSENT_VERSION, nextValue: true })).toBe(
      false
    );
    expect(needsPremiumConsent({ storedVersion: null, nextValue: true })).toBe(true);
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

  it('points at the terms and privacy pages in the app language', () => {
    expect(websitePageUrl(PREMIUM_TERMS_PATH, 'en-US')).toBe('https://musclog.app/en/terms');
    expect(websitePageUrl(PREMIUM_PRIVACY_PATH, 'en-US')).toBe('https://musclog.app/en/privacy');
    expect(websitePageUrl(PREMIUM_TERMS_PATH, 'nl-NL')).toBe('https://musclog.app/nl/terms');
    expect(websitePageUrl(PREMIUM_PRIVACY_PATH, 'pt-BR')).toBe('https://musclog.app/pt-br/privacy');
  });
});
