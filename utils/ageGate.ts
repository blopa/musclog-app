// The ages Musclog states: who it is meant for, and who may use the cloud AI Musclog runs. A
// birthday is optional, and being under the app's age blocks nothing: the app says so. Pure: no
// storage here.
//
// The Terms and the privacy policy state both ages, so a change here is a change to them too
// (`website.terms.sections.eligibility`, `website.privacy.sections.childrenPrivacy`, ten locales).

import { differenceInYears, startOfDay } from 'date-fns';

/** The youngest person Musclog is for: the age at which the GDPR lets a person consent alone in the Netherlands. */
export const MINIMUM_APP_AGE = 16;

/** The youngest person for Musclog Iron and the free tier: OpenRouter, which carries both, requires adults. */
export const MINIMUM_CLOUD_AI_AGE = 18;

/** The age calorie estimates assume for a person who gave no birthday. */
export const ASSUMED_AGE = 30;

/** Below this a date is a slip (a calendar confirmed untouched is today), not a birthday. */
export const MINIMUM_PLAUSIBLE_AGE = 5;

/** Whole years on `now`, counting the birthday itself. */
export function ageInYears(birthDate: Date | number, now: Date = new Date()): number {
  return differenceInYears(now, new Date(birthDate));
}

export function isUnderMinimumAppAge(birthDate: Date | number, now: Date = new Date()): boolean {
  return ageInYears(birthDate, now) < MINIMUM_APP_AGE;
}

/** A picked or stored date as a birthday: null for none, and for one too recent to be anyone's. */
export function asBirthday<T extends Date | number>(
  date: T | null | undefined,
  now: Date = new Date()
): T | null {
  if (date === null || date === undefined || !(ageInYears(date, now) >= MINIMUM_PLAUSIBLE_AGE)) {
    return null;
  }

  return date;
}

/** The age to calculate with: the person's own, or {@link ASSUMED_AGE} without a birthday. */
export function ageForCalculations(
  birthDate: Date | number | null | undefined,
  now: Date = new Date()
): number {
  const birthday = asBirthday(birthDate, now);

  return birthday === null ? ASSUMED_AGE : ageInYears(birthday, now);
}

/**
 * The day a birthday calendar opens on. With no answer yet that is today, which {@link asBirthday}
 * reads as no answer, so confirming it untouched never answers for the person.
 */
export function birthdayPickerDate(birthday: Date | null, now: Date = new Date()): Date {
  return birthday ?? startOfDay(now);
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
