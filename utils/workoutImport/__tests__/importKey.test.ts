import { buildImportKey } from '../importKey';
import { parseWorkoutImport } from '../sessions';

const NOW = new Date(2026, 10, 5, 12, 0);

describe('buildImportKey', () => {
  it('has the source:hash format with 16 hex characters', () => {
    expect(buildImportKey('strong', '2024-03-07 18:51:52', 'Push Day')).toMatch(
      /^strong:[0-9a-f]{16}$/
    );
  });

  it('is identical for the same input every time', () => {
    const a = buildImportKey('hevy', '22 Dec 2025, 08:00', 'Leg Day');
    const b = buildImportKey('hevy', '22 Dec 2025, 08:00', 'Leg Day');
    expect(a).toBe(b);
  });

  it('ignores extra whitespace in the date and name', () => {
    expect(buildImportKey('strong', '2024-03-07   18:51:52', 'Push  Day ')).toBe(
      buildImportKey('strong', '2024-03-07 18:51:52', 'Push Day')
    );
  });

  it('gives the same key for the same wall-clock day and minute in any spelling', () => {
    expect(buildImportKey('fitnotes', '2024-03-07', '')).toBe(
      buildImportKey('fitnotes', '07/03/2024', '')
    );
  });

  it('differs for different days, minutes, names and sources', () => {
    const base = buildImportKey('strong', '2024-03-07 18:51:52', 'Push Day');
    expect(buildImportKey('strong', '2024-03-08 18:51:52', 'Push Day')).not.toBe(base);
    expect(buildImportKey('strong', '2024-03-07 19:51:52', 'Push Day')).not.toBe(base);
    expect(buildImportKey('strong', '2024-03-07 18:51:52', 'Pull Day')).not.toBe(base);
    expect(buildImportKey('hevy', '2024-03-07 18:51:52', 'Push Day')).not.toBe(base);
  });

  it('keeps zoned text as written so it does not depend on the device timezone', () => {
    const a = buildImportKey('hevy', '2024-03-07T23:30:00+02:00', 'Run');
    const b = buildImportKey('hevy', '2024-03-07T23:30:00-05:00', 'Run');
    expect(a).not.toBe(b);
    expect(a).toBe(buildImportKey('hevy', '2024-03-07T23:30:00+02:00', 'Run'));
  });
});

describe('keys from parseWorkoutImport', () => {
  const strong = [
    'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
    '2024-03-07 18:51:52,Push Day,1h,Bench Press,1,60,8,,,,,',
  ].join('\n');

  it('is the same for the same file parsed twice', () => {
    const first = parseWorkoutImport(strong, { assumedWeightUnit: 'kg', now: NOW });
    const second = parseWorkoutImport(strong, { assumedWeightUnit: 'kg', now: NOW });
    expect(first).toEqual(second);
  });

  it('does not change with the assumed weight unit', () => {
    const kg = parseWorkoutImport(strong, { assumedWeightUnit: 'kg', now: NOW });
    const lbs = parseWorkoutImport(strong, { assumedWeightUnit: 'lbs', now: NOW });
    if (!kg.ok || !lbs.ok) {
      throw new Error('expected ok');
    }
    expect(kg.sessions[0].importKey).toBe(lbs.sessions[0].importKey);
  });

  it('gives two sessions with the same key a stable suffix', () => {
    const text = [
      'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
      '2024-03-07 18:51:52,Push Day,1h,Bench Press,1,60,8,,,,,',
      '2024-03-07 18:51:52,Push Day,1h,Bench Press,1,60,8,,,,,',
    ].join('\n');
    const result = parseWorkoutImport(text, { assumedWeightUnit: 'kg', now: NOW });
    if (!result.ok) {
      throw new Error('expected ok');
    }
    expect(result.sessions).toHaveLength(1);
    const twoWorkouts = [
      'Workout #,Date,Workout Name,Duration (sec),Exercise Name,Set Order,Weight (kg),Reps,RPE,Distance (meters),Seconds,Notes,Workout Notes',
      '1,2024-03-07 18:51:52,Push Day,3600,Bench Press,1,60,8,,,,,',
      '2,2024-03-07 18:51:52,Push Day,3600,Bench Press,1,60,8,,,,,',
    ].join('\n');
    const pair = parseWorkoutImport(twoWorkouts, { assumedWeightUnit: 'kg', now: NOW });
    if (!pair.ok) {
      throw new Error('expected ok');
    }
    expect(pair.sessions).toHaveLength(2);
    expect(pair.sessions[1].importKey).toBe(`${pair.sessions[0].importKey}-2`);
  });
});
