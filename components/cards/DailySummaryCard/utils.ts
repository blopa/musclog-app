import { TFunction } from 'i18next';

import { LANGUAGE_MULTIPLIERS } from '@/lang/lang';
import type { Theme } from '@/theme';

export type MacroValue = {
  value: number;
  goal: number;
};

export type GoalStatus = 'not-reached' | 'reached' | 'exceeded';

export type MacroDailyData = {
  protein: MacroValue;
  carbs: MacroValue;
  fats: MacroValue;
  fiber: MacroValue;
};

/**
 * Calculates the goal status based on consumed value and goal
 */
export function getGoalStatus(consumed: number, goal: number): GoalStatus {
  if (consumed < goal) {
    return 'not-reached';
  }

  if (consumed === goal) {
    return 'reached';
  }

  return 'exceeded';
}

/**
 * Calculates the goal status for a macro value
 */
export function getMacroGoalStatus(value: number | undefined, goal: number): GoalStatus {
  if (value === undefined) {
    return 'not-reached';
  }

  if (value < goal) {
    return 'not-reached';
  }

  if (value === goal) {
    return 'reached';
  }

  return 'exceeded';
}

/**
 * Gets the progress bar color based on goal status
 */
export function getProgressBarColor(status: GoalStatus, theme: Theme): string {
  switch (status) {
    case 'reached':
      return theme.colors.status.emeraldLight;
    case 'exceeded':
      return theme.colors.status.red400;
    default:
      return theme.colors.text.primary;
  }
}

/**
 * Gets the status label based on goal status
 */
export function getStatusLabel(status: GoalStatus, t: TFunction): string {
  switch (status) {
    case 'reached':
      return t('dailySummaryCard.goalReached');
    case 'exceeded':
      return t('dailySummaryCard.goalExceeded');
    default:
      return '';
  }
}

/**
 * Calculates the progress percentage
 */
export function calculateProgress(consumed: number, goal: number): number {
  return (consumed / goal) * 100;
}

/**
 * Determines if the layout should be narrow for each label type based on language, window width, consume/goal values, and enabled macros count
 * Returns array of booleans for: [protein, carbs, fats, fiber]
 */
export function isNarrowLayout(
  language: string,
  windowWidth: number,
  consumeValues?: { protein?: number; carbs?: number; fats?: number; fiber?: number },
  goalValues?: { protein?: number; carbs?: number; fats?: number; fiber?: number },
  enabledMacrosCount?: number
): boolean[] {
  // Base threshold for narrow layout
  const baseThreshold = 450;

  const multiplier = LANGUAGE_MULTIPLIERS[language] || 1;
  let adjustedThreshold = baseThreshold * multiplier;

  // Adjust threshold based on number of enabled macros
  // When fewer macros are shown (2-3), we have more space, so use less narrow layout
  if (enabledMacrosCount !== undefined) {
    if (enabledMacrosCount <= 2) {
      adjustedThreshold *= 0.6; // 40% less threshold when only 1-2 macros shown
    } else if (enabledMacrosCount === 3) {
      adjustedThreshold *= 0.65; // 35% less threshold when 3 macros shown
    }
  }

  // Adjust threshold based on consume/goal value lengths
  // Larger numbers take more space, so we should use narrow layout sooner
  // But ensure minimum spacing even when values are 0
  if (consumeValues && goalValues) {
    const maxDigitCount = Math.max(
      1, // Ensure minimum digit count for proper spacing even for '0'
      consumeValues.protein ? consumeValues.protein.toString().length : 0,
      goalValues.protein ? goalValues.protein.toString().length : 0,
      consumeValues.carbs ? consumeValues.carbs.toString().length : 0,
      goalValues.carbs ? goalValues.carbs.toString().length : 0,
      consumeValues.fats ? consumeValues.fats.toString().length : 0,
      goalValues.fats ? goalValues.fats.toString().length : 0,
      consumeValues.fiber ? consumeValues.fiber.toString().length : 0,
      goalValues.fiber ? goalValues.fiber.toString().length : 0
    );

    // Only reduce threshold for significantly larger numbers (4+ digits)
    // This ensures adequate spacing for typical values (0-999)
    if (maxDigitCount >= 4) {
      adjustedThreshold *= 0.9; // Less aggressive reduction
    }

    if (maxDigitCount >= 5) {
      adjustedThreshold *= 0.8; // Only for very large numbers (10000+)
    }
  }

  // Calculate narrow status for each label type
  // Protein and fats labels are typically shorter, carbs and fiber can be longer
  const isNarrow = windowWidth < adjustedThreshold;
  const isVeryNarrow = windowWidth < adjustedThreshold * 0.8;

  return [
    isNarrow, // protein
    isNarrow, // carbs
    isVeryNarrow, // fats
    isVeryNarrow, // fiber (shorter threshold since fiber is less critical)
  ];
}

/**
 * Calculates all progress values and statuses for daily summary
 */
export function calculateDailySummaryMetrics(
  calories: {
    consumed: number;
    remaining: number;
    goal: number;
  },
  macros: MacroDailyData | undefined
) {
  const calorieProgress = calculateProgress(calories.consumed, calories.goal);
  const calorieStatus = getGoalStatus(calories.consumed, calories.goal);

  const proteinProgress = macros ? calculateProgress(macros.protein.value, macros.protein.goal) : 0;
  const proteinStatus = macros
    ? getMacroGoalStatus(macros.protein.value, macros.protein.goal)
    : 'not-reached';

  const carbsProgress = macros ? calculateProgress(macros.carbs.value, macros.carbs.goal) : 0;
  const carbsStatus = macros
    ? getMacroGoalStatus(macros.carbs.value, macros.carbs.goal)
    : 'not-reached';

  const fatsProgress = macros ? calculateProgress(macros.fats.value, macros.fats.goal) : 0;
  const fatsStatus = macros
    ? getMacroGoalStatus(macros.fats.value, macros.fats.goal)
    : 'not-reached';

  const fiberProgress = macros ? calculateProgress(macros.fiber.value, macros.fiber.goal) : 0;
  const fiberStatus = macros
    ? getMacroGoalStatus(macros.fiber.value, macros.fiber.goal)
    : 'not-reached';

  return {
    calorieProgress,
    calorieStatus,
    proteinProgress,
    proteinStatus,
    carbsProgress,
    carbsStatus,
    fatsProgress,
    fatsStatus,
    fiberProgress,
    fiberStatus,
  };
}
