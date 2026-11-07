import { nextLevelDisplay, strengthLevelWording } from '@/utils/strengthLevelDisplay';
import type { StrengthGrade } from '@/utils/strengthLevel';

const grade = (overrides: Partial<StrengthGrade>): StrengthGrade => ({
  level: 'intermediate',
  upperLevel: null,
  normalizedStrength: 1.1,
  nextLevel: 'advanced',
  nextLevelKg: 100,
  ...overrides,
});

describe('nextLevelDisplay', () => {
  it('shows metric weights to the half kilogram, rounded up', () => {
    expect(nextLevelDisplay(100, 'metric')).toBe(100);
    expect(nextLevelDisplay(100.2, 'metric')).toBe(100.5);
    expect(nextLevelDisplay(99.9, 'metric')).toBe(100);
  });

  it('converts to pounds and shows whole pounds, rounded up', () => {
    // 100 kg is 220.46 lb: the next whole pound up is 221, never a figure below the threshold.
    expect(nextLevelDisplay(100, 'imperial')).toBe(221);
  });

  it('keeps an exact step exact despite float error', () => {
    // A threshold a hair above an exact step still reads as that step.
    expect(nextLevelDisplay(80.00000000001, 'metric')).toBe(80);
  });

  it('never shows less than the real threshold in pounds', () => {
    for (const kg of [45.3, 61.7, 99.99, 143.2]) {
      const shown = nextLevelDisplay(kg, 'imperial');
      expect(shown).toBeGreaterThanOrEqual(kg * 2.2046226218 - 1e-6);
    }
  });
});

describe('strengthLevelWording', () => {
  it('names a single level for a male or female grade', () => {
    expect(strengthLevelWording(grade({}))).toEqual({ kind: 'single', level: 'intermediate' });
  });

  it('reads an other grade as a range, lowest level first', () => {
    expect(
      strengthLevelWording(
        grade({ level: 'intermediate', upperLevel: 'advanced', nextLevel: null, nextLevelKg: null })
      )
    ).toEqual({ kind: 'range', lower: 'intermediate', upper: 'advanced' });
  });

  it('still orders the range when the female scale is the lower one', () => {
    expect(
      strengthLevelWording(
        grade({ level: 'advanced', upperLevel: 'novice', nextLevel: null, nextLevelKg: null })
      )
    ).toEqual({ kind: 'range', lower: 'novice', upper: 'advanced' });
  });
});
