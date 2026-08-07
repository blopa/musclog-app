import {
  DEFAULT_WORKOUT_INSIGHTS_TYPE,
  parseWorkoutInsightsType,
} from '@/utils/workoutInsightsType';

describe('parseWorkoutInsightsType', () => {
  it('passes every supported option through unchanged', () => {
    expect(parseWorkoutInsightsType('none')).toBe('none');
    expect(parseWorkoutInsightsType('algorithm')).toBe('algorithm');
    expect(parseWorkoutInsightsType('ai')).toBe('ai');
  });

  it('coerces missing values to the documented default', () => {
    // The setting is read from a nullable template column, so `undefined`/`null` are the
    // normal "never configured" state and must land on the same value as the exported default.
    expect(parseWorkoutInsightsType(undefined)).toBe(DEFAULT_WORKOUT_INSIGHTS_TYPE);
    expect(parseWorkoutInsightsType(null)).toBe(DEFAULT_WORKOUT_INSIGHTS_TYPE);
    expect(parseWorkoutInsightsType('')).toBe(DEFAULT_WORKOUT_INSIGHTS_TYPE);
  });

  it('coerces unknown stored strings to none rather than leaking them to callers', () => {
    // Guards against a removed/renamed option in old rows silently reaching the UI.
    expect(parseWorkoutInsightsType('gpt')).toBe('none');
    expect(parseWorkoutInsightsType('algorithmic')).toBe('none');
    expect(parseWorkoutInsightsType('0')).toBe('none');
  });

  it('is case-sensitive and does not trim, so only the canonical spelling survives', () => {
    expect(parseWorkoutInsightsType('AI')).toBe('none');
    expect(parseWorkoutInsightsType('Algorithm')).toBe('none');
    expect(parseWorkoutInsightsType(' ai')).toBe('none');
    expect(parseWorkoutInsightsType('ai ')).toBe('none');
  });
});
