import AsyncStorage from '@react-native-async-storage/async-storage';

import { MACRO_STREAK_STATE } from '@/constants/misc';
import { NutritionService } from '@/database/services/NutritionService';
import { utcDayKeyFromLocalDate } from '@/utils/calendarDate';

export type MacroStreak = {
  /** Consecutive logged days ending at yesterday (current day excluded). */
  currentStreak: number;
  /** Longest current streak ever observed, persisted across days. */
  bestStreak: number;
};

type MacroStreakState = MacroStreak & {
  /** UTC-midnight key of the local day this was last computed on. */
  computedDayKey: number;
};

async function readState(): Promise<MacroStreakState | null> {
  try {
    const raw = await AsyncStorage.getItem(MACRO_STREAK_STATE);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<MacroStreakState>;
    if (
      typeof parsed.computedDayKey !== 'number' ||
      typeof parsed.currentStreak !== 'number' ||
      typeof parsed.bestStreak !== 'number'
    ) {
      return null;
    }
    return parsed as MacroStreakState;
  } catch {
    return null;
  }
}

/**
 * Return the user's macro-logging streak, recomputing from the database at most once per
 * local calendar day. On the first read of a new day it recomputes the current streak
 * (consecutive logged days ending yesterday), promotes `bestStreak` when the current run is
 * longer, persists the result, and caches it for the rest of the day. Subsequent reads on the
 * same day return the cached values without touching the database.
 *
 * The best streak is only ever grown here, never recomputed historically — matching the
 * "replace it when the current streak is bigger" rule.
 */
export async function getMacroStreak(date: Date = new Date()): Promise<MacroStreak> {
  const todayKey = utcDayKeyFromLocalDate(date);
  const stored = await readState();

  if (stored && stored.computedDayKey === todayKey) {
    return { currentStreak: stored.currentStreak, bestStreak: stored.bestStreak };
  }

  const currentStreak = await NutritionService.getMacroLoggingStreak(date);
  const bestStreak = Math.max(stored?.bestStreak ?? 0, currentStreak);

  const nextState: MacroStreakState = { computedDayKey: todayKey, currentStreak, bestStreak };
  try {
    await AsyncStorage.setItem(MACRO_STREAK_STATE, JSON.stringify(nextState));
  } catch {
    // Persisting the cache is best-effort; the streak still displays this session.
  }

  return { currentStreak, bestStreak };
}
