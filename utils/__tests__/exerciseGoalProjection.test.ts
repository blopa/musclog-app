import { ProgressiveOverloadDataPoint } from '@/database/services/WorkoutAnalytics';
import { projectGoal, weightedLinearRegressionSlope } from '../exerciseGoalProjection';

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

    it('identifies realistic novice progress (low normalized RS)', () => {
      const dayMs = 24 * 60 * 60 * 1000;
      const dataPoints: ProgressiveOverloadDataPoint[] = [
        { date: 0, weight: 100, reps: 1, volume: 100, estimated1RM: 100 },
        { date: 7 * dayMs, weight: 101, reps: 1, volume: 101, estimated1RM: 101 },
        { date: 14 * dayMs, weight: 102, reps: 1, volume: 102, estimated1RM: 102 },
      ];
      // Squat-like load multiplier (1.2). 100 / (80 * 1.2) = 1.04 (just entering intermediate)
      const result = projectGoal({
        dataPoints,
        baseline1rm,
        targetWeight,
        bodyWeight,
        loadMultiplier: 1.2
      });
      expect(result.status).toBe('on_track');
      expect(result.isRealistic).toBe(true);
    });

    it('identifies unrealistic progress for advanced lifters (high normalized RS)', () => {
      const dayMs = 24 * 60 * 60 * 1000;
      // 120kg bench-like at 60kg bodyweight (loadMult 0.8). 120 / (60 * 0.8) = 2.5 (High Advanced)
      // 1.5% weekly gain is unrealistic
      const dataPoints: ProgressiveOverloadDataPoint[] = [
        { date: 0, weight: 120, reps: 1, volume: 120, estimated1RM: 120 },
        { date: 7 * dayMs, weight: 121.8, reps: 1, volume: 121.8, estimated1RM: 121.8 },
        { date: 14 * dayMs, weight: 123.6, reps: 1, volume: 123.6, estimated1RM: 123.6 },
      ];
      const result = projectGoal({
        dataPoints,
        baseline1rm: 120,
        targetWeight: 140,
        bodyWeight: 60,
        loadMultiplier: 0.8
      });
      expect(result.isRealistic).toBe(false);
    });

    it('adjusts stalling threshold for elite lifters', () => {
      const dayMs = 24 * 60 * 60 * 1000;
      // Very high normalized RS (> 1.5). 0.05 kg/week should be on_track
      const dataPoints: ProgressiveOverloadDataPoint[] = [
        { date: 0, weight: 160, reps: 1, volume: 160, estimated1RM: 160 },
        { date: 7 * dayMs, weight: 160.05, reps: 1, volume: 160.05, estimated1RM: 160.05 },
        { date: 14 * dayMs, weight: 160.1, reps: 1, volume: 160.1, estimated1RM: 160.1 },
      ];
      const result = projectGoal({
        dataPoints,
        baseline1rm: 160,
        targetWeight: 165,
        bodyWeight: 70,
        loadMultiplier: 1.0
      });
      expect(result.status).toBe('on_track');
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

      // Linear would be (100-75)/2.5 = 10 weeks.
      // Non-linear should be > 10 weeks because the rate will drop when entering Intermediate tier (RS > 1.0).
      expect(result.projectedWeeks).toBeGreaterThan(10);
    });
  });
});
