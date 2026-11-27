// Consent to send requests to Musclog Iron (plan 8.6). Pure: no storage here.

/**
 * Bump when the data recipients or the wording of the consent change. Devices with an older
 * version can review the updated consent from the Iron screen.
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
 * links on the Musclog Iron screen (`constants/aiGatewayLinks.ts`). The Worker requires this
 * acknowledgement on each authenticated request it sends to Otari.
 *
 * 5 (2026-11-27): the consent also says, in its own paragraph (`ai.disclaimer.consent`), that AI
 * answers are often wrong, are not medical, nutrition or training advice, and that Musclog is not
 * responsible for what the AI says; agreeing accepts that and the Terms' "AI Features and AI
 * Output" section. The Worker accepts any version from 4 up (`MIN_CONSENT_VERSION`).
 *
 * 6 (2026-11-27): the consent says Musclog Iron is for adults (18+), that agreeing confirms it, and
 * that the details sent can include weight, body fat and nutrition imported from Health Connect or
 * Apple Health.
 */
export const PREMIUM_CONSENT_VERSION = 6;

/** True when hosted AI is on (or is being turned on) without consent to the current version. */
export function needsPremiumConsent({
  storedVersion,
  nextValue,
}: {
  storedVersion: number | null;
  nextValue: boolean;
}): boolean {
  return nextValue && storedVersion !== PREMIUM_CONSENT_VERSION;
}
