import {
  consistencyStatus,
  consistencySuggestion,
  goalVerdicts,
  lighterSetCount,
  oneRmStatus,
  recommendTrainingWeek,
  type TrainingEvidence,
} from '@/utils/weeklyTrainingRecommendation';

const base: TrainingEvidence = {
  workoutsThisWeek: 3,
  everWorkout: true,
  deloadedExercises: 0,
  ratedSets: 0,
  averageRir: null,
  goals: [],
  decidedWeeksSinceLighter: 0,
};

describe('lighterSetCount', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [4, 3],
    [5, 3],
    [6, 4],
  ])('%i working sets → %i', (sets, expected) => {
    expect(lighterSetCount(sets)).toBe(expected);
  });
});

describe('oneRmStatus', () => {
  const date = (iso: string) => new Date(iso);
  it('reads a projection past the target date as behind', () => {
    expect(
      oneRmStatus({ status: 'on_track', projectedDate: date('2027-06-01') }, '2027-01-01')
    ).toBe('behind');
  });
  it('keeps an on-track lift on pace when it lands before the date or there is none', () => {
    expect(
      oneRmStatus({ status: 'on_track', projectedDate: date('2026-12-01') }, '2027-01-01')
    ).toBe('onPace');
    expect(oneRmStatus({ status: 'on_track', projectedDate: date('2030-01-01') }, null)).toBe(
      'onPace'
    );
  });
  it('maps the remaining projection states', () => {
    expect(oneRmStatus({ status: 'achieved', projectedDate: null })).toBe('reached');
    expect(oneRmStatus({ status: 'ready_to_achieve', projectedDate: null })).toBe('reached');
    expect(oneRmStatus({ status: 'stalling', projectedDate: null })).toBe('stalling');
    expect(oneRmStatus({ status: 'declining', projectedDate: null })).toBe('declining');
    expect(oneRmStatus({ status: 'no_history', projectedDate: null })).toBe('notEnoughData');
    expect(oneRmStatus({ status: 'insufficient_data', projectedDate: null })).toBe('notEnoughData');
  });
});

describe('goalVerdicts', () => {
  it('builds a consistency verdict and a 1RM verdict, tolerating a missing projection', () => {
    const verdicts = goalVerdicts({
      workoutsThisWeek: 5,
      consistency: { goalId: 'c', target: 4 },
      oneRm: [{ goalId: 'o', exerciseId: 'e', exerciseName: 'Squat', projection: null }],
    });
    expect(verdicts).toEqual([
      { kind: 'consistency', goalId: 'c', target: 4, done: 5, status: 'exceeded' },
      {
        kind: '1rm',
        goalId: 'o',
        exerciseId: 'e',
        exerciseName: 'Squat',
        status: 'notEnoughData',
        projectedDate: null,
      },
    ]);
  });
  it('reports met / missed at the boundary', () => {
    expect(consistencyStatus(4, 4)).toBe('met');
    expect(consistencyStatus(3, 4)).toBe('missed');
  });
});

describe('recommendTrainingWeek', () => {
  it('progresses by default', () => {
    expect(recommendTrainingWeek(base)).toEqual({
      decision: 'progress',
      reasons: [{ code: 'onTrack' }],
    });
  });

  it('recommends a lighter week after several automatic deloads', () => {
    const result = recommendTrainingWeek({ ...base, deloadedExercises: 2 });
    expect(result.decision).toBe('lighter');
    expect(result.reasons).toContainEqual({ code: 'repeatedDeloads', count: 2 });
  });

  it('needs grinding AND a going-nowhere lift, with enough rated sets', () => {
    const stalled = [
      {
        kind: '1rm' as const,
        goalId: 'o',
        exerciseId: 'e',
        exerciseName: 'Bench',
        status: 'stalling' as const,
        projectedDate: null,
      },
    ];
    const grinding = { ...base, ratedSets: 8, averageRir: 0.2 };
    expect(recommendTrainingWeek({ ...grinding, goals: stalled }).decision).toBe('lighter');
    expect(recommendTrainingWeek({ ...grinding, goals: [] }).decision).toBe('progress');
    expect(recommendTrainingWeek({ ...grinding, ratedSets: 3, goals: stalled }).decision).toBe(
      'progress'
    );
    expect(recommendTrainingWeek({ ...grinding, averageRir: 2, goals: stalled }).decision).toBe(
      'progress'
    );
  });

  it('suggests a lighter week once the interval has passed', () => {
    expect(recommendTrainingWeek({ ...base, decidedWeeksSinceLighter: 5 }).decision).toBe(
      'progress'
    );
    expect(recommendTrainingWeek({ ...base, decidedWeeksSinceLighter: 6 }).decision).toBe(
      'lighter'
    );
  });

  it('repeats after a week with no workouts, but not for a user who never trained', () => {
    expect(recommendTrainingWeek({ ...base, workoutsThisWeek: 0 }).decision).toBe('repeat');
    expect(
      recommendTrainingWeek({ ...base, workoutsThisWeek: 0, everWorkout: false }).decision
    ).toBe('progress');
  });

  it('repeats after a badly missed consistency goal only', () => {
    const goal = (done: number) => [
      {
        kind: 'consistency' as const,
        goalId: 'c',
        target: 4,
        done,
        status: consistencyStatus(done, 4),
      },
    ];
    expect(recommendTrainingWeek({ ...base, workoutsThisWeek: 2, goals: goal(2) }).decision).toBe(
      'repeat'
    );
    expect(recommendTrainingWeek({ ...base, workoutsThisWeek: 3, goals: goal(3) }).decision).toBe(
      'progress'
    );
  });

  it('puts lighter ahead of repeat', () => {
    expect(
      recommendTrainingWeek({ ...base, workoutsThisWeek: 0, deloadedExercises: 3 }).decision
    ).toBe('lighter');
  });
});

describe('consistencySuggestion', () => {
  it('needs two agreeing weeks', () => {
    expect(consistencySuggestion(2, 5, 4)).toBeNull();
    expect(consistencySuggestion(5, 3, 4)).toBeNull();
  });
  it('lowers to the better of the two missed weeks, never below one', () => {
    expect(consistencySuggestion(2, 3, 4)).toEqual({ kind: 'lower', to: 3 });
    expect(consistencySuggestion(0, 0, 4)).toEqual({ kind: 'lower', to: 1 });
    expect(consistencySuggestion(0, 0, 1)).toBeNull();
  });
  it('raises by one, never past seven', () => {
    expect(consistencySuggestion(5, 6, 4)).toEqual({ kind: 'raise', to: 5 });
    expect(consistencySuggestion(8, 8, 7)).toBeNull();
  });
  it('stays quiet when the goal is met', () => {
    expect(consistencySuggestion(4, 4, 4)).toBeNull();
  });
});
