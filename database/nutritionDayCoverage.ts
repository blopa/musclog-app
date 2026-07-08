import { FastedDayRepository } from '@/database/repositories/FastedDayRepository';
import { SettingsService } from '@/database/services/SettingsService';
import { type DayKeyRange, utcNormalizedDayKey } from '@/utils/calendarDate';
import { effectiveNutritionDayCount } from '@/utils/effectiveNutritionDays';

type NutritionDayRecord = {
  date: number;
  timezone?: string | null;
};

export type NutritionDayCoverage = {
  loggedDayKeys: Set<number>;
  fastedDayKeys: Set<number>;
  effectiveDayKeys: Set<number>;
  fastedDaysEnabled: boolean;
  effectiveDayCount: number;
};

export function loggedNutritionDayKeys(records: Iterable<NutritionDayRecord>): Set<number> {
  return new Set([...records].map((record) => utcNormalizedDayKey(record.date, record.timezone)));
}

function unionDayKeys(loggedDayKeys: Set<number>, fastedDayKeys: Set<number>): Set<number> {
  const effectiveDayKeys = new Set(loggedDayKeys);
  for (const key of fastedDayKeys) {
    effectiveDayKeys.add(key);
  }
  return effectiveDayKeys;
}

export async function getNutritionDayCoverage(
  records: Iterable<NutritionDayRecord>,
  options: { range?: DayKeyRange; includeAllFastedDays?: boolean } = {}
): Promise<NutritionDayCoverage> {
  const loggedDayKeys = loggedNutritionDayKeys(records);
  const fastedDaysEnabled = await SettingsService.getEnableFastedDay();
  const fastedDayKeys =
    fastedDaysEnabled && options.includeAllFastedDays
      ? await FastedDayRepository.getAllFastedDayKeys()
      : fastedDaysEnabled && options.range
        ? await FastedDayRepository.getFastedDayKeysForRange(options.range)
        : new Set<number>();
  const effectiveDayKeys = unionDayKeys(loggedDayKeys, fastedDayKeys);

  return {
    loggedDayKeys,
    fastedDayKeys,
    effectiveDayKeys,
    fastedDaysEnabled,
    effectiveDayCount: effectiveNutritionDayCount(loggedDayKeys, fastedDayKeys),
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
