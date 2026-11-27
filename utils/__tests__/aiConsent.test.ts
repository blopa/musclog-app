import { readFileSync } from 'fs';
import { join } from 'path';

import { AI_ACCURACY_CONSENT_KEY, needsFreeTierConsent, withAiAccuracyConsent } from '../aiConsent';

describe('needsFreeTierConsent', () => {
  it('asks only when turning the free tier on', () => {
    expect(needsFreeTierConsent(false, true)).toBe(true);
    expect(needsFreeTierConsent(true, false)).toBe(false);
    expect(needsFreeTierConsent(true, true)).toBe(false);
    expect(needsFreeTierConsent(false, false)).toBe(false);
  });
});

describe('withAiAccuracyConsent', () => {
  it('puts the accuracy paragraph after the body, separated by a blank line', () => {
    expect(withAiAccuracyConsent('Body', 'Accuracy')).toBe('Body\n\nAccuracy');
  });

  it('uses a key that exists in the English copy', () => {
    const en = JSON.parse(
      readFileSync(join(__dirname, '../../lang/locales/en-us/ai.json'), 'utf8')
    ) as Record<string, unknown>;
    const value = AI_ACCURACY_CONSENT_KEY.split('.').reduce<unknown>(
      (o, k) => (o as Record<string, unknown> | undefined)?.[k],
      en
    );

    expect(typeof value).toBe('string');
  });
});
