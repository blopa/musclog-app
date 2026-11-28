/** Turning the Musclog free tier ON sends requests to Google Gemini, so it needs explicit consent first. */
export function needsFreeTierConsent(currentlyOn: boolean, nextValue: boolean): boolean {
  return !currentlyOn && nextValue;
}

/**
 * Every consent that turns on an AI option run by Musclog (Musclog Iron, the free tier) ends with
 * this acknowledgement, in its own paragraph: AI answers are often wrong, are not advice, and
 * Musclog is not responsible for them. Agreeing to the consent accepts it.
 */
export const AI_ACCURACY_CONSENT_KEY = 'ai.disclaimer.consent';

/** A consent message with the AI-accuracy acknowledgement as its last paragraph. */
export function withAiAccuracyConsent(body: string, accuracy: string): string {
  return `${body}\n\n${accuracy}`;
}

/** Providers the person brings themselves. What they are sent leaves the phone, so each is asked. */
export const OWN_AI_PROVIDERS = ['gemini', 'openai', 'claude', 'local'] as const;

export type OwnAiProvider = (typeof OWN_AI_PROVIDERS)[number];

/** Every AI option that sends data off the phone: the person's own providers and Musclog's two. */
export type AiConsentProvider = OwnAiProvider | 'gateway' | 'hosted';

/**
 * Bump when the wording of the free-tier or own-provider consent changes (Musclog Iron has its own
 * version, `PREMIUM_CONSENT_VERSION`).
 */
export const AI_CONSENT_VERSION = 1;

/** What was agreed to and when, so a consent can be shown to have been given. */
export type AiConsentRecord = { version: number; at: number };

export type AiConsentRecords = Partial<Record<AiConsentProvider, AiConsentRecord>>;

const isRecordEntry = (value: unknown): value is AiConsentRecord =>
  typeof value === 'object' &&
  value !== null &&
  Number.isInteger((value as AiConsentRecord).version) &&
  Number.isFinite((value as AiConsentRecord).at);

/** Reads the stored records; anything unreadable counts as nothing agreed. */
export function parseAiConsentRecords(raw: string | null | undefined): AiConsentRecords {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;

    return Object.fromEntries(
      Object.entries(parsed ?? {}).filter(([, value]) => isRecordEntry(value))
    ) as AiConsentRecords;
  } catch {
    return {};
  }
}

export function withAiConsentRecord(
  records: AiConsentRecords,
  provider: AiConsentProvider,
  version: number,
  at: number
): AiConsentRecords {
  return { ...records, [provider]: { version, at } };
}

/** True when the person already agreed to the current wording for this provider. */
export function hasCurrentAiConsent(records: AiConsentRecords, provider: OwnAiProvider): boolean {
  return records[provider]?.version === AI_CONSENT_VERSION;
}
