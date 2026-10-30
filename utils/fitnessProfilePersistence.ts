import { subYears } from 'date-fns';

import type { Units } from '@/constants/settings';
import type User from '@/database/models/User';
import type { FitnessGoal, Gender, LiftingExperience, WeightGoal } from '@/database/models/User';
import { SettingsService } from '@/database/services/SettingsService';
import { UserMetricService } from '@/database/services/UserMetricService';
import { UserService } from '@/database/services/UserService';
import { DEFAULT_LANG } from '@/lang/lang';
import type { FitnessDetails } from '@/types/fitnessDetails';

import {
  formatLocalCalendarDayNumericIntl,
  localCalendarDayDate,
  localDayClosedRangeMaxMs,
  localDayStartMs,
  localDayStartMsFromIsoDateOnly,
  parseLocalCalendarDate,
} from './calendarDate';
import { getCurrentTimezone } from './timezone';
import {
  cmToDisplay,
  displayToCm,
  displayToKg,
  kgToDisplay,
  storedHeightToCm,
  storedWeightToKg,
} from './unitConversion';
import { getDefaultUsernameForGender } from './usernameUtils';

/**
 * Display DOB using the user's locale (numeric day/month/year).
 * For parsing user input back to storage, use {@link parseDobStringToLocalDayStartMs}.
 */
export function formatDateOfBirthFromTimestamp(
  timestamp: number,
  localeTag: string = DEFAULT_LANG
): string {
  return formatLocalCalendarDayNumericIntl(timestamp, localeTag);
}

/** Default adult DOB when none is provided: start of local calendar day N years ago. */
export function defaultAdultDobLocalDayStartMs(ageYears = 25): number {
  return localDayStartMs(subYears(new Date(), ageYears));
}

/** Same as {@link defaultAdultDobLocalDayStartMs} but formatted for display fields. */
export function defaultAdultDobDisplayString(ageYears = 25, localeTag = DEFAULT_LANG): string {
  return formatDateOfBirthFromTimestamp(defaultAdultDobLocalDayStartMs(ageYears), localeTag);
}

export function parseMmDdYyyyDateOfBirthToLocalDayStartMs(dob: string): number {
  const parts = dob.trim().split('/');
  if (parts.length !== 3) {
    throw new Error('Invalid date format. Please use MM/DD/YYYY');
  }

  const month = parseInt(parts[0], 10) - 1;
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  return localDayStartMs(new Date(year, month, day));
}

/**
 * Parse DOB from UI: prefers unambiguous `yyyy-MM-dd`, then legacy US `MM/DD/YYYY`.
 */
export function parseDobStringToLocalDayStartMs(dob: string): number {
  const s = dob.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return localDayStartMsFromIsoDateOnly(s);
  }

  return parseMmDdYyyyDateOfBirthToLocalDayStartMs(s);
}

/**
 * Parse stored/display DOB for pickers: supports MM/DD/YYYY and yyyy-MM-dd (ISO date-only).
 * Returns local start-of-day for consistent DatePicker display.
 */
export function parseDobDisplayStringToPickerDate(dobString: string): Date {
  const s = dobString.trim();
  if (!s) {
    return localCalendarDayDate(new Date());
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return localCalendarDayDate(parseLocalCalendarDate(s));
  }

  const parts = s.split('/');
  if (parts.length === 3) {
    return localCalendarDayDate(
      new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10))
    );
  }

  return localCalendarDayDate(new Date());
}

/**
 * Load initial fitness form data from user + latest metrics (same source as onboarding).
 */
export async function loadFitnessDetailsInitialData(
  units: 'imperial' | 'metric',
  localeTag: string = DEFAULT_LANG
): Promise<Partial<FitnessDetails>> {
  const user = await UserService.getCurrentUser();
  const latestWeight = await UserMetricService.getLatest('weight');
  const latestHeight = await UserMetricService.getLatest('height');
  const latestBodyFat = await UserMetricService.getLatest('body_fat');

  const [weightDec, heightDec, bodyFatDec] = await Promise.all([
    latestWeight?.getDecrypted(),
    latestHeight?.getDecrypted(),
    latestBodyFat?.getDecrypted(),
  ]);

  const defaultWeightKg = 70;
  const defaultHeightCm = 170;
  const weightDisplay =
    weightDec != null
      ? kgToDisplay(storedWeightToKg(weightDec.value, weightDec.unit), units)
      : kgToDisplay(defaultWeightKg, units);
  const heightDisplay =
    heightDec != null
      ? cmToDisplay(storedHeightToCm(heightDec.value, heightDec.unit), units)
      : cmToDisplay(defaultHeightCm, units);

  if (user) {
    return {
      dob: user.getAge() > 0 ? formatDateOfBirthFromTimestamp(user.dateOfBirth, localeTag) : '',
      units,
      weight: String(weightDisplay),
      height: String(heightDisplay),
      fatPercentage: bodyFatDec ? bodyFatDec.value : undefined,
      weightGoal: user.weightGoal ?? 'maintain',
      fitnessGoal: user.fitnessGoal,
      activityLevel: user.activityLevel ?? 2,
      gender: user.gender,
      experience: user.liftingExperience ?? 'intermediate',
    };
  }

  return {
    dob: '',
    units,
    weight: String(weightDisplay),
    height: String(heightDisplay),
    fatPercentage: bodyFatDec ? bodyFatDec.value : undefined,
    weightGoal: 'maintain',
    fitnessGoal: 'general',
    activityLevel: 2,
    gender: 'other',
    experience: 'intermediate',
  };
}

