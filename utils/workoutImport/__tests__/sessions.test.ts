import { parseWorkoutImport } from '../sessions';

import type { WorkoutImportResult } from '../types';

// Fixed reference: 5 November 2026, midday, local time.
const NOW = new Date(2026, 10, 5, 12, 0);

function parse(text: string, assumedWeightUnit: 'kg' | 'lbs' = 'kg'): WorkoutImportResult {
  return parseWorkoutImport(text, { assumedWeightUnit, now: NOW });
}

function okResult(text: string, assumedWeightUnit: 'kg' | 'lbs' = 'kg') {
  const result = parse(text, assumedWeightUnit);
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.failure}`);
  }
  return result;
}

const STRONG_HEADER =
  'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE';

describe('format detection and failures', () => {
  it('reports an empty or whitespace-only file as empty', () => {
    expect(parse('')).toEqual({ ok: false, failure: 'empty' });
    expect(parse('  \n\t \r\n')).toEqual({ ok: false, failure: 'empty' });
    expect(parse('\uFEFF')).toEqual({ ok: false, failure: 'empty' });
  });

  it('reports HTML, JSON and XML as an unknown format', () => {
    expect(parse('<!DOCTYPE html>\n<html><body>hi</body></html>')).toEqual({
      ok: false,
      failure: 'unknownFormat',
    });
    expect(parse('{"workouts":[{"name":"x"}]}')).toEqual({ ok: false, failure: 'unknownFormat' });
    expect(parse('<?xml version="1.0"?>\n<workouts/>')).toEqual({
      ok: false,
      failure: 'unknownFormat',
    });
  });

  it('reports a recognised header with no data rows as noRows', () => {
    expect(parse(STRONG_HEADER)).toEqual({ ok: false, failure: 'noRows' });
    expect(parse(`${STRONG_HEADER}\n\n`)).toEqual({ ok: false, failure: 'noRows' });
  });

  it('returns ok with no sessions when every row is junk', () => {
    const result = okResult(
      `${STRONG_HEADER}\nnot-a-date,,,,,,,,,,,\n2024-02-31,W,,Bench,1,60,8,,,,,`
    );
    expect(result.sessions).toEqual([]);
    expect(result.skipped).toEqual([
      { line: 2, reason: 'badDate' },
      { line: 3, reason: 'badDate' },
    ]);
  });
});

describe('Strong classic', () => {
  const text = [
    STRONG_HEADER,
    '2024-03-07 18:51:52,Push Day,1h 5m,Bench Press (Barbell),1,60,8,,,Felt good,,8',
    '2024-03-07 18:51:52,Push Day,1h 5m,Bench Press (Barbell),W,40,10,,,,,',
    '2024-03-07 18:51:52,Push Day,1h 5m,Bench Press (Barbell),F,60,5,,,,,9.5',
    '2024-03-07 18:51:52,Push Day,1h 5m,Bench Press (Barbell),D,50,6,,,,,',
    '2024-03-07 18:51:52,Push Day,1h 5m,Bench Press (Barbell),Note,,,,,Pause on chest,,',
    '2024-03-07 18:51:52,Push Day,1h 5m,Bench Press (Barbell),Rest Timer,,,,90,,,',
    '2024-03-07 18:51:52,Push Day,1h 5m,Plank,1,,,,60,,,',
    '2024-03-07 18:51:52,Push Day,1h 5m,Overhead Press,1,,,,,,,',
  ].join('\n');

  it('maps workout, exercise blocks, set types, notes and RPE', () => {
    const result = okResult(text);
    expect(result.source).toBe('strong');
    expect(result.weightUnitStated).toBe(false);
    expect(result.sessions).toHaveLength(1);

    const session = result.sessions[0];
    expect(session.name).toBe('Push Day');
    expect(session.day).toBe('2024-03-07');
    expect(session.startMinutes).toBe(18 * 60 + 51);
    expect(session.durationSeconds).toBe(3900);
    expect(session.exercises.map((block) => block.name)).toEqual([
      'Bench Press (Barbell)',
      'Plank',
    ]);

    const bench = session.exercises[0];
    // Exercise note first, then the distinct per-set note.
    expect(bench.notes).toBe('Pause on chest\nFelt good');
    expect(bench.sets.map((set) => set.setType)).toEqual([
      'normal',
      'warmup',
      'failure',
      'drop_set',
    ]);
    expect(bench.sets[0]).toEqual({
      setType: 'normal',
      reps: 8,
      weightKg: 60,
      rpe: 8,
      durationSeconds: null,
      distanceM: null,
    });
    expect(bench.sets[2].rpe).toBe(9.5);
  });

  it('ignores Rest Timer rows silently and does not report them as skips', () => {
    const result = okResult(text);
    expect(result.skipped).toEqual([{ line: 9, reason: 'nothingMeasured' }]);
  });

  it('keeps a timed set as a set, not as the session duration', () => {
    const plank = okResult(text).sessions[0].exercises[1];
    expect(plank.sets).toEqual([
      { setType: 'normal', reps: 0, weightKg: 0, rpe: null, durationSeconds: 60, distanceM: null },
    ]);
  });

  it('places the exercise Note before the per-set notes', () => {
    const lines = [
      STRONG_HEADER,
      '2024-03-07 18:51:52,Push Day,,Row,1,50,8,,,Heavy set,,',
      '2024-03-07 18:51:52,Push Day,,Row,Note,,,,,Elbows in,,',
      '2024-03-07 18:51:52,Push Day,,Row,2,50,8,,,Heavy set,,',
    ].join('\n');
    expect(okResult(lines).sessions[0].exercises[0].notes).toBe('Elbows in\nHeavy set');
  });

  it('takes Workout Notes as the session note', () => {
    const lines = [STRONG_HEADER, '2024-03-07 18:51:52,Push Day,,Row,1,50,8,,,,Shoulder ok,'].join(
      '\n'
    );
    expect(okResult(lines).sessions[0].notes).toBe('Shoulder ok');
  });

  it('treats a Strong Note row with no exercise name as noExercise', () => {
    const lines = [STRONG_HEADER, '2024-03-07 18:51:52,Push Day,,,Note,,,,,Just a note,,'].join(
      '\n'
    );
    expect(okResult(lines).skipped).toEqual([{ line: 2, reason: 'noExercise' }]);
  });
});

describe('Strong current export', () => {
  it('reads kg, duration in seconds, distance in metres and the Workout # column', () => {
    const text = [
      'Workout #,Date,Workout Name,Duration (sec),Exercise Name,Set Order,Weight (kg),Reps,RPE,Distance (meters),Seconds,Notes,Workout Notes',
      '1,2024-03-07 07:00:00,Morning Carry,2700,Farmer Carry,1,24,,,30,,,',
      '2,2024-03-07 19:00:00,Evening Legs,3600,Squat (Barbell),1,100,5,8,,,,',
    ].join('\n');
    const result = okResult(text);
    expect(result.weightUnitStated).toBe(true);
    expect(result.sessions.map((session) => session.name)).toEqual([
      'Morning Carry',
      'Evening Legs',
    ]);
    expect(result.sessions[0].durationSeconds).toBe(2700);
    expect(result.sessions[0].exercises[0].sets[0]).toMatchObject({
      weightKg: 24,
      distanceM: 30,
      reps: 0,
    });
    expect(result.sessions[1].exercises[0].sets[0]).toMatchObject({
      weightKg: 100,
      reps: 5,
      rpe: 8,
    });
  });

  it('converts Weight (lbs) and miles, and keeps a walk-named row with distance as cardio', () => {
    const text = [
      'Date,Workout Name,Exercise Name,Set Order,Weight (lbs),Reps,Distance (miles),Seconds',
      '2024-03-07,Mixed,Deadlift,1,225,5,,',
      '2024-03-07,Mixed,Sled Push,1,,,1,',
      '2024-03-07,Mixed,Treadmill Walk,1,,,1,',
      '2024-03-07,Mixed,Walking Lunge,1,,,1,',
    ].join('\n');
    const result = okResult(text);
    expect(result.weightUnitStated).toBe(true);
    expect(result.sessions[0].cardio).toEqual([
      {
        name: 'Treadmill Walk',
        activity: 'walk',
        distanceM: 1609.344,
        durationSeconds: null,
        notes: null,
      },
    ]);
    const [deadlift, sledPush, walkingLunge] = result.sessions[0].exercises;
    expect(walkingLunge.name).toBe('Walking Lunge');
    expect(deadlift.sets[0].weightKg).toBeCloseTo(225 * 0.45359237, 10);
    expect(sledPush.sets[0].distanceM).toBeCloseTo(1609.344, 6);
    expect(sledPush.name).toBe('Sled Push');
  });

  it('reads the older Strong header, with its Workout Duration and unit columns', () => {
    const text = [
      'Date,Workout Name,Exercise Name,Set Order,Weight,Weight Unit,Reps,RPE,Distance,Distance Unit,Seconds,Notes,Workout Notes,Workout Duration',
      '2021-05-02 09:15:00,Legs,Squat (Barbell),1,100,kg,5,8,,,0,,,1h 5m',
    ].join('\n');
    const result = okResult(text);
    expect(result.source).toBe('strong');
    expect(result.weightUnitStated).toBe(true);
    expect(result.sessions[0].durationSeconds).toBe(3900);
  });

  it('honours a Weight Unit column for a bare Weight', () => {
    const text = [
      'Date,Workout Name,Exercise Name,Set Order,Weight,Weight Unit,Reps',
      '2024-03-07,Mixed,Curl,1,100,lbs,10',
      '2024-03-07,Mixed,Curl,2,50,kg,10',
    ].join('\n');
    const result = okResult(text, 'kg');
    expect(result.weightUnitStated).toBe(true);
    expect(result.sessions[0].exercises[0].sets.map((set) => set.weightKg)).toEqual([
      expect.closeTo(45.359237, 6),
      50,
    ]);
  });
});

describe('Strong semicolon, decimal comma, two workouts on one day', () => {
  it('parses a semicolon file with decimal commas', () => {
    const text = [
      'Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Distance;Seconds;Notes;Workout Notes;RPE',
      '2024-03-07 18:51:52;Push;1h;Bench Press;1;102,5;8;;;;;8,5',
    ].join('\r\n');
    const result = okResult(text);
    expect(result.sessions[0].exercises[0].sets[0]).toMatchObject({ weightKg: 102.5, rpe: 8.5 });
  });

  it('lists two workouts on one day oldest first, even when the evening one comes first in the file', () => {
    const text = [
      STRONG_HEADER,
      '2024-03-08 19:30:00,Evening Legs,45m,Squat,1,100,5,,,,,',
      '2024-03-08 07:15:00,Morning Run,30m,Running,1,,,2000,,,,',
    ].join('\n');
    const result = okResult(text);
    expect(result.sessions.map((session) => session.name)).toEqual(['Morning Run', 'Evening Legs']);
    expect(result.sessions.map((session) => session.startMinutes)).toEqual([435, 1170]);
  });
});

describe('quoted fields and blank rows', () => {
  it('keeps a comma and a newline inside a quoted exercise name', () => {
    const text = [
      STRONG_HEADER,
      '2024-03-07 18:51:52,Push,,"Cable Fly, ""high""\nlow",1,20,12,,,,,',
    ].join('\r\n');
    const result = okResult(text);
    expect(result.sessions[0].exercises[0].name).toBe('Cable Fly, "high"\nlow');
  });

  it('reports the true starting line when a quoted field spans lines', () => {
    const text = [
      STRONG_HEADER,
      '',
      '2024-03-07 18:51:52,Push,,"Cable\nFly",1,20,12,,,,,',
      '2024-03-07 18:51:52,Push,,Row,1,,,,,,,',
    ].join('\n');
    const result = okResult(text);
    expect(result.skipped).toEqual([{ line: 5, reason: 'nothingMeasured' }]);
  });
});

describe('Hevy', () => {
  const header =
    'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe';

  it('groups by start time and title, computes duration from end minus start, decodes \\n notes', () => {
    const rows = [
      header,
      String.raw`Leg Day,"22 Dec 2025, 08:00","22 Dec 2025, 09:02","Heavy\nlegs",Squat (Barbell),1,"Brace hard\nsoft knee",0,normal,100,5,,,8.5`,
      String.raw`Leg Day,"22 Dec 2025, 08:00","22 Dec 2025, 09:02","Heavy\nlegs",Squat (Barbell),1,"Brace hard\nsoft knee",1,warmup,60,5,,,`,
      'Leg Day,"22 Dec 2025, 08:00","22 Dec 2025, 09:02","Heavy\nlegs",Leg Press,2,,2,dropset,120,12,,,',
    ];
    const result = okResult(rows.join('\n'));
    expect(result.source).toBe('hevy');
    expect(result.weightUnitStated).toBe(true);

    const session = result.sessions[0];
    expect(session.name).toBe('Leg Day');
    expect(session.day).toBe('2025-12-22');
    expect(session.startMinutes).toBe(8 * 60);
    expect(session.durationSeconds).toBe(62 * 60);
    expect(session.notes).toBe('Heavy\nlegs');
    expect(session.exercises[0].notes).toBe('Brace hard\nsoft knee');
    expect(session.exercises[0].supersetKey).toBe('1');
    expect(session.exercises[0].sets.map((set) => set.setType)).toEqual(['normal', 'warmup']);
    expect(session.exercises[1].supersetKey).toBe('2');
    expect(session.exercises[1].sets[0].setType).toBe('drop_set');
  });

  it('reads imperial columns', () => {
    const rows = [
      'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_lbs,reps,distance_miles,duration_seconds,rpe',
      '"Row","2024-03-07T18:00:00Z","2024-03-07T18:30:00Z",,Row Machine,,,0,normal,100,,1,,',
    ];
    const result = okResult(rows.join('\n'));
    expect(result.sessions[0].durationSeconds).toBe(1800);
    expect(result.sessions[0].exercises[0].sets[0].weightKg).toBeCloseTo(100 * 0.45359237, 10);
    expect(result.sessions[0].exercises[0].sets[0].distanceM).toBeCloseTo(1609.344, 6);
  });

  it('maps unknown set types to normal and keeps the exercise once when it recurs', () => {
    const rows = [
      header,
      '"A","2024-03-07 10:00:00","2024-03-07 11:00:00",,Curl,,,0,mystery,10,8,,,',
      '"A","2024-03-07 10:00:00","2024-03-07 11:00:00",,Press,,,1,normal,20,8,,,',
      '"A","2024-03-07 10:00:00","2024-03-07 11:00:00",,Curl,,,2,failure,10,4,,,',
    ];
    const result = okResult(rows.join('\n'));
    expect(result.sessions[0].exercises.map((block) => block.name)).toEqual(['Curl', 'Press']);
    expect(result.sessions[0].exercises[0].sets.map((set) => set.setType)).toEqual([
      'normal',
      'failure',
    ]);
  });
});

describe('FitNotes (Android)', () => {
  const header =
    'Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time,Comment';

  it('makes one session per day with no name and no start time', () => {
    const rows = [
      header,
      '2024-03-08,Squat,Legs,100,kgs,5,,,,Good depth',
      '2024-03-07,Bench Press,Chest,60,kgs,8,,,,',
      '2024-03-07,Bench Press,Chest,135,lbs,5,,,,Heavy',
      '2024-03-07,Plank,Core,,,,,,60,',
    ];
    const result = okResult(rows.join('\n'));
    expect(result.source).toBe('fitnotes');
    expect(result.sessions.map((session) => session.day)).toEqual(['2024-03-07', '2024-03-08']);
    const first = result.sessions[0];
    expect(first.name).toBe('');
    expect(first.startMinutes).toBeNull();
    expect(first.exercises.map((block) => block.name)).toEqual(['Bench Press', 'Plank']);
    expect(first.exercises[0].category).toBe('Chest');
    expect(first.exercises[0].notes).toBe('Heavy');
    expect(first.exercises[0].sets[1].weightKg).toBeCloseTo(135 * 0.45359237, 10);
    expect(first.exercises[1].sets[0]).toMatchObject({ reps: 0, durationSeconds: 60, weightKg: 0 });
    expect(result.sessions[1].exercises[0].notes).toBe('Good depth');
  });

  it('treats an unknown Weight Unit as the assumed unit and a blank distance unit as metres', () => {
    const rows = [
      header,
      '2024-03-07,Row,Cardio,50,stones,8,,,,',
      '2024-03-07,Sled Push,Legs,,,,500,,,',
    ];
    const lbs = okResult(rows.join('\n'), 'lbs');
    expect(lbs.sessions[0].exercises[0].sets[0].weightKg).toBeCloseTo(50 * 0.45359237, 10);
    expect(lbs.sessions[0].exercises[1].sets[0].distanceM).toBe(500);
  });

  it('converts a per-row distance unit', () => {
    const rows = [header, '2024-03-07,Row,Cardio,,,,2,km,,', '2024-03-07,Row,Cardio,,,,1,mi,,'];
    const result = okResult(rows.join('\n'));
    const sets = result.sessions[0].exercises[0].sets;
    expect(sets[0].distanceM).toBe(2000);
    expect(sets[1].distanceM).toBeCloseTo(1609.344, 6);
  });

  it('keeps Walk and Run rows with distance as cardio, one entry per row', () => {
    const rows = [
      header,
      '2024-03-07,Walk,Cardio,,,,2,km,1800,',
      '2024-03-07,Walk,Cardio,,,,1,km,,',
      '2024-03-07,Treadmill,Cardio,,,,5,km,1500,steady',
      '2024-03-07,Walk,Cardio,,,,,,300,time only',
    ];
    const result = okResult(rows.join('\n'));
    const session = result.sessions[0];
    expect(session.cardio).toEqual([
      { name: 'Walk', activity: 'walk', distanceM: 2000, durationSeconds: 1800, notes: null },
      { name: 'Walk', activity: 'walk', distanceM: 1000, durationSeconds: null, notes: null },
      {
        name: 'Treadmill',
        activity: 'run',
        distanceM: 5000,
        durationSeconds: 1500,
        notes: 'steady',
      },
    ]);
    expect(session.exercises).toHaveLength(1);
    expect(session.exercises[0].name).toBe('Walk');
    expect(session.exercises[0].sets).toEqual([
      { setType: 'normal', reps: 0, weightKg: 0, rpe: null, durationSeconds: 300, distanceM: null },
    ]);
  });

  it('does not treat a plank or a carry as cardio', () => {
    const rows = [header, '2024-03-07,Farmer Carry,Full Body,24,kgs,,40,m,30,'];
    const result = okResult(rows.join('\n'));
    expect(result.sessions[0].cardio).toEqual([]);
    expect(result.sessions[0].exercises[0].sets[0]).toMatchObject({
      weightKg: 24,
      distanceM: 40,
      durationSeconds: 30,
    });
  });

  it('flags a bare Weight column without unit information', () => {
    const rows = ['Date,Exercise,Category,Weight,Reps', '2024-03-07,Squat,Legs,100,5'];
    const result = okResult(rows.join('\n'), 'lbs');
    expect(result.weightUnitStated).toBe(false);
    expect(result.sessions[0].exercises[0].sets[0].weightKg).toBeCloseTo(100 * 0.45359237, 10);
  });

  it('reads Weight (kgs) without a unit column as kilograms', () => {
    const rows = ['Date,Exercise,Category,Weight (kgs),Reps', '2024-03-07,Squat,Legs,100,5'];
    const result = okResult(rows.join('\n'), 'lbs');
    expect(result.weightUnitStated).toBe(true);
    expect(result.sessions[0].exercises[0].sets[0].weightKg).toBe(100);
  });
});

describe('FitNotes 2 (iOS)', () => {
  const header =
    'Date,Exercise,Category,Weight (kg),Weight (lbs),Reps,Distance,Distance Unit,Time,Notes,Kind';

  it('uses the lbs value when kg is blank and marks warm-ups from Kind', () => {
    const rows = [
      header,
      '2024-03-07,Bench Press,Chest,60,,8,,,,,Normal',
      '2024-03-07,Bench Press,Chest,,40,10,,,,Easy,Warm up',
      '2024-03-07,Bench Press,Chest,,135,5,,,,,normal',
    ];
    const result = okResult(rows.join('\n'));
    expect(result.source).toBe('fitnotes2');
    expect(result.weightUnitStated).toBe(true);
    const sets = result.sessions[0].exercises[0].sets;
    expect(sets.map((set) => set.setType)).toEqual(['normal', 'warmup', 'normal']);
    expect(sets[1].weightKg).toBeCloseTo(40 * 0.45359237, 10);
    expect(result.sessions[0].exercises[0].notes).toBe('Easy');
  });
});

describe('set-level rules', () => {
  it('caps RPE above 10 and nulls RPE of 0 or junk', () => {
    const rows = [
      STRONG_HEADER,
      '2024-03-07 18:51:52,A,,Row,1,50,8,,,,,11',
      '2024-03-07 18:51:52,A,,Row,2,50,8,,,,,0',
      '2024-03-07 18:51:52,A,,Row,3,50,8,,,,,junk',
    ].join('\n');
    const sets = okResult(rows).sessions[0].exercises[0].sets;
    expect(sets.map((set) => set.rpe)).toEqual([10, null, null]);
  });

  it('skips a row with a negative or over-limit value as outOfRange', () => {
    const rows = [
      STRONG_HEADER,
      '2024-03-07 18:51:52,A,,Row,1,-5,8,,,,,',
      '2024-03-07 18:51:52,A,,Row,2,50,-1,,,,,',
      '2024-03-07 18:51:52,A,,Row,3,5000,8,,,,,',
      '2024-03-07 18:51:52,A,,Row,4,50,5000,,,,,',
      '2024-03-07 18:51:52,A,,Row,5,50,8,,90000,,,',
      '2024-03-07 18:51:52,A,,Row,6,50,8,,,,,',
    ].join('\n');
    const result = okResult(rows);
    expect(result.skipped.map((skip) => skip.reason)).toEqual([
      'outOfRange',
      'outOfRange',
      'outOfRange',
      'outOfRange',
      'outOfRange',
    ]);
    expect(result.sessions[0].exercises[0].sets).toHaveLength(1);
  });

  it('skips a row with nothing measured and a row with no exercise name', () => {
    const rows = [
      STRONG_HEADER,
      '2024-03-07 18:51:52,A,,Row,1,,,,,,,',
      '2024-03-07 18:51:52,A,,,1,50,8,,,,,',
      '2024-03-07 18:51:52,A,,Row,1,0,0,,,,,',
    ].join('\n');
    const result = okResult(rows);
    expect(result.skipped).toEqual([
      { line: 2, reason: 'nothingMeasured' },
      { line: 3, reason: 'noExercise' },
      { line: 4, reason: 'nothingMeasured' },
    ]);
  });

  it('skips bad and future dates with distinct reasons', () => {
    const rows = [
      STRONG_HEADER,
      '2024-02-31 10:00,A,,Row,1,50,8,,,,,',
      '2026-12-01 10:00,A,,Row,1,50,8,,,,,',
      '2024-03-07 10:00,A,,Row,1,50,8,,,,,',
    ].join('\n');
    const result = okResult(rows);
    expect(result.skipped).toEqual([
      { line: 2, reason: 'badDate' },
      { line: 3, reason: 'futureDate' },
    ]);
    expect(result.sessions).toHaveLength(1);
  });

  it('keeps a session with only skipped rows out of the result', () => {
    const rows = [STRONG_HEADER, '2024-03-07 10:00,Ghost,,Row,1,,,,,,,'].join('\n');
    expect(okResult(rows).sessions).toEqual([]);
  });

  it('sorts sessions oldest first even when the file lists newest first', () => {
    const rows = [
      STRONG_HEADER,
      '2024-03-09 10:00,C,,Row,1,50,8,,,,,',
      '2024-03-07 10:00,A,,Row,1,50,8,,,,,',
      '2024-03-08 10:00,B,,Row,1,50,8,,,,,',
    ].join('\n');
    expect(okResult(rows).sessions.map((session) => session.day)).toEqual([
      '2024-03-07',
      '2024-03-08',
      '2024-03-09',
    ]);
  });

  it('merges a repeated exercise into one block in first-seen order', () => {
    const rows = [
      STRONG_HEADER,
      '2024-03-07 10:00,A,,Curl,1,10,8,,,,,',
      '2024-03-07 10:00,A,,Press,1,20,8,,,,,',
      '2024-03-07 10:00,A,,Curl,2,10,6,,,,,',
    ].join('\n');
    const session = okResult(rows).sessions[0];
    expect(session.exercises.map((block) => block.name)).toEqual(['Curl', 'Press']);
    expect(session.exercises[0].sets).toHaveLength(2);
  });
});

describe('hostile input', () => {
  it('handles __proto__ as a header and as a category value', () => {
    const rows = [
      'Date,Exercise,Category,Weight,Weight Unit,Reps,__proto__',
      '2024-03-07,Squat,__proto__,100,kgs,5,x',
    ];
    const result = okResult(rows.join('\n'));
    expect(result.sessions[0].exercises[0].category).toBe('__proto__');
  });

  it('handles rows shorter and longer than the header', () => {
    const rows = [
      STRONG_HEADER,
      '2024-03-07 10:00,A',
      '2024-03-07 10:00,A,,Row,1,50,8,,,,,,,,extra,more',
    ].join('\n');
    const result = okResult(rows);
    expect(result.skipped).toEqual([{ line: 2, reason: 'noExercise' }]);
    expect(result.sessions[0].exercises[0].sets[0]).toMatchObject({ weightKg: 50, reps: 8 });
  });

  it('keeps a 5000-row file usable', () => {
    const lines = [STRONG_HEADER];
    for (let k = 0; k < 5000; k++) {
      lines.push(`2024-03-07 10:00,A,,Row,${(k % 4) + 1},${k % 100},8,,,,,`);
    }
    const result = okResult(lines.join('\n'));
    expect(result.sessions[0].exercises[0].sets).toHaveLength(5000);
  });

  it('never throws on random bytes, even when they carry a valid header', () => {
    let seed = 12345;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed;
    };
    const alphabet = ',;"\n\r0123456789.-:abcdefghij WxyzPMpm#/';

    for (let trial = 0; trial < 200; trial++) {
      let body = '';
      const length = next() % 300;
      for (let k = 0; k < length; k++) {
        body +=
          next() % 4 === 0
            ? String.fromCharCode(next() % 0x10000)
            : alphabet[next() % alphabet.length];
      }
      const samples = [
        body,
        `${STRONG_HEADER}\n${body}`,
        `Date,Exercise,Category,Weight,Reps\n${body}`,
      ];
      for (const sample of samples) {
        const result = parse(sample);
        expect(result.ok === true || result.ok === false).toBe(true);
      }
    }
  });

  it('turns a non-string argument into unknownFormat instead of throwing', () => {
    expect(
      parseWorkoutImport(undefined as unknown as string, { assumedWeightUnit: 'kg', now: NOW })
    ).toEqual({
      ok: false,
      failure: 'unknownFormat',
    });
  });
});
