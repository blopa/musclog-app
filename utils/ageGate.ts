// Who may use Musclog, and who may use the cloud AI Musclog runs. Pure: no storage here.
//
// The Terms and the privacy policy state both ages, so a change here is a change to them too
// (`website.terms.sections.eligibility`, `website.privacy.sections.childrenPrivacy`, ten locales).

import { differenceInYears } from 'date-fns';

/** The youngest person Musclog is for: the age at which the GDPR lets a person consent alone in the Netherlands. */
export const MINIMUM_APP_AGE = 16;

/** The youngest person for Musclog Iron and the free tier: OpenRouter, which carries both, requires adults. */
export const MINIMUM_CLOUD_AI_AGE = 18;

/** Whole years on `now`, counting the birthday itself. */
export function ageInYears(birthDate: Date | number, now: Date = new Date()): number {
  return differenceInYears(now, new Date(birthDate));
}

export function isUnderMinimumAppAge(birthDate: Date | number, now: Date = new Date()): boolean {
  return ageInYears(birthDate, now) < MINIMUM_APP_AGE;
}

/**
 * True only when a stored birthday says the person is not an adult. A missing birthday is not proof
 * of anything: each cloud AI consent asks the person to confirm their age.
 */
export function isUnderCloudAiAge(
  birthDate: Date | number | null | undefined,
  now: Date = new Date()
): boolean {
  if (birthDate === null || birthDate === undefined) {
    return false;
  }

  const age = ageInYears(birthDate, now);

  return Number.isFinite(age) && age < MINIMUM_CLOUD_AI_AGE;
}
