import type { TFunction } from 'i18next';

import {
  calculateDailySummaryMetrics,
  calculateProgress,
  getGoalStatus,
  getMacroGoalStatus,
  getProgressBarColor,
  getSummaryCardBackgroundVariant,
  getStatusLabel,
  isNarrowLayout,
  type MacroDailyData,
} from '@/components/cards/DailySummaryCard/utils';
import { LANGUAGE_MULTIPLIERS } from '@/lang/lang';
import type { Theme } from '@/theme';

const theme = {
  colors: {
    status: { emeraldLight: '#emerald', red400: '#red' },
    text: { onColorful: '#on-colorful', primary: '#text' },
    colorfulCard: { ink: '#card-ink' },
  },
} as unknown as Theme;

const t = ((key: string) => key) as unknown as TFunction;

const macro = (value: number, goal: number) => ({ value, goal });

const macros = (
  overrides: Partial<Record<keyof MacroDailyData, { value: number; goal: number }>> = {}
): MacroDailyData => ({
  protein: macro(0, 100),
  carbs: macro(0, 200),
  fats: macro(0, 60),
  fiber: macro(0, 30),
  ...overrides,
});

describe('getSummaryCardBackgroundVariant', () => {
  it('uses the standard card surface in light mode', () => {
    expect(getSummaryCardBackgroundVariant('light')).toBe('default');
  });

  it('keeps the colorful gradient in dark mode', () => {
    expect(getSummaryCardBackgroundVariant('dark')).toBe('colorful-gradient');
  });
});

