import { computeExerciseSearchText } from '@/database/exerciseSearchText';
import { getAllLocaleExerciseNamesBySlug } from '@/data/exerciseCatalogue';
import { appExerciseId } from '@/utils/exerciseImage';
import {
  type ExerciseMatchCandidate,
  inferCustomExercise,
  proposeExerciseMatches,
} from '@/utils/workoutImport/exerciseMatch';
import type { ImportedSession } from '@/utils/workoutImport/types';

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Squat';

const CANDIDATES: ExerciseMatchCandidate[] = [
  { id: appExerciseId(BENCH), name: 'Barbell Bench Press - Medium Grip', searchText: null },
  { id: appExerciseId(SQUAT), name: 'Barbell Squat', searchText: null },
  { id: appExerciseId('Dumbbell_Flyes'), name: 'Dumbbell Flyes', searchText: null },
  { id: appExerciseId('Dumbbell_Lunges'), name: 'Dumbbell Lunges', searchText: null },
  {
    id: appExerciseId('Dumbbell_Shoulder_Press'),
    name: 'Dumbbell Shoulder Press',
    searchText: null,
  },
  {
    id: appExerciseId('Standing_Dumbbell_Press'),
    name: 'Standing Dumbbell Press',
    searchText: null,
  },
];

function session(
  names: { name: string; sets: number; category?: string | null }[]
): ImportedSession {
  return {
    importKey: `k-${names.map((n) => n.name).join('|')}`,
    source: 'strong',
    name: 'Workout',
    day: '2026-10-05',
    startMinutes: 600,
    durationSeconds: null,
    notes: null,
    exercises: names.map(({ name, sets, category = null }) => ({
      name,
      category,
      notes: null,
      supersetKey: null,
      sets: Array.from({ length: sets }, () => ({
        setType: 'normal' as const,
        reps: 8,
        weightKg: 50,
        rpe: null,
        durationSeconds: null,
        distanceM: null,
      })),
    })),
    cardio: [],
  };
}

function matchFor(name: string, sessions: ImportedSession[], aliases = []) {
  return proposeExerciseMatches(sessions, CANDIDATES, aliases).find((m) => m.name === name);
}

describe('proposeExerciseMatches', () => {
  it('matches a name identical after normalisation exactly', () => {
    const match = matchFor('barbell squat', [session([{ name: 'barbell squat', sets: 3 }])]);
    expect(match).toMatchObject({ kind: 'exact', exerciseId: appExerciseId(SQUAT) });
  });

  it('uses the curated table for names the catalogue spells differently', () => {
    const match = matchFor('Bench Press (Barbell)', [
      session([{ name: 'Bench Press (Barbell)', sets: 4 }]),
    ]);
    expect(match).toMatchObject({ kind: 'known', exerciseId: appExerciseId(BENCH) });
  });

  it('prefers a saved alias over every other rule', () => {
    const match = matchFor(
      'Bench Press (Barbell)',
      [session([{ name: 'Bench Press (Barbell)', sets: 4 }])],
      [{ alias: 'Bench Press (Barbell)', exerciseId: appExerciseId(SQUAT) }]
    );
    expect(match).toMatchObject({ kind: 'alias', exerciseId: appExerciseId(SQUAT) });
  });

  it('ignores an alias whose exercise is not a live candidate', () => {
    const match = matchFor(
      'Bench Press (Barbell)',
      [session([{ name: 'Bench Press (Barbell)', sets: 4 }])],
      [{ alias: 'Bench Press (Barbell)', exerciseId: 'fx-gone' }]
    );
    expect(match?.kind).toBe('known');
  });

  it('accepts a fuzzy match only when exactly one exercise fits', () => {
    const match = matchFor('DB Flyes', [session([{ name: 'DB Flyes', sets: 3 }])]);
    expect(match).toMatchObject({
      kind: 'unambiguous',
      exerciseId: appExerciseId('Dumbbell_Flyes'),
    });
  });

  it('leaves a name unmatched rather than guessing between plausible exercises', () => {
    const match = matchFor('Dumbbell Press', [session([{ name: 'Dumbbell Press', sets: 3 }])]);
    expect(match).toMatchObject({ kind: 'unmatched', exerciseId: null });
  });

  it('counts sets per name, sorts by use, and reports the category', () => {
    const matches = proposeExerciseMatches(
      [
        session([
          { name: 'Dumbbell Lunges', sets: 2, category: 'Legs' },
          { name: 'Barbell Squat', sets: 5 },
        ]),
        session([{ name: 'Dumbbell Lunges', sets: 4 }]),
      ],
      CANDIDATES,
      []
    );
    expect(matches.map((m) => [m.name, m.setCount])).toEqual([
      ['Dumbbell Lunges', 6],
      ['Barbell Squat', 5],
    ]);
    expect(matches.find((m) => m.name === 'Dumbbell Lunges')?.category).toBe('Legs');
  });

  it('ignores cardio rows, which never need a catalogue exercise', () => {
    const withCardio: ImportedSession = {
      ...session([{ name: 'Barbell Squat', sets: 1 }]),
      cardio: [
        { name: 'Treadmill', activity: 'run', distanceM: 5000, durationSeconds: 1500, notes: null },
      ],
    };
    expect(proposeExerciseMatches([withCardio], CANDIDATES, []).map((m) => m.name)).toEqual([
      'Barbell Squat',
    ]);
  });

  it('matches a catalogue name in every bundled language when search text carries it', () => {
    const names = getAllLocaleExerciseNamesBySlug().get(SQUAT) ?? [];
    expect(names.length).toBeGreaterThan(1);
    const searchText = computeExerciseSearchText(
      { id: appExerciseId(SQUAT), name: 'Barbell Squat' },
      []
    );
    const localised = [{ id: appExerciseId(SQUAT), name: 'Barbell Squat', searchText }];

    for (const localName of names) {
      const [match] = proposeExerciseMatches(
        [session([{ name: localName, sets: 1 }])],
        localised,
        []
      );
      expect({ localName, exerciseId: match.exerciseId }).toEqual({
        localName,
        exerciseId: appExerciseId(SQUAT),
      });
    }
  });
});

