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
 *
 * 4 (2026-11-24): the consent names both AI gateways the Worker can forward through, OpenRouter and
 * Otari (Mozilla.ai), says Musclog chooses which one and that the consent covers both, keeps the
 * child-abuse-material screening as OpenRouter's, and points to both gateways' privacy and terms
 * links on the Musclog Iron screen (`constants/aiGatewayLinks.ts`). This is what lets
 * `scripts/premium-upstream.sh production set otari --consent-ready` run without asking again.
 */
export const PREMIUM_CONSENT_VERSION = 4;

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
