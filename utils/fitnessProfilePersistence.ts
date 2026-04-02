import { subYears } from 'date-fns';
import { names, uniqueNamesGenerator } from 'unique-names-generator';

import { SettingsService, UserMetricService, UserService } from '../database/services';
import type { FitnessDetails } from '../types/fitnessDetails';
import { localCalendarDayDate, localDayClosedRangeMaxMs, localDayStartMs } from './calendarDate';
import {
  cmToDisplay,
  displayToCm,
  displayToKg,
  kgToDisplay,
  storedHeightToCm,
  storedWeightToKg,
} from './unitConversion';

/** Display DOB as MM/DD/YYYY for forms (matches parseMmDdYyyyDateOfBirth). */
export function formatDateOfBirthFromTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
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
 * Parse stored/display DOB for pickers: supports MM/DD/YYYY and yyyy-MM-dd (ISO date-only).
 * Returns local start-of-day for consistent DatePicker display.
 */
export function parseDobDisplayStringToPickerDate(dobString: string): Date {
  const s = dobString.trim();
  if (!s) {
    return localCalendarDayDate(new Date());
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return localCalendarDayDate(new Date(y, m - 1, d));
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
  units: 'imperial' | 'metric'
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
      dob: user.getAge() > 0 ? formatDateOfBirthFromTimestamp(user.dateOfBirth) : '',
      units,
      weight: String(weightDisplay),
      height: String(heightDisplay),
      fatPercentage: bodyFatDec ? bodyFatDec.value : undefined,
      weightGoal: user.weightGoal ?? 'maintain',
      fitnessGoal: user.fitnessGoal,
      activityLevel: user.activityLevel ?? 3,
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
    activityLevel: 3,
    gender: 'other',
    experience: 'intermediate',
  };
}

/**
 * Persist fitness details (user profile fields + today's body metrics + units).
 * Mirrors onboarding `saveFitnessData` behavior.
 */
export async function persistFitnessDetails(data: FitnessDetails): Promise<void> {
  const dateOfBirthMs = data.dob?.trim()
    ? parseMmDdYyyyDateOfBirthToLocalDayStartMs(data.dob)
    : undefined;

  let user = await UserService.getCurrentUser();
  if (!user) {
    const fullName = uniqueNamesGenerator({
      dictionaries: [names],
      style: 'capital',
      separator: ' ',
    });

    user = await UserService.initializeUser({
      fullName,
      dateOfBirth: dateOfBirthMs ?? localDayStartMs(subYears(new Date(), 25)),
      gender: data.gender,
      fitnessGoal: data.fitnessGoal,
      weightGoal: data.weightGoal,
      activityLevel: data.activityLevel,
      liftingExperience: data.experience,
    });
  } else {
    await user.updateProfile({
      ...(dateOfBirthMs !== undefined ? { dateOfBirth: dateOfBirthMs } : {}),
      gender: data.gender,
      fitnessGoal: data.fitnessGoal,
      weightGoal: data.weightGoal,
      activityLevel: data.activityLevel,
      liftingExperience: data.experience,
    });
  }

  const dayStart = localDayStartMs(new Date());
  const now = Date.now();
  const dayEnd = localDayClosedRangeMaxMs(new Date());
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (data.weight && parseFloat(data.weight) > 0) {
    const weightValueKg = displayToKg(parseFloat(data.weight), data.units);
    const existingWeight = await UserMetricService.getMetricsHistory(
      'weight',
      { startDate: dayStart, endDate: dayEnd },
      1
    );
    if (existingWeight.length > 0) {
      await UserMetricService.updateMetric(existingWeight[0].id, {
        value: weightValueKg,
        unit: 'kg',
        date: now,
      });
    } else {
      await UserMetricService.createMetric({
        type: 'weight',
        value: weightValueKg,
        unit: 'kg',
        date: now,
        timezone,
      });
    }
  }

  if (data.height && parseFloat(data.height) > 0) {
    const heightValueCm = displayToCm(parseFloat(data.height), data.units);
    const existingHeight = await UserMetricService.getMetricsHistory(
      'height',
      { startDate: dayStart, endDate: dayEnd },
      1
    );
    if (existingHeight.length > 0) {
      await UserMetricService.updateMetric(existingHeight[0].id, {
        value: heightValueCm,
        unit: 'cm',
        date: now,
      });
    } else {
      await UserMetricService.createMetric({
        type: 'height',
        value: heightValueCm,
        unit: 'cm',
        date: now,
        timezone,
      });
    }
  }

  if (data.fatPercentage != null && data.fatPercentage > 0) {
    const fatValue = data.fatPercentage;
    const existingBodyFat = await UserMetricService.getMetricsHistory(
      'body_fat',
      { startDate: dayStart, endDate: dayEnd },
      1
    );
    if (existingBodyFat.length > 0) {
      await UserMetricService.updateMetric(existingBodyFat[0].id, {
        value: fatValue,
        unit: '%',
        date: now,
      });
    } else {
      await UserMetricService.createMetric({
        type: 'body_fat',
        value: fatValue,
        unit: '%',
        date: now,
        timezone,
      });
    }
  }

  await SettingsService.setUnits(data.units);
}
