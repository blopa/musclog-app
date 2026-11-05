import { ProgressiveOverloadDataPoint } from '@/database/services/WorkoutAnalytics';
import { getRealisticWeeklyRateCapPercent, projectGoal } from '@/utils/exerciseGoalProjection';
import {
  gradeStrength,
  STRENGTH_LEVEL_WINDOW_DAYS,
  type StrengthGradeInput,
} from '@/utils/strengthLevel';
import { RS_ADVANCED, RS_ELITE, RS_INTERMEDIATE, RS_NOVICE } from '@/utils/relativeStrength';

const base = (over: Partial<StrengthGradeInput>): StrengthGradeInput => ({
  estimated1RmKg: 100,
  bodyWeightKg: 100,
  loadMultiplier: 1,
  gender: 'male',
  muscleGroup: 'chest',
  ...over,
});

// Male, factor 1, bodyweight 100, benchmark 1: normalized strength equals e1RM / 100.
const atRs = (rs: number, over: Partial<StrengthGradeInput> = {}) =>
  gradeStrength(base({ estimated1RmKg: rs * 100, ...over }));

describe('gradeStrength', () => {
  it('exposes the 180-day strength window', () => {
    expect(STRENGTH_LEVEL_WINDOW_DAYS).toBe(180);
  });

  describe('male and boundaries', () => {
    it('grades below novice as beginner', () => {
      expect(atRs(RS_NOVICE - 0.01)?.level).toBe('beginner');
    });

    it('treats each boundary value as the higher level', () => {
      expect(atRs(RS_NOVICE)?.level).toBe('novice');
      expect(atRs(RS_INTERMEDIATE)?.level).toBe('intermediate');
      expect(atRs(RS_ADVANCED)?.level).toBe('advanced');
      expect(atRs(RS_ELITE)?.level).toBe('elite');
    });

    it('keeps the value just below each boundary in the lower level', () => {
      expect(atRs(RS_INTERMEDIATE - 0.01)?.level).toBe('novice');
      expect(atRs(RS_ADVANCED - 0.01)?.level).toBe('intermediate');
      expect(atRs(RS_ELITE - 0.01)?.level).toBe('advanced');
    });

    it('reports the normalized strength it graded', () => {
      expect(atRs(1.2)?.normalizedStrength).toBeCloseTo(1.2);
    });

    it('has no upperLevel for male or female lifts', () => {
      expect(atRs(1.2)?.upperLevel).toBeNull();
      expect(atRs(1.2, { gender: 'female' })?.upperLevel).toBeNull();
    });
  });

  describe('next level', () => {
    it('names the next level and the e1RM needed for it', () => {
      const grade = atRs(1.2);
      expect(grade?.nextLevel).toBe('advanced');
      expect(grade?.nextLevelKg).toBeCloseTo(RS_ADVANCED * 100);
    });

    it('starts beginners toward novice', () => {
      const grade = atRs(0.2);
      expect(grade?.nextLevel).toBe('novice');
      expect(grade?.nextLevelKg).toBeCloseTo(RS_NOVICE * 100);
    });

    it('has no next level at elite', () => {
      const grade = atRs(2.5);
      expect(grade?.level).toBe('elite');
      expect(grade?.nextLevel).toBeNull();
      expect(grade?.nextLevelKg).toBeNull();
    });

    it('scales nextLevelKg with bodyweight, benchmark and female factor', () => {
      const grade = gradeStrength(
        base({
          gender: 'female',
          muscleGroup: 'legs',
          bodyWeightKg: 60,
          loadMultiplier: 1.4,
          estimated1RmKg: 50,
        })
      );
      expect(grade?.nextLevelKg).toBeCloseTo(RS_INTERMEDIATE * 60 * 1.4 * 0.75);
    });

    it('round-trips: grading exactly nextLevelKg reaches nextLevel', () => {
      const inputs: Partial<StrengthGradeInput>[] = [
        { estimated1RmKg: 60 },
        {
          estimated1RmKg: 120,
          gender: 'female',
          muscleGroup: 'legs',
          loadMultiplier: 1.4,
          bodyWeightKg: 65,
        },
        {
          estimated1RmKg: 40,
          gender: 'female',
          muscleGroup: 'chest',
          loadMultiplier: 0.42,
          bodyWeightKg: 70,
        },
        { estimated1RmKg: 200, loadMultiplier: 1.8, bodyWeightKg: 85 },
      ];
      for (const over of inputs) {
        const grade = gradeStrength(base(over));
        expect(grade).not.toBeNull();
        if (!grade || !grade.nextLevel || grade.nextLevelKg === null) {
          continue;
        }
        const reached = gradeStrength(base({ ...over, estimated1RmKg: grade.nextLevelKg }));
        expect(reached?.level).toBe(grade.nextLevel);
      }
    });
  });

  describe('female', () => {
    it('grades a female leg lift with the leg factor', () => {
      // 1.2 × 100 × 1 × 0.75 reference: the lifter reaches normalized 1.6 on legs,
      // but only 1.2 / 0.7 on the flat default.
      const legs = gradeStrength(
        base({ gender: 'female', muscleGroup: 'legs', estimated1RmKg: 120 })
      );
      const flat = gradeStrength(
        base({ gender: 'female', muscleGroup: null, estimated1RmKg: 120 })
      );
      expect(legs?.normalizedStrength).toBeCloseTo(120 / 75);
      expect(flat?.normalizedStrength).toBeCloseTo(120 / 70);
      expect(legs?.level).toBe('advanced');
      expect(flat?.level).toBe('advanced');
    });

    it('grades a female upper-body lift on the lower upper factor', () => {
      const grade = gradeStrength(
        base({ gender: 'female', muscleGroup: 'chest', estimated1RmKg: 60 })
      );
      expect(grade?.normalizedStrength).toBeCloseTo(1);
      expect(grade?.level).toBe('intermediate');
    });
  });

  describe('other', () => {
    it('grades on the male scale and reports the female scale when they differ', () => {
      // Male scale: 0.9 (novice). Female chest scale: 0.9 / 0.6 = 1.5 (advanced).
      const grade = gradeStrength(
        base({ gender: 'other', muscleGroup: 'chest', estimated1RmKg: 90 })
      );
      expect(grade?.level).toBe('novice');
      expect(grade?.upperLevel).toBe('advanced');
      expect(grade?.nextLevel).toBeNull();
      expect(grade?.nextLevelKg).toBeNull();
    });

    it('returns null upperLevel when both scales grade the same', () => {
      // Male scale 0.3 and female chest scale 0.5 are both beginner.
      const grade = gradeStrength(
        base({ gender: 'other', muscleGroup: 'chest', estimated1RmKg: 30 })
      );
      expect(grade?.level).toBe('beginner');
      expect(grade?.upperLevel).toBeNull();
    });

    it('reports null upperLevel when both scales reach elite', () => {
      // Male 2.0 and female legs 2.0 / 0.75 = 2.7 are both elite.
      const grade = gradeStrength(
        base({ gender: 'other', muscleGroup: 'legs', estimated1RmKg: 300 })
      );
      expect(grade?.level).toBe('elite');
      expect(grade?.upperLevel).toBeNull();
    });
  });

  describe('ungradeable inputs', () => {
    it('returns null without a weigh-in', () => {
      expect(gradeStrength(base({ bodyWeightKg: null }))).toBeNull();
      expect(gradeStrength(base({ bodyWeightKg: 0 }))).toBeNull();
      expect(gradeStrength(base({ bodyWeightKg: -5 }))).toBeNull();
    });

    it('returns null for bodyweight and cardio (loadMultiplier 0)', () => {
      expect(gradeStrength(base({ loadMultiplier: 0 }))).toBeNull();
    });

    it('returns null for a missing or non-finite estimate', () => {
      expect(gradeStrength(base({ estimated1RmKg: 0 }))).toBeNull();
      expect(gradeStrength(base({ estimated1RmKg: -10 }))).toBeNull();
      expect(gradeStrength(base({ estimated1RmKg: Number.NaN }))).toBeNull();
      expect(gradeStrength(base({ estimated1RmKg: Number.POSITIVE_INFINITY }))).toBeNull();
    });
  });

  describe('consistency with goal projection', () => {
    const dayMs = 24 * 60 * 60 * 1000;

    /** A three-point series rising exactly `slopeKgPerWeek`, so the regression returns that slope. */
    const risingSeries = (endKg: number, slopeKgPerWeek: number): ProgressiveOverloadDataPoint[] =>
      [0, 1, 2].map((week) => ({
        date: week * 7 * dayMs,
        weight: 0,
        reps: 5,
        volume: 0,
        estimated1RM: endKg - slopeKgPerWeek * (2 - week),
      }));

    it('treats a lifter as advanced in projection exactly when the grade is advanced or above', () => {
      // A 0.07 kg/week slope is above the advanced stalling line (0.05) and below the novice one (0.1).
      // It reads on_track only when projection tiers the lifter as advanced.
      const samples = [0.4, 0.8, 1.2, 1.45, 1.5, 1.55, 1.7, 1.9, 2.2];
      for (const rs of samples) {
        const e1rm = rs * 100;
        const projection = projectGoal({
          dataPoints: risingSeries(e1rm, 0.07),
          baseline1rm: e1rm - 0.14,
          targetWeight: e1rm * 2,
          bodyWeight: 100,
          loadMultiplier: 1,
          userGender: 'male',
        });
        const grade = gradeStrength(base({ estimated1RmKg: e1rm }));
        const projectionAdvanced = projection.status === 'on_track';
        const gradeAdvanced = grade?.level === 'advanced' || grade?.level === 'elite';
        expect({ rs, projectionAdvanced }).toEqual({ rs, projectionAdvanced: gradeAdvanced });
      }
    });

    it('caps weekly progression on the same tier boundaries as the grade', () => {
      const expectedCap: Record<string, number> = {
        beginner: 1.5,
        novice: 1.5,
        intermediate: 0.5,
        advanced: 0.5,
        elite: 0.15,
      };
      const samples = [0.3, 0.8, 1.2, 1.7, 1.9, 2.4];
      for (const rs of samples) {
        const grade = gradeStrength(base({ estimated1RmKg: rs * 100 }));
        expect(getRealisticWeeklyRateCapPercent(rs)).toBe(expectedCap[grade?.level ?? 'beginner']);
      }
    });
  });
});
