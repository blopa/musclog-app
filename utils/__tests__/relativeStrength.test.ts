import { bestEstimated1RmKg, type StrengthSetInput } from '@/utils/strengthLevel';
import {
  FEMALE_STRENGTH_FACTOR_DEFAULT,
  FEMALE_STRENGTH_FACTOR_LEGS,
  FEMALE_STRENGTH_FACTOR_UPPER,
  MAX_E1RM_REPS,
  normalizedRelativeStrength,
  RS_ADVANCED,
  RS_ELITE,
  RS_INTERMEDIATE,
  RS_NOVICE,
  strengthGenderFactor,
} from '@/utils/relativeStrength';
import { calculateAverage1RM } from '@/utils/workoutCalculator';

describe('relativeStrength', () => {
  describe('tier boundaries', () => {
    it('keeps the product numbers that projection and grading share', () => {
      expect(RS_NOVICE).toBe(0.6);
      expect(RS_INTERMEDIATE).toBe(1.0);
      expect(RS_ADVANCED).toBe(1.5);
      expect(RS_ELITE).toBe(1.8);
      expect(MAX_E1RM_REPS).toBe(10);
    });
  });

  describe('strengthGenderFactor', () => {
    it('is 1 for male and other regardless of muscle group', () => {
      expect(strengthGenderFactor('male', 'legs')).toBe(1);
      expect(strengthGenderFactor('other', 'chest')).toBe(1);
      expect(strengthGenderFactor('male')).toBe(1);
    });

    it('uses the leg factor for leg groups in both vocabularies', () => {
      expect(strengthGenderFactor('female', 'legs')).toBe(FEMALE_STRENGTH_FACTOR_LEGS);
      expect(strengthGenderFactor('female', 'quads')).toBe(FEMALE_STRENGTH_FACTOR_LEGS);
      expect(strengthGenderFactor('female', 'glutes')).toBe(FEMALE_STRENGTH_FACTOR_LEGS);
    });

    it('uses the upper factor for torso and arm groups', () => {
      expect(strengthGenderFactor('female', 'chest')).toBe(FEMALE_STRENGTH_FACTOR_UPPER);
      expect(strengthGenderFactor('female', 'back')).toBe(FEMALE_STRENGTH_FACTOR_UPPER);
      expect(strengthGenderFactor('female', 'biceps')).toBe(FEMALE_STRENGTH_FACTOR_UPPER);
    });

    it('falls back to the previous flat value for core, other and no group', () => {
      expect(strengthGenderFactor('female', 'core')).toBe(FEMALE_STRENGTH_FACTOR_DEFAULT);
      expect(strengthGenderFactor('female', 'abs')).toBe(FEMALE_STRENGTH_FACTOR_DEFAULT);
      expect(strengthGenderFactor('female', 'cardio')).toBe(FEMALE_STRENGTH_FACTOR_DEFAULT);
      expect(strengthGenderFactor('female', null)).toBe(0.7);
      expect(strengthGenderFactor('female')).toBe(0.7);
    });

    it('keeps the evidence ordering: legs above upper body', () => {
      expect(FEMALE_STRENGTH_FACTOR_LEGS).toBeGreaterThan(FEMALE_STRENGTH_FACTOR_DEFAULT);
      expect(FEMALE_STRENGTH_FACTOR_DEFAULT).toBeGreaterThan(FEMALE_STRENGTH_FACTOR_UPPER);
    });
  });

  describe('normalizedRelativeStrength', () => {
    it('divides e1RM by bodyweight times the load benchmark times the factor', () => {
      expect(normalizedRelativeStrength(120, 80, 1.5, 'male')).toBeCloseTo(1);
      expect(normalizedRelativeStrength(120, 80, 1.5, 'female', 'legs')).toBeCloseTo(
        120 / (80 * 1.5 * 0.75)
      );
    });

    it('treats a stored loadMultiplier of 0 as 1 instead of dividing by zero', () => {
      expect(normalizedRelativeStrength(80, 80, 0, 'male')).toBe(1);
      expect(Number.isFinite(normalizedRelativeStrength(80, 80, 0, 'male'))).toBe(true);
    });

    it('is the same number whether a female lift has no group or the default group', () => {
      expect(normalizedRelativeStrength(100, 80, 1, 'female')).toBeCloseTo(
        normalizedRelativeStrength(100, 80, 1, 'female', 'core')
      );
    });
  });

  describe('bestEstimated1RmKg', () => {
    const working = (over: Partial<StrengthSetInput>): StrengthSetInput => ({
      weightKg: 100,
      reps: 5,
      repsInReserve: 0,
      rirRecorded: true,
      isWorkingSet: true,
      ...over,
    });

    it('returns null when there are no qualifying sets', () => {
      expect(bestEstimated1RmKg([])).toBeNull();
      expect(bestEstimated1RmKg([working({ isWorkingSet: false })])).toBeNull();
    });

    it('ignores warm-ups, empty weights and zero reps', () => {
      expect(bestEstimated1RmKg([working({ isWorkingSet: false, weightKg: 200 })])).toBeNull();
      expect(bestEstimated1RmKg([working({ weightKg: 0 })])).toBeNull();
      expect(bestEstimated1RmKg([working({ reps: 0 })])).toBeNull();
    });

    it('counts exactly MAX_E1RM_REPS reps and drops anything above', () => {
      const ten = bestEstimated1RmKg([working({ reps: 10 })]);
      expect(ten).toBe(calculateAverage1RM(100, 10, 0));
      expect(bestEstimated1RmKg([working({ reps: 11 })])).toBeNull();
    });

    it('treats an unrated set as RIR 0', () => {
      const unrated = bestEstimated1RmKg([working({ repsInReserve: 3, rirRecorded: false })]);
      expect(unrated).toBe(calculateAverage1RM(100, 5, 0));
    });

    it('uses the recorded RIR when the set was rated', () => {
      const rated = bestEstimated1RmKg([working({ repsInReserve: 3, rirRecorded: true })]);
      expect(rated).toBe(calculateAverage1RM(100, 5, 3));
    });

    it('returns the highest estimate across sets', () => {
      const best = bestEstimated1RmKg([
        working({ weightKg: 90, reps: 8 }),
        working({ weightKg: 110, reps: 2 }),
        working({ weightKg: 100, reps: 5 }),
      ]);
      expect(best).toBe(
        Math.max(
          calculateAverage1RM(90, 8, 0),
          calculateAverage1RM(110, 2, 0),
          calculateAverage1RM(100, 5, 0)
        )
      );
    });
  });
});