describe('calculateProgress', () => {
  it('shows 100 percent when goal and consumption are both zero', () => {
    expect(calculateProgress(0, 0)).toBe(100);
  });

  it('shows infinity when goal is zero and consumption is positive', () => {
    expect(calculateProgress(10, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('treats a negative consumption against a zero goal as complete, not infinite', () => {
    expect(calculateProgress(-5, 0)).toBe(100);
  });

  it('returns the consumed share of the goal as a percentage', () => {
    expect(calculateProgress(50, 200)).toBe(25);
    expect(calculateProgress(200, 200)).toBe(100);
  });

  it('goes past 100 rather than clamping, so the bar can show an overshoot', () => {
    expect(calculateProgress(300, 200)).toBe(150);
  });
});

describe('getGoalStatus', () => {
  it('reports not-reached below the goal', () => {
    expect(getGoalStatus(99, 100)).toBe('not-reached');
  });

  it('reports reached only on an exact hit', () => {
    expect(getGoalStatus(100, 100)).toBe('reached');
  });

  it('reports exceeded above the goal', () => {
    expect(getGoalStatus(101, 100)).toBe('exceeded');
  });

  it('treats a zero goal with zero consumed as reached', () => {
    expect(getGoalStatus(0, 0)).toBe('reached');
  });
});

describe('getMacroGoalStatus', () => {
  it('matches getGoalStatus once a value exists', () => {
    expect(getMacroGoalStatus(99, 100)).toBe('not-reached');
    expect(getMacroGoalStatus(100, 100)).toBe('reached');
    expect(getMacroGoalStatus(101, 100)).toBe('exceeded');
  });

  it('treats a missing value as not-reached rather than as zero-vs-zero "reached"', () => {
    // A macro the user has not logged yet must not render as a met goal.
    expect(getMacroGoalStatus(undefined, 0)).toBe('not-reached');
    expect(getMacroGoalStatus(undefined, 100)).toBe('not-reached');
  });
});

describe('getProgressBarColor', () => {
  it('greens a met goal and reds an exceeded one', () => {
    expect(getProgressBarColor('reached', theme)).toBe('#emerald');
    expect(getProgressBarColor('exceeded', theme)).toBe('#red');
  });

  it('uses theme-aware card ink while the goal is still open', () => {
    expect(getProgressBarColor('not-reached', theme)).toBe('#card-ink');
  });
});

describe('getStatusLabel', () => {
  it('labels the two terminal states', () => {
    expect(getStatusLabel('reached', t)).toBe('dailySummaryCard.goalReached');
    expect(getStatusLabel('exceeded', t)).toBe('dailySummaryCard.goalExceeded');
  });

  it('stays silent while the goal is still open — no "0% done" noise', () => {
    expect(getStatusLabel('not-reached', t)).toBe('');
  });
});

describe('isNarrowLayout', () => {
  it('uses the wide layout on a roomy screen', () => {
    expect(isNarrowLayout('en-US', 800)).toEqual([false, false, false, false]);
  });

  it('uses the narrow layout for every column on a very small screen', () => {
    // 300 is under both the 450 base threshold and the 360 "very narrow" one.
    expect(isNarrowLayout('en-US', 300)).toEqual([true, true, true, true]);
  });

  it('applies a lower "very narrow" bar to fats and fiber only', () => {
    // 400 < 450 (narrow) but 400 >= 360 (0.8 * 450), so only protein/carbs flip.
    expect(isNarrowLayout('en-US', 380)).toEqual([true, true, false, false]);
  });

  it('goes narrow sooner for languages with longer words', () => {
    // es-ES multiplies the threshold by 1.25, so 500px is narrow in Spanish but not English.
    expect(LANGUAGE_MULTIPLIERS['es-ES']).toBeGreaterThan(1);
    expect(isNarrowLayout('en-US', 500)[0]).toBe(false);
    expect(isNarrowLayout('es-ES', 500)[0]).toBe(true);
  });

  it('treats an unknown language as multiplier 1 instead of collapsing the threshold', () => {
    expect(isNarrowLayout('xx-XX', 500)).toEqual(isNarrowLayout('en-US', 500));
  });

  it('goes wider for a language with shorter words', () => {
    expect(LANGUAGE_MULTIPLIERS['ru-RU']).toBeLessThan(1);
    expect(isNarrowLayout('ru-RU', 430)[0]).toBe(false);
    expect(isNarrowLayout('en-US', 430)[0]).toBe(true);
  });

  it('relaxes the threshold when fewer macros share the row', () => {
    // 300px is narrow with 4 macros, but 2 macros get 60% of the threshold (270px).
    expect(isNarrowLayout('en-US', 300, undefined, undefined, 4)[0]).toBe(true);
    expect(isNarrowLayout('en-US', 300, undefined, undefined, 2)[0]).toBe(false);
    expect(isNarrowLayout('en-US', 300, undefined, undefined, 3)[0]).toBe(false);
  });

  it('short-labels every column when all four macros are shown', () => {
    // With 4 columns of ~80px, fats/fiber must not keep the roomier long labels.
    expect(isNarrowLayout('en-US', 380, undefined, undefined, 4)).toEqual([true, true, true, true]);
  });

  it('tightens the threshold once a value reaches four digits', () => {
    const small = { protein: 100, carbs: 200, fats: 60, fiber: 30 };
    const large = { protein: 100, carbs: 2000, fats: 60, fiber: 30 };

    // 430px sits between 450*0.9 (405) and 450, so only the 4-digit case stays wide.
    expect(isNarrowLayout('en-US', 430, small, small)[0]).toBe(true);
    expect(isNarrowLayout('en-US', 430, large, large)[0]).toBe(false);
  });

  it('tightens it further at five digits', () => {
    const fourDigit = { protein: 1000, carbs: 1000, fats: 1000, fiber: 1000 };
    const fiveDigit = { protein: 10000, carbs: 10000, fats: 10000, fiber: 10000 };

    // 450*0.9 = 405; 450*0.9*0.8 = 324.
    expect(isNarrowLayout('en-US', 380, fourDigit, fourDigit)[0]).toBe(true);
    expect(isNarrowLayout('en-US', 380, fiveDigit, fiveDigit)[0]).toBe(false);
  });

  it('ignores the digit adjustment unless both consumed and goal values are supplied', () => {
    const large = { protein: 10000, carbs: 10000, fats: 10000, fiber: 10000 };

    expect(isNarrowLayout('en-US', 430, large, undefined)).toEqual(isNarrowLayout('en-US', 430));
    expect(isNarrowLayout('en-US', 430, undefined, large)).toEqual(isNarrowLayout('en-US', 430));
  });
});

describe('calculateDailySummaryMetrics', () => {
  const calories = { consumed: 1500, remaining: 500, goal: 2000 };

  it('derives progress and status for calories and every macro', () => {
    const result = calculateDailySummaryMetrics(
      calories,
      macros({
        protein: macro(100, 100),
        carbs: macro(250, 200),
        fats: macro(30, 60),
        fiber: macro(0, 30),
      })
    );

    expect(result).toEqual({
      calorieProgress: 75,
      calorieStatus: 'not-reached',
      proteinProgress: 100,
      proteinStatus: 'reached',
      carbsProgress: 125,
      carbsStatus: 'exceeded',
      fatsProgress: 50,
      fatsStatus: 'not-reached',
      fiberProgress: 0,
      fiberStatus: 'not-reached',
    });
  });

  it('zeroes every macro when no macro goals exist, without touching the calorie ring', () => {
    const result = calculateDailySummaryMetrics(calories, undefined);

    expect(result.calorieProgress).toBe(75);
    expect(result.calorieStatus).toBe('not-reached');
    expect(result.proteinProgress).toBe(0);
    expect(result.carbsProgress).toBe(0);
    expect(result.fatsProgress).toBe(0);
    expect(result.fiberProgress).toBe(0);
    expect(result.proteinStatus).toBe('not-reached');
    expect(result.carbsStatus).toBe('not-reached');
    expect(result.fatsStatus).toBe('not-reached');
    expect(result.fiberStatus).toBe('not-reached');
  });

  it('propagates the zero-goal infinity so an unset calorie goal is visibly wrong', () => {
    const result = calculateDailySummaryMetrics(
      { consumed: 1500, remaining: 0, goal: 0 },
      undefined
    );

    expect(result.calorieProgress).toBe(Number.POSITIVE_INFINITY);
    expect(result.calorieStatus).toBe('exceeded');
  });
});
