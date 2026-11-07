import {
  blockNotes,
  type ExerciseResolution,
  isTimedSet,
  partitionResolutions,
  plannedBlocks,
  sessionStartedAt,
} from '../commitPlan';
import type { ImportedExerciseBlock, ImportedSession, ImportedSet } from '../types';

const set = (overrides: Partial<ImportedSet> = {}): ImportedSet => ({
  setType: 'normal',
  reps: 5,
  weightKg: 100,
  rpe: null,
  durationSeconds: null,
  distanceM: null,
  ...overrides,
});

const block = (overrides: Partial<ImportedExerciseBlock> = {}): ImportedExerciseBlock => ({
  name: 'Squat',
  category: null,
  notes: null,
  supersetKey: null,
  sets: [set()],
  ...overrides,
});

const session = (exercises: ImportedExerciseBlock[]): ImportedSession => ({
  importKey: 'strong:abc',
  source: 'strong',
  name: 'Legs',
  day: '2026-10-05',
  startMinutes: null,
  durationSeconds: null,
  notes: null,
  exercises,
  cardio: [],
});

const create = (name: string): ExerciseResolution => ({
  kind: 'create',
  name,
  muscleGroup: 'legs',
  equipmentType: 'barbell',
  mechanicType: 'compound',
});

describe('partitionResolutions', () => {
  const live = new Set(['fx-squat']);

  it('sorts each name by what the person chose', () => {
    const resolved = partitionResolutions(
      ['Squat', 'Row', 'Curl'],
      new Map<string, ExerciseResolution>([
        ['Squat', { kind: 'existing', exerciseId: 'fx-squat', rememberAlias: true }],
        ['Row', create('My row')],
        ['Curl', { kind: 'skip' }],
      ]),
      live
    );

    expect(resolved.existing).toEqual(
      new Map([['Squat', { exerciseId: 'fx-squat', rememberAlias: true }]])
    );
    expect([...resolved.custom]).toEqual([
      [
        'Row',
        { name: 'My row', muscleGroup: 'legs', equipmentType: 'barbell', mechanicType: 'compound' },
      ],
    ]);
    expect(resolved.skipped).toEqual(new Set(['Curl']));
  });

  it('skips a name with no choice and a choice naming a deleted exercise', () => {
    const resolved = partitionResolutions(
      ['Unchosen', 'Gone'],
      new Map<string, ExerciseResolution>([
        ['Gone', { kind: 'existing', exerciseId: 'fx-deleted', rememberAlias: false }],
      ]),
      live
    );

    expect(resolved.skipped).toEqual(new Set(['Unchosen', 'Gone']));
    expect(resolved.existing.size).toBe(0);
    expect(resolved.custom.size).toBe(0);
  });

  it('does not carry the file name into the exercise it creates', () => {
    const resolved = partitionResolutions(['Row'], new Map([['Row', create('My row')]]), live);

    expect(resolved.custom.get('Row')).not.toHaveProperty('kind');
  });
});

describe('plannedBlocks', () => {
  it('keeps only blocks that resolved to an exercise and have sets', () => {
    const planned = plannedBlocks(
      session([
        block({ name: 'Squat' }),
        block({ name: 'Skipped' }),
        block({ name: 'Empty', sets: [] }),
      ]),
      new Map([
        ['Squat', 'fx-squat'],
        ['Empty', 'fx-empty'],
      ])
    );

    expect(planned.map((entry) => entry.exerciseId)).toEqual(['fx-squat']);
  });
});

describe('sessionStartedAt', () => {
  it('puts a day-only session at local noon and a timed one at its wall-clock minute', () => {
    expect(sessionStartedAt('2026-10-05', null)).toBe(new Date(2026, 9, 5, 12, 0).getTime());
    expect(sessionStartedAt('2026-10-05', 18 * 60 + 30)).toBe(
      new Date(2026, 9, 5, 18, 30).getTime()
    );
  });
});

describe('timed sets', () => {
  it('recognises a set that carries time or distance in place of reps', () => {
    expect(isTimedSet(set({ reps: 0, durationSeconds: 60 }))).toBe(true);
    expect(isTimedSet(set({ reps: 0, distanceM: 40 }))).toBe(true);
    expect(isTimedSet(set({ reps: 0 }))).toBe(false);
    expect(isTimedSet(set({ reps: 5, durationSeconds: 60 }))).toBe(false);
  });

  it('writes the time into the note once per distinct line, after the file note', () => {
    const notes = blockNotes(
      block({
        notes: 'felt strong\nfelt strong',
        sets: [
          set({ reps: 0, durationSeconds: 60 }),
          set({ reps: 0, durationSeconds: 60 }),
          set({ reps: 0, durationSeconds: 45.4, distanceM: 1250 }),
        ],
      })
    );

    expect(notes).toBe('felt strong\n60 s\n45 s\n1.25 km');
  });
});
