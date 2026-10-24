import { goalCaloriesFromMacros } from '@/utils/carbsConvention';

import { readTargetsDraft, targetsDraftFrom } from '../targetsDraft';

const targets = { totalCalories: 2400, protein: 160, carbs: 260, fats: 75, fiber: 34 };

describe('targetsDraftFrom', () => {
  it('writes the targets in the locale’s own notation', () => {
    expect(targetsDraftFrom({ ...targets, fats: 72.5 }, 'nl-NL').fats).toBe('72,5');
    expect(targetsDraftFrom(targets, 'en-US').totalCalories).toBe('2400');
  });
});

describe('readTargetsDraft', () => {
  const draft = (overrides: Partial<Record<keyof typeof targets, string>> = {}) => ({
    ...targetsDraftFrom(targets, 'en-US'),
    ...overrides,
  });

  it('reads an untouched recommendation back exactly, without flagging it', () => {
    // The app's own recommendation is within 5% of its macro total (fiber is set on top).
    const reading = readTargetsDraft(draft(), 'en-US');
    expect(reading.targets).toEqual(targets);
    expect(reading.invalid).toEqual([]);
    expect(reading.macroCalories).toBe(Math.round(goalCaloriesFromMacros(targets)));
    expect(reading.mismatch).toBe(false);
  });

  it('refuses an emptied or unreadable field instead of saving it as 0', () => {
    const reading = readTargetsDraft(draft({ protein: '', carbs: 'abc' }), 'en-US');
    expect(reading.targets).toBeNull();
    expect(reading.invalid).toEqual(['protein', 'carbs']);
    expect(reading.macroCalories).toBeNull();
  });

  it('refuses a calorie target of zero but allows zero of a macro', () => {
    expect(readTargetsDraft(draft({ totalCalories: '0' }), 'en-US').invalid).toEqual([
      'totalCalories',
    ]);
    expect(readTargetsDraft(draft({ fiber: '0' }), 'en-US').invalid).toEqual([]);
  });

  it('flags calories and macros that describe different days', () => {
    const reading = readTargetsDraft(draft({ protein: '300' }), 'en-US');
    expect(reading.targets).not.toBeNull();
    expect(reading.mismatch).toBe(true);
    expect(reading.macroCalories).toBe(160 * 0 + 300 * 4 + 260 * 4 + 75 * 9 + 34 * 2);
  });

  it('does not read the other separator as grouping', () => {
    // The lenient parser would read "2.400" as 2,4 kcal in Dutch.
    expect(readTargetsDraft(draft({ totalCalories: '2.400' }), 'nl-NL').invalid).toContain(
      'totalCalories'
    );
  });
});

describe('goalCaloriesFromMacros', () => {
  it('counts net carbs at 4 and fiber, separately, at 2 kcal/g', () => {
    expect(goalCaloriesFromMacros({ protein: 100, carbs: 100, fats: 10, fiber: 10 })).toBe(
      400 + 400 + 90 + 20
    );
  });
});
