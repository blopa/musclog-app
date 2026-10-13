import type { PersonalRecord } from '@/database/services/WorkoutAnalytics';
import { summarizeWeeklyRecords } from '@/utils/weeklyRecords';

const pr = (
  exerciseId: string,
  type: PersonalRecord['type'],
  weight: number,
  reps: number
): PersonalRecord => ({
  exerciseId,
  exerciseName: exerciseId,
  type,
  previousBest: { weight: 0, reps: 0, volume: 0, date: 0 },
  newRecord: { weight, reps, volume: weight * reps },
});

describe('summarizeWeeklyRecords', () => {
  it('collapses a weight and a volume record on the same set into one row', () => {
    expect(
      summarizeWeeklyRecords([pr('bench', 'volume', 80, 6), pr('bench', 'weight', 80, 6)])
    ).toEqual([
      {
        exerciseId: 'bench',
        exerciseName: 'bench',
        types: ['weight', 'volume'],
        best: { weight: 80, reps: 6, volume: 480 },
      },
    ]);
  });

  it('keeps the heaviest set when an exercise set records in two sessions', () => {
    const [row] = summarizeWeeklyRecords([
      pr('bench', 'volume', 75, 8),
      pr('bench', 'weight', 85, 5),
    ]);
    expect(row.best).toEqual({ weight: 85, reps: 5, volume: 425 });
  });

  it('breaks a weight tie on reps', () => {
    const [row] = summarizeWeeklyRecords([pr('row', 'reps', 60, 10), pr('row', 'reps', 60, 12)]);
    expect(row.best.reps).toBe(12);
    expect(row.types).toEqual(['reps']);
  });

  it('keeps exercises in the order they first appear', () => {
    const rows = summarizeWeeklyRecords([
      pr('squat', 'weight', 120, 5),
      pr('bench', 'weight', 80, 5),
      pr('squat', 'volume', 120, 5),
    ]);
    expect(rows.map((row) => row.exerciseId)).toEqual(['squat', 'bench']);
  });
});