describe('inferCustomExercise', () => {
  it('reads the FitNotes category first', () => {
    expect(inferCustomExercise('Mystery Movement', 'Chest')).toMatchObject({
      muscleGroup: 'chest',
    });
    expect(inferCustomExercise('Mystery Movement', 'Biceps')).toMatchObject({
      muscleGroup: 'arms',
    });
    expect(inferCustomExercise('Mystery Movement', 'Abs')).toMatchObject({
      muscleGroup: 'abdomen',
    });
  });

  it('falls back to the name when the category is missing or unknown', () => {
    expect(inferCustomExercise('Leg Extension', null)).toMatchObject({ muscleGroup: 'legs' });
    expect(inferCustomExercise('Cable Lateral Raise', 'Unknown')).toMatchObject({
      muscleGroup: 'shoulders',
    });
    expect(inferCustomExercise('Zorbing', null)).toMatchObject({ muscleGroup: 'other' });
  });

  it('reads equipment from the bracket or the words', () => {
    expect(inferCustomExercise('Row (Cable)', 'Back')).toMatchObject({ equipmentType: 'cable' });
    expect(inferCustomExercise('Press (Smith Machine)', null)).toMatchObject({
      equipmentType: 'smith_machine',
    });
    expect(inferCustomExercise('Dumbbell Curl', null)).toMatchObject({ equipmentType: 'dumbbell' });
    expect(inferCustomExercise('Push Up', null)).toMatchObject({ equipmentType: 'bodyweight' });
    expect(inferCustomExercise('Zorbing', null)).toMatchObject({ equipmentType: 'other' });
  });

  it('classifies the mechanic with the real MechanicType values', () => {
    expect(inferCustomExercise('Shoulder Press', null)).toMatchObject({ mechanicType: 'compound' });
    expect(inferCustomExercise('Triceps Pushdown', null)).toMatchObject({
      mechanicType: 'isolation',
    });
    expect(inferCustomExercise('Rowing', 'Cardio')).toMatchObject({ mechanicType: 'cardio' });
  });

  it('is safe against prototype names used as a category', () => {
    expect(inferCustomExercise('Zorbing', '__proto__')).toMatchObject({ muscleGroup: 'other' });
    expect(inferCustomExercise('Zorbing', 'constructor')).toMatchObject({ muscleGroup: 'other' });
  });
});
