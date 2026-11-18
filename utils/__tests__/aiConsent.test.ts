import { needsFreeTierConsent } from '../aiConsent';

describe('needsFreeTierConsent', () => {
  it('asks only when turning the free tier on', () => {
    expect(needsFreeTierConsent(false, true)).toBe(true);
    expect(needsFreeTierConsent(true, false)).toBe(false);
    expect(needsFreeTierConsent(true, true)).toBe(false);
    expect(needsFreeTierConsent(false, false)).toBe(false);
  });
});
