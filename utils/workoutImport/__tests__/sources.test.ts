import {
  buildColumnMap,
  cellAt,
  detectSource,
  normalizeHeaderCell,
  resolveDistanceColumn,
  resolveWeightColumns,
} from '../sources';

const STRONG_CLASSIC =
  'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE';
const STRONG_CURRENT =
  'Workout #,Date,Workout Name,Duration (sec),Exercise Name,Set Order,Weight (kg),Reps,RPE,Distance (meters),Seconds,Notes,Workout Notes';
const HEVY =
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe';
const HEVY_IMPERIAL =
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_lbs,reps,distance_miles,duration_seconds,rpe';
const FITNOTES =
  'Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time,Comment';
const FITNOTES_KGS = 'Date,Exercise,Category,Weight (kgs),Reps,Distance,Time,Comment';
const FITNOTES2 =
  'Date,Exercise,Category,Weight (kg),Weight (lbs),Reps,Distance,Distance Unit,Time,Notes,Kind';

describe('normalizeHeaderCell', () => {
  it('lowercases, trims and turns punctuation runs into one space', () => {
    expect(normalizeHeaderCell('  Weight (kg) ')).toBe('weight kg');
    expect(normalizeHeaderCell('start_time')).toBe('start time');
    expect(normalizeHeaderCell('Distance   (meters)')).toBe('distance meters');
  });

  it('turns # into "no" and drops a BOM', () => {
    expect(normalizeHeaderCell('\uFEFFWorkout #')).toBe('workout no');
  });
});

describe('buildColumnMap and cellAt', () => {
  it('finds columns by name, not position, and tolerates short rows', () => {
    const map = buildColumnMap(['Reps', 'Exercise Name', 'Weight']);
    const row = ['8', 'Squat'];
    expect(cellAt(row, map, 'exercise name')).toBe('Squat');
    expect(cellAt(row, map, 'weight')).toBe('');
    expect(cellAt(row, map, 'missing')).toBe('');
  });

  it('keeps __proto__ and constructor as ordinary keys', () => {
    // Underscores are non-alphanumeric, so the header normalises to "proto".
    const map = buildColumnMap(['__proto__', 'constructor', 'Category']);
    const row = ['a', 'b', '__proto__'];
    expect(map.has('proto')).toBe(true);
    expect(cellAt(row, map, 'proto')).toBe('a');
    expect(cellAt(row, map, 'constructor')).toBe('b');
    expect(cellAt(row, map, 'category')).toBe('__proto__');
    expect(cellAt(row, map, 'toString')).toBe('');
  });

  it('keeps the first of two identical headers', () => {
    const map = buildColumnMap(['Weight', 'Weight']);
    expect(map.get('weight')).toBe(0);
  });
});

describe('detectSource', () => {
  it.each([
    ['Strong classic', STRONG_CLASSIC, 'strong'],
    ['Strong current', STRONG_CURRENT, 'strong'],
    ['Hevy', HEVY, 'hevy'],
    ['Hevy imperial', HEVY_IMPERIAL, 'hevy'],
    ['FitNotes', FITNOTES, 'fitnotes'],
    ['FitNotes kgs', FITNOTES_KGS, 'fitnotes'],
    ['FitNotes 2', FITNOTES2, 'fitnotes2'],
  ])('detects %s', (_label, header, source) => {
    expect(detectSource(header.split(','))).toBe(source);
  });

  it('refuses headers it does not know', () => {
    expect(detectSource(['name', 'value'])).toBeNull();
    expect(detectSource(['<!DOCTYPE html>'])).toBeNull();
    expect(detectSource(['{"workouts": []}'])).toBeNull();
    expect(detectSource(['Exercise', 'Category'])).toBeNull();
  });
});

describe('column resolution', () => {
  it('prefers unit-suffixed weight columns and reads Weight Unit', () => {
    expect(resolveWeightColumns(buildColumnMap(STRONG_CURRENT.split(',')))).toMatchObject({
      kg: 6,
      bare: null,
    });
    expect(resolveWeightColumns(buildColumnMap(STRONG_CLASSIC.split(',')))).toMatchObject({
      bare: 5,
      kg: null,
      unit: null,
    });
    expect(resolveWeightColumns(buildColumnMap(['Weight', 'Weight Unit']))).toMatchObject({
      bare: 0,
      unit: 1,
    });
  });

  it('reads a header-named distance unit', () => {
    expect(resolveDistanceColumn(buildColumnMap(['distance_km']))).toEqual({
      index: 0,
      factor: 1000,
    });
    expect(resolveDistanceColumn(buildColumnMap(['Distance']))).toEqual({ index: 0, factor: null });
    expect(resolveDistanceColumn(buildColumnMap(['Distance Unit']))).toBeNull();
  });
});
