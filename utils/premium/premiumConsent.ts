// Consent to send requests to Musclog Iron (plan 8.6). Pure: no storage here.

/**
 * Bump when the data recipients or the wording of the consent change: a stored older version asks
 * again on the next turn-on.
 */
export const PREMIUM_CONSENT_VERSION = 1;

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
