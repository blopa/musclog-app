import { TFunction } from 'i18next';

import { theme } from '../../../theme';

export type MacroValue = {
  value: number;
  goal: number;
};

export type GoalStatus = 'not-reached' | 'reached' | 'exceeded';

export type MacroDailyData = {
  protein: MacroValue;
  carbs: MacroValue;
  fats: MacroValue;
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
export function getProgressBarColor(status: GoalStatus): string {
  switch (status) {
    case 'reached':
      return '#54f18c'; // Green for reached
    case 'exceeded':
      return '#df6363'; // Orange for exceeded
    default:
      return theme.colors.text.primary; // White for not reached
  }
}

/**
 * Gets the status label based on goal status
 */
export function getStatusLabel(status: GoalStatus, t: TFunction): string {
  switch (status) {
    case 'reached':
      return t('dailySummaryCard.goalReached', 'Goal reached!');
    case 'exceeded':
      return t('dailySummaryCard.goalExceeded', 'Over goal');
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

  return {
    calorieProgress,
    calorieStatus,
    proteinProgress,
    proteinStatus,
    carbsProgress,
    carbsStatus,
    fatsProgress,
    fatsStatus,
  };
}
