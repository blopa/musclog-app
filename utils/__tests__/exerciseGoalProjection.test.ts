import { ProgressiveOverloadDataPoint } from '@/database/services/WorkoutAnalytics';
import {
  estimateConservativeTargetDate,
  projectGoal,
  weightedLinearRegressionSlope,
} from '@/utils/exerciseGoalProjection';

describe('exerciseGoalProjection', () => {
  describe('weightedLinearRegressionSlope', () => {
    it('calculates slope correctly with equal weights', () => {
      // With equal weights (far in future or same date), should match OLS
      const points = [
        { x: 0, y: 100 },
        { x: 1, y: 105 },
        { x: 2, y: 110 },
      ];
      const slope = weightedLinearRegressionSlope(points, 1000000); // effectively infinite half-life
      expect(slope).toBeCloseTo(5);
    });

    it('gives more weight to recent points', () => {
      // Trend: 0 to 10 is slow (+2), 10 to 20 is fast (+8)
      // Linear (OLS) would be 5 kg/week
      // Weighted should be > 5
      const points = [
        { x: 0, y: 100 },
        { x: 10, y: 120 },
        { x: 20, y: 200 },
      ];
      const slope = weightedLinearRegressionSlope(points, 10);
      expect(slope).toBeGreaterThan(5);
    });
  });

  describe('projectGoal', () => {
    const baseline1rm = 100;
    const targetWeight = 120;
    const bodyWeight = 80;

    it('filters out high-rep sets (> 10 reps)', () => {
      const dataPoints: ProgressiveOverloadDataPoint[] = [
        { date: 0, weight: 100, reps: 5, volume: 500, estimated1RM: 115 },
        { date: 7 * 24 * 60 * 60 * 1000, weight: 60, reps: 15, volume: 900, estimated1RM: 90 },
      ];
      const result = projectGoal({ dataPoints, baseline1rm, targetWeight });
      // Should ignore the 15-rep set, so count is 1
      expect(result.dataPointCount).toBe(1);
    });

    it('identifies realistic novice progress (low normalized RS)', () => {
      const dayMs = 24 * 60 * 60 * 1000;
      const dataPoints: ProgressiveOverloadDataPoint[] = [
        { date: 0, weight: 70, reps: 5, volume: 350, estimated1RM: 80 },
        { date: 7 * dayMs, weight: 71, reps: 5, volume: 355, estimated1RM: 81 },
        { date: 14 * dayMs, weight: 72, reps: 5, volume: 360, estimated1RM: 82 },
      ];
      // Squat-like load multiplier (1.4). 82 / (80 * 1.4) = 0.732 (Novice)
      const result = projectGoal({
        dataPoints,
        baseline1rm: 80,
        targetWeight: 100,
        bodyWeight,
        loadMultiplier: 1.4,
      });
      expect(result.status).toBe('on_track');
      expect(result.isRealistic).toBe(true);
    });

    it('applies sex-aware thresholds (Female factor 0.7)', () => {
      const dayMs = 24 * 60 * 60 * 1000;
      // 80kg bench for 60kg Female is Advanced (RS ~1.9)
      const dataPoints: ProgressiveOverloadDataPoint[] = [
        { date: 0, weight: 80, reps: 1, volume: 80, estimated1RM: 80 },
        { date: 7 * dayMs, weight: 81.2, reps: 1, volume: 81.2, estimated1RM: 81.2 },
        { date: 14 * dayMs, weight: 82.4, reps: 1, volume: 82.4, estimated1RM: 82.4 },
      ];
      const result = projectGoal({
        dataPoints,
        baseline1rm: 80,
        targetWeight: 90,
        bodyWeight: 60,
        loadMultiplier: 1.0,
        userGender: 'female',
      });
      // 1.5% weekly gain (1.2kg on 80kg) should be unrealistic for advanced female
      expect(result.isRealistic).toBe(false);
    });

    it('projects longer timelines for tier transitions', () => {
      const dayMs = 24 * 60 * 60 * 1000;
      // 80kg lifter at 75kg 1RM is Novice (RS 0.93)
      // Target 100kg is Intermediate (RS 1.25)
      const bodyWeight = 80;
      const dataPoints: ProgressiveOverloadDataPoint[] = [
        { date: 0, weight: 70, reps: 1, volume: 70, estimated1RM: 70 },
        { date: 7 * dayMs, weight: 72.5, reps: 1, volume: 72.5, estimated1RM: 72.5 },
        { date: 14 * dayMs, weight: 75, reps: 1, volume: 75, estimated1RM: 75 },
      ];
      const result = projectGoal({ dataPoints, baseline1rm: 70, targetWeight: 100, bodyWeight });

      // Simulation should push the date out further than linear division
      expect(result.projectedWeeks).toBeGreaterThan(10);
    });
  });

  describe('estimateConservativeTargetDate', () => {
    it('returns today when target is already reached', () => {
      const date = estimateConservativeTargetDate(100, 100, 80);
      expect(date.getTime()).toBeLessThanOrEqual(Date.now() + 86400000);
    });

    it('returns today when current 1RM is invalid', () => {
      const date = estimateConservativeTargetDate(0, 120, 80);
      expect(date.getTime()).toBeLessThanOrEqual(Date.now() + 86400000);
    });

    it('gives a shorter timeline for novices than intermediates', () => {
      // Novice: 80kg lifter, 50kg 1RM → 70kg target (RS 0.625, cap 1.5%)
      const noviceDate = estimateConservativeTargetDate(50, 70, 80, 1.0, 'male');
      // Intermediate: 80kg lifter, 120kg 1RM → 140kg target (RS 1.5, cap 0.5%)
      const intermediateDate = estimateConservativeTargetDate(120, 140, 80, 1.0, 'male');

      // Novice should be faster because higher cap % outweighs lower baseline
      expect(noviceDate.getTime()).toBeLessThan(intermediateDate.getTime());
    });

    it('caps timeline at 104 weeks (2 years)', () => {
      const date = estimateConservativeTargetDate(200, 300, 80, 1.0, 'male');
      const twoYearsMs = 104 * 7 * 24 * 60 * 60 * 1000;
      expect(date.getTime()).toBeLessThanOrEqual(Date.now() + twoYearsMs + 86400000);
    });

    it('applies gender factor (female gets longer timeline for same absolute weight)', () => {
      const maleDate = estimateConservativeTargetDate(80, 100, 60, 1.0, 'male');
      const femaleDate = estimateConservativeTargetDate(80, 100, 60, 1.0, 'female');
      // Female is treated as more advanced due to 0.7 factor, so timeline should be longer
      expect(femaleDate.getTime()).toBeGreaterThanOrEqual(maleDate.getTime());
    });
  });
});
