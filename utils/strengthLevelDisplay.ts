import type { Units } from '@/constants/settings';
import { STRENGTH_LEVELS, type StrengthGrade, type StrengthLevel } from '@/utils/strengthLevel';
import { kgToDisplay } from '@/utils/unitConversion';

/** The smallest step a person can load in each unit system. Matches `roundToLoadable`'s tidy-up. */
const DISPLAY_STEP: Record<Units, number> = { metric: 0.5, imperial: 1 };

/**
 * The lift a person needs for the next level, shown in their unit. Rounded UP to the input step,
 * so the number shown is never below the real threshold (a rounded-down "80 kg" would promise a
 * level that 80 kg does not reach). The tolerance absorbs float error on an exact step.
 */
export function nextLevelDisplay(kg: number, units: Units): number {
  const step = DISPLAY_STEP[units];
  const inUnits = kgToDisplay(kg, units);
  return Math.ceil(inUnits / step - 1e-9) * step;
}

export type StrengthLevelWording =
  | { kind: 'single'; level: StrengthLevel }
  | { kind: 'range'; lower: StrengthLevel; upper: StrengthLevel };

/**
 * What to call a grade. An `other` grade has two readings (male and female scales); they are
 * ordered lowest first so the range always reads "lower to upper", whichever scale is higher.
 */
export function strengthLevelWording(grade: StrengthGrade): StrengthLevelWording {
  if (grade.upperLevel === null) {
    return { kind: 'single', level: grade.level };
  }

  const first = STRENGTH_LEVELS.indexOf(grade.level);
  const second = STRENGTH_LEVELS.indexOf(grade.upperLevel);
  return first <= second
    ? { kind: 'range', lower: grade.level, upper: grade.upperLevel }
    : { kind: 'range', lower: grade.upperLevel, upper: grade.level };
}

/** Position on the five-step scale, 0 for beginner to 4 for elite. */
export function strengthLevelIndex(level: StrengthLevel): number {
  return STRENGTH_LEVELS.indexOf(level);
}
