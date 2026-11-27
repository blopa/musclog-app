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
