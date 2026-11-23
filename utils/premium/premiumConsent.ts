// Consent to send requests to Musclog Iron (plan 8.6). Pure: no storage here.

/**
 * Bump when the data recipients or the wording of the consent change: a stored older version asks
 * again on the next turn-on.
 *
 * 2 (2026-11-22): the consent names the kinds of data sent (workouts, meals, body measurements),
 * asks for explicit consent to health-related data, and discloses OpenRouter's screening of every
 * request for child sexual abuse material. Version 1 named only messages and photos.
 *
 * 3 (2026-11-23): meal photos go to Musclog Iron (hosted vision is on), so the consent names them
 * again as a kind of data sent.
 */
export const PREMIUM_CONSENT_VERSION = 3;

/** True only when turning hosted AI ON without a consent to the current version on record. */
export function needsPremiumConsent({
  storedVersion,
  currentlyOn,
  nextValue,
}: {
  storedVersion: number | null;
  currentlyOn: boolean;
  nextValue: boolean;
}): boolean {
  return !currentlyOn && nextValue && storedVersion !== PREMIUM_CONSENT_VERSION;
}
