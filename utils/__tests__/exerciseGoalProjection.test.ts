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
        { date: 0, weight: 100, reps: 5, volume: 500, estimated1RM: 115 },
        { date: 7 * dayMs, weight: 102.5, reps: 5, volume: 512.5, estimated1RM: 117.5 },
        { date: 14 * dayMs, weight: 105, reps: 5, volume: 525, estimated1RM: 120 },
      ];
      // Squat-like load multiplier (1.4). 120 / (80 * 1.4) = 1.07 (Early Intermediate)
      const result = projectGoal({
        dataPoints,
        baseline1rm: 115,
        targetWeight: 130,
        bodyWeight,
        loadMultiplier: 1.4
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
        userGender: 'female'
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
});
