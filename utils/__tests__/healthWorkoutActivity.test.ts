import { resolveHealthActivity, workoutTotals } from '@/utils/healthWorkoutActivity';

describe('resolveHealthActivity', () => {
  it('maps a logged walk and run to the specific activity, not generic cardio', () => {
    expect(resolveHealthActivity('cardio', 'walk')).toBe('walking');
    expect(resolveHealthActivity('cardio', 'run')).toBe('running');
  });

  it('lets the activity win over the workout type', () => {
    expect(resolveHealthActivity('strength', 'run')).toBe('running');
  });

  it('keeps following the workout type when there is no activity', () => {
    expect(resolveHealthActivity('cardio')).toBe('cardio');
    expect(resolveHealthActivity('strength')).toBe('strength');
    expect(resolveHealthActivity('flexibility')).toBe('flexibility');
    expect(resolveHealthActivity('calisthenics')).toBe('calisthenics');
  });

  it('treats free, unknown and missing types as other', () => {
    expect(resolveHealthActivity('free')).toBe('other');
    expect(resolveHealthActivity('mystery')).toBe('other');
    expect(resolveHealthActivity(undefined)).toBe('other');
  });
});

describe('workoutTotals', () => {
  it('sends distance and energy only when the session has them', () => {
    expect(workoutTotals({ caloriesBurned: 300, distanceM: 5000 })).toEqual({
      energyBurned: 300,
      distance: 5000,
    });
    expect(workoutTotals({ distanceM: 5000 })).toEqual({ distance: 5000 });
    expect(workoutTotals({ caloriesBurned: 300 })).toEqual({ energyBurned: 300 });
  });

  it('sends nothing for zero, null or absent values', () => {
    expect(workoutTotals({ caloriesBurned: 0, distanceM: 0 })).toBeUndefined();
    expect(workoutTotals({ caloriesBurned: null, distanceM: null })).toBeUndefined();
    expect(workoutTotals({})).toBeUndefined();
  });
});
