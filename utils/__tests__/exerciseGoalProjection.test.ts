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

    it('identifies realistic novice progress', () => {
      const dayMs = 24 * 60 * 60 * 1000;
      const dataPoints: ProgressiveOverloadDataPoint[] = [
        { date: 0, weight: 100, reps: 1, volume: 100, estimated1RM: 100 },
        { date: 7 * dayMs, weight: 101, reps: 1, volume: 101, estimated1RM: 101 },
        { date: 14 * dayMs, weight: 102, reps: 1, volume: 102, estimated1RM: 102 },
      ];
      const result = projectGoal({
        dataPoints,
        baseline1rm,
        targetWeight,
        bodyWeight,
        exerciseType: 'bench'
      });
      expect(result.status).toBe('on_track');
      expect(result.isRealistic).toBe(true);
    });

    it('identifies unrealistic progress for advanced lifters', () => {
      const dayMs = 24 * 60 * 60 * 1000;
      // 150kg bench at 80kg bodyweight is advanced (~1.87x)
      // 1.5% weekly gain is unrealistic
      const dataPoints: ProgressiveOverloadDataPoint[] = [
        { date: 0, weight: 150, reps: 1, volume: 150, estimated1RM: 150 },
        { date: 7 * dayMs, weight: 152.25, reps: 1, volume: 152.25, estimated1RM: 152.25 },
        { date: 14 * dayMs, weight: 154.5, reps: 1, volume: 154.5, estimated1RM: 154.5 },
      ];
      const result = projectGoal({
        dataPoints,
        baseline1rm: 150,
        targetWeight: 170,
        bodyWeight,
        exerciseType: 'bench'
      });
      expect(result.isRealistic).toBe(false);
    });

    it('adjusts stalling threshold for advanced lifters', () => {
      const dayMs = 24 * 60 * 60 * 1000;
      // 160kg bench is elite. 0.05 kg/week (2.6kg/year) should be on_track, not stalling
      const dataPoints: ProgressiveOverloadDataPoint[] = [
        { date: 0, weight: 160, reps: 1, volume: 160, estimated1RM: 160 },
        { date: 7 * dayMs, weight: 160.05, reps: 1, volume: 160.05, estimated1RM: 160.05 },
        { date: 14 * dayMs, weight: 160.1, reps: 1, volume: 160.1, estimated1RM: 160.1 },
      ];
      const result = projectGoal({
        dataPoints,
        baseline1rm: 160,
        targetWeight: 165,
        bodyWeight,
        exerciseType: 'bench'
      });
      expect(result.status).toBe('on_track');
    });
  });
});
