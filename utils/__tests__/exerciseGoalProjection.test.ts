import { ProgressiveOverloadDataPoint } from '@/database/services/WorkoutAnalytics';
import { linearRegressionSlope, projectGoal } from '../exerciseGoalProjection';

describe('exerciseGoalProjection', () => {
  describe('linearRegressionSlope', () => {
    it('calculates positive slope correctly', () => {
      const points = [
        { x: 0, y: 100 },
        { x: 1, y: 105 },
        { x: 2, y: 110 },
      ];
      expect(linearRegressionSlope(points)).toBe(5);
    });

    it('calculates negative slope correctly', () => {
      const points = [
        { x: 0, y: 100 },
        { x: 1, y: 95 },
        { x: 2, y: 90 },
      ];
      expect(linearRegressionSlope(points)).toBe(-5);
    });

    it('returns 0 for flat slope', () => {
      const points = [
        { x: 0, y: 100 },
        { x: 1, y: 100 },
        { x: 2, y: 100 },
      ];
      expect(linearRegressionSlope(points)).toBe(0);
    });

    it('returns 0 for single point', () => {
      const points = [{ x: 0, y: 100 }];
      expect(linearRegressionSlope(points)).toBe(0);
    });
  });

  describe('projectGoal', () => {
    const baseline1rm = 100;
    const targetWeight = 120;

    it('returns achieved when current >= target', () => {
      const dataPoints: ProgressiveOverloadDataPoint[] = [
        { date: 0, weight: 120, reps: 1, volume: 120, estimated1RM: 120 },
      ];
      const result = projectGoal({ dataPoints, baseline1rm, targetWeight });
      expect(result.status).toBe('achieved');
      expect(result.progressPercent).toBe(100);
    });

    it('returns no_history when dataPoints is empty', () => {
      const dataPoints: ProgressiveOverloadDataPoint[] = [];
      const result = projectGoal({ dataPoints, baseline1rm, targetWeight });
      expect(result.status).toBe('no_history');
      expect(result.progressPercent).toBe(0);
    });

    it('returns insufficient_data when < 3 points', () => {
      const dataPoints: ProgressiveOverloadDataPoint[] = [
        { date: 0, weight: 100, reps: 1, volume: 100, estimated1RM: 100 },
        { date: 7 * 24 * 60 * 60 * 1000, weight: 105, reps: 1, volume: 105, estimated1RM: 105 },
      ];
      const result = projectGoal({ dataPoints, baseline1rm, targetWeight });
      expect(result.status).toBe('insufficient_data');
      expect(result.progressPercent).toBe(25); // (105-100)/(120-100) = 5/20 = 25%
    });

    it('calculates projection correctly', () => {
      const dayMs = 24 * 60 * 60 * 1000;
      const dataPoints: ProgressiveOverloadDataPoint[] = [
        { date: 0, weight: 100, reps: 1, volume: 100, estimated1RM: 100 },
        { date: 7 * dayMs, weight: 105, reps: 1, volume: 105, estimated1RM: 105 },
        { date: 14 * dayMs, weight: 110, reps: 1, volume: 110, estimated1RM: 110 },
      ];
      const result = projectGoal({ dataPoints, baseline1rm, targetWeight });
      expect(result.status).toBe('on_track');
      expect(result.weeklyProgressionRate).toBe(5);
      expect(result.projectedWeeks).toBe(2); // (120 - 110) / 5 = 2
      expect(result.progressPercent).toBe(50); // (110 - 100) / 20 = 50%
    });

    it('returns stalling when rate is near zero', () => {
      const dayMs = 24 * 60 * 60 * 1000;
      const dataPoints: ProgressiveOverloadDataPoint[] = [
        { date: 0, weight: 100, reps: 1, volume: 100, estimated1RM: 100 },
        { date: 7 * dayMs, weight: 100, reps: 1, volume: 100, estimated1RM: 100 },
        { date: 14 * dayMs, weight: 100, reps: 1, volume: 100, estimated1RM: 100 },
      ];
      const result = projectGoal({ dataPoints, baseline1rm, targetWeight });
      expect(result.status).toBe('stalling');
      expect(result.projectedWeeks).toBeNull();
    });
  });
});
