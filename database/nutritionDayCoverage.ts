import { FastedDayRepository } from '@/database/repositories/FastedDayRepository';
import { SettingsService } from '@/database/services/SettingsService';
import { type DayKeyRange, utcNormalizedDayKey } from '@/utils/calendarDate';

/**
 * Shared denominator logic for the fasting-day feature.
 *
 * Every historical macro/calorie average divides a period total by a day count. Under the
 * fasting-day feature that count (`effectiveDayCount`) is the union of:
 *   - distinct days that had logged food, and
 *   - distinct days the user explicitly flagged as fasted (a real 0-kcal day).
 * Unflagged empty days (a forgotten log) are excluded so they don't drag averages toward 0.
 *
 * Both inputs are UTC-normalized day keys (see `utcNormalizedDayKey`), so a fasted day and a
 * logged day on the same calendar day collapse to a single day.
 */

type NutritionDayRecord = {
  date: number;
  timezone?: string | null;
};

export type NutritionDayCoverage = {
  /** Distinct logged-food days ∪ distinct flagged fasted days, as UTC-normalized day keys. */
  effectiveDayKeys: Set<number>;
  fastedDaysEnabled: boolean;
  /** `effectiveDayKeys.size` — the averaging divisor under the fasting-day feature. */
  effectiveDayCount: number;
};

function loggedNutritionDayKeys(records: Iterable<NutritionDayRecord>): Set<number> {
  return new Set([...records].map((record) => utcNormalizedDayKey(record.date, record.timezone)));
}

function fastedDayKeysFor(options: {
  range?: DayKeyRange;
  includeAllFastedDays?: boolean;
}): Promise<Set<number>> {
  if (options.includeAllFastedDays) {
    return FastedDayRepository.getAllFastedDayKeys();
  }
  if (options.range) {
    return FastedDayRepository.getFastedDayKeysForRange(options.range);
  }
  return Promise.resolve(new Set());
}

export async function getNutritionDayCoverage(
  records: Iterable<NutritionDayRecord>,
  options: { range?: DayKeyRange; includeAllFastedDays?: boolean } = {}
): Promise<NutritionDayCoverage> {
  const effectiveDayKeys = loggedNutritionDayKeys(records);
  const fastedDaysEnabled = await SettingsService.getEnableFastedDay();
  const fastedDayKeys = fastedDaysEnabled ? await fastedDayKeysFor(options) : new Set<number>();
  for (const key of fastedDayKeys) {
    effectiveDayKeys.add(key);
  }

  return {
    effectiveDayKeys,
    fastedDaysEnabled,
    effectiveDayCount: effectiveDayKeys.size,
  };
}

export async function loggedOrFastedDayKeys(
  records: Iterable<NutritionDayRecord>
): Promise<Set<number>> {
  const coverage = await getNutritionDayCoverage(records, { includeAllFastedDays: true });
  return coverage.effectiveDayKeys;
}

export async function withFastedZeroDays<T extends { date: number }>(
  days: T[],
  range: DayKeyRange,
  makeZeroDay: (dayKey: number) => T
): Promise<{ days: T[]; fastedDaysEnabled: boolean }> {
  if (!(await SettingsService.getEnableFastedDay())) {
    return { days, fastedDaysEnabled: false };
  }

  const fastedDayKeys = await FastedDayRepository.getFastedDayKeysForRange(range);
  if (fastedDayKeys.size === 0) {
    return { days, fastedDaysEnabled: true };
  }

  const existingDayKeys = new Set(days.map((day) => day.date));
  const additions: T[] = [];
  for (const dayKey of fastedDayKeys) {
    if (!existingDayKeys.has(dayKey)) {
      additions.push(makeZeroDay(dayKey));
    }
  }

  return {
    days: additions.length > 0 ? [...days, ...additions].sort((a, b) => a.date - b.date) : days,
    fastedDaysEnabled: true,
  };
}

export async function addFastedZeroDaysToMap<T>(
  valuesByDay: Map<number, T>,
  range: DayKeyRange,
  zeroValue: T
): Promise<void> {
  if (!(await SettingsService.getEnableFastedDay())) {
    return;
  }

  const fastedDayKeys = await FastedDayRepository.getFastedDayKeysForRange(range);
  for (const dayKey of fastedDayKeys) {
    if (!valuesByDay.has(dayKey)) {
      valuesByDay.set(dayKey, zeroValue);
    }
  }
}
