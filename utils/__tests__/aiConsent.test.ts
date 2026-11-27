import { readFileSync } from 'fs';
import { join } from 'path';

import {
  AI_ACCURACY_CONSENT_KEY,
  AI_CONSENT_VERSION,
  hasCurrentAiConsent,
  needsFreeTierConsent,
  parseAiConsentRecords,
  withAiAccuracyConsent,
  withAiConsentRecord,
} from '../aiConsent';

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

describe('AI consent records', () => {
  it('keeps what was agreed to, which wording and when', () => {
    const records = withAiConsentRecord({}, 'openai', AI_CONSENT_VERSION, 1_000);

    expect(records.openai).toEqual({ version: AI_CONSENT_VERSION, at: 1_000 });
    expect(parseAiConsentRecords(JSON.stringify(records))).toEqual(records);
  });

  it('asks again when the wording changed since, or nothing was agreed', () => {
    const old = withAiConsentRecord({}, 'claude', AI_CONSENT_VERSION - 1, 1_000);

    expect(hasCurrentAiConsent(old, 'claude')).toBe(false);
    expect(hasCurrentAiConsent({}, 'claude')).toBe(false);
    expect(
      hasCurrentAiConsent(withAiConsentRecord(old, 'claude', AI_CONSENT_VERSION, 2), 'claude')
    ).toBe(true);
  });

  it('counts anything unreadable as nothing agreed', () => {
    expect(parseAiConsentRecords(null)).toEqual({});
    expect(parseAiConsentRecords('not json')).toEqual({});
    expect(parseAiConsentRecords('{"gemini":{"version":"1"}}')).toEqual({});
  });
});