/**
 * A profile write in storage terms: metric values, a birthday as local-midnight milliseconds, and
 * every field optional so a partial update (the profile "update with AI" flow) touches only what
 * it names. {@link persistFitnessDetails} is the form-shaped entry that delegates here.
 */
export type FitnessProfileWrite = {
  fullName?: string;
  dateOfBirthMs?: number;
  gender?: Gender;
  fitnessGoal?: FitnessGoal;
  weightGoal?: WeightGoal;
  activityLevel?: 1 | 2 | 3 | 4 | 5;
  liftingExperience?: LiftingExperience;
  weightKg?: number;
  heightCm?: number;
  bodyFatPercent?: number | null;
  units?: Units;
};

/** One reading per metric per local day: the first write creates it, later ones update it. */
async function upsertTodayMetric(
  type: 'weight' | 'height' | 'body_fat',
  value: number,
  unit: 'kg' | 'cm' | '%'
): Promise<void> {
  const dayStart = localDayStartMs(new Date());
  const dayEnd = localDayClosedRangeMaxMs(new Date());
  const now = Date.now();
  const existing = await UserMetricService.getMetricsHistory(
    type,
    { startDate: dayStart, endDate: dayEnd },
    1
  );
  if (existing.length > 0) {
    await UserMetricService.updateMetric(existing[0].id, { value, unit, date: now });
  } else {
    await UserMetricService.createMetric({
      type,
      value,
      unit,
      date: now,
      timezone: getCurrentTimezone(),
    });
  }
}

/**
 * The single writer for the profile's fitness fields: user row, today's body metrics, and the unit
 * system. Idempotent for a given day, so going back and forth in onboarding never stacks readings.
 * A missing user is created only when the fields a user needs are all present; an existing user
 * receives just the fields given.
 */
export async function persistFitnessProfile(data: FitnessProfileWrite): Promise<User> {
  const fullName = data.fullName?.trim() || undefined;
  let user = await UserService.getCurrentUser();
  if (!user) {
    if (!data.gender || !data.fitnessGoal || !data.activityLevel || !data.liftingExperience) {
      throw new Error(
        'Cannot create a profile without gender, goal, activity level and experience'
      );
    }

    user = await UserService.initializeUser({
      fullName: fullName ?? getDefaultUsernameForGender(data.gender),
      dateOfBirth: data.dateOfBirthMs ?? defaultAdultDobLocalDayStartMs(),
      gender: data.gender,
      fitnessGoal: data.fitnessGoal,
      weightGoal: data.weightGoal,
      activityLevel: data.activityLevel,
      liftingExperience: data.liftingExperience,
    });
  } else {
    await user.updateProfile({
      ...(fullName ? { fullName } : {}),
      ...(data.dateOfBirthMs !== undefined ? { dateOfBirth: data.dateOfBirthMs } : {}),
      ...(data.gender ? { gender: data.gender } : {}),
      ...(data.fitnessGoal ? { fitnessGoal: data.fitnessGoal } : {}),
      ...(data.weightGoal ? { weightGoal: data.weightGoal } : {}),
      ...(data.activityLevel ? { activityLevel: data.activityLevel } : {}),
      ...(data.liftingExperience ? { liftingExperience: data.liftingExperience } : {}),
    });
  }

  if (data.weightKg !== undefined && data.weightKg > 0) {
    await upsertTodayMetric('weight', data.weightKg, 'kg');
  }

  if (data.heightCm !== undefined && data.heightCm > 0) {
    await upsertTodayMetric('height', data.heightCm, 'cm');
  }

  if (data.bodyFatPercent != null && data.bodyFatPercent > 0) {
    await upsertTodayMetric('body_fat', data.bodyFatPercent, '%');
  }

  if (data.units) {
    await SettingsService.setUnits(data.units);
  }

  return user;
}

/**
 * Persist fitness details (user profile fields + today's body metrics + units).
 * Mirrors onboarding `saveFitnessData` behavior.
 */
export async function persistFitnessDetails(data: FitnessDetails): Promise<void> {
  const weightDisplay = parseFloat(data.weight);
  const heightDisplay = parseFloat(data.height);

  await persistFitnessProfile({
    dateOfBirthMs: data.dob?.trim() ? parseDobStringToLocalDayStartMs(data.dob) : undefined,
    gender: data.gender,
    fitnessGoal: data.fitnessGoal,
    weightGoal: data.weightGoal,
    activityLevel: data.activityLevel as FitnessProfileWrite['activityLevel'],
    liftingExperience: data.experience,
    weightKg: weightDisplay > 0 ? displayToKg(weightDisplay, data.units) : undefined,
    heightCm: heightDisplay > 0 ? displayToCm(heightDisplay, data.units) : undefined,
    bodyFatPercent: data.fatPercentage,
    units: data.units,
  });
}
