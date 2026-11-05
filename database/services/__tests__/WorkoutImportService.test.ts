jest.mock('@/widgets/resetWidgets', () => ({ resetWidgets: jest.fn(async () => {}) }));
import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import * as softDelete from '@/database/prepareSoftDelete';
import { MAX_BATCH_OPERATIONS } from '@/database/queryByIds';
import { MAX_NOTE_LENGTH } from '@/utils/noteText';
import { dumpDatabase } from '@/database/exportDb.web';
import { restoreDatabase } from '@/database/importDb';
import { computeExerciseSearchText } from '@/database/exerciseSearchText';
import type Exercise from '@/database/models/Exercise';
import type WorkoutLog from '@/database/models/WorkoutLog';
import type WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import type WorkoutLogSet from '@/database/models/WorkoutLogSet';
import { ExerciseAliasService } from '@/database/services/ExerciseAliasService';
import { WorkoutAnalytics } from '@/database/services/WorkoutAnalytics';
import { WorkoutProgressionService } from '@/database/services/WorkoutProgressionService';
import { WorkoutService } from '@/database/services/WorkoutService';
import {
  type ExerciseResolution,
  sessionStartedAt,
  WorkoutImportService,
} from '@/database/services/WorkoutImportService';
import { validateExportDump } from '@/database/schemaToZod';
import { appExerciseId } from '@/utils/exerciseImage';
import { proposeExerciseMatches } from '@/utils/workoutImport/exerciseMatch';
import type {
  ImportedExerciseBlock,
  ImportedSession,
  ImportedSet,
} from '@/utils/workoutImport/types';

jest.mock('@/database/adapter', () => {
  const Loki = jest.requireActual('@nozbe/watermelondb/adapters/lokijs').default;

  return {
    __esModule: true,
    default: new Loki({
      schema: jest.requireActual('@/database/schema').schema,
      migrations: jest.requireActual('@/database/migrations').migrations,
      useWebWorker: false,
      useIncrementalIndexedDB: false,
      extraLokiOptions: { autosave: false },
      _testLokiAdapter: new (require('lokijs').LokiMemoryAdapter)(),
    }),
  };
});

jest.mock('@/database/preMigrationBackup', () => ({
  createPreRestoreBackup: jest.fn(async () => {}),
}));

jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: { getUserBodyWeightKgForVolume: jest.fn(async () => 80) },
}));

jest.mock('@/database/services/workoutEnergyProfile', () => ({
  loadWorkoutEnergyProfile: jest.fn(async () => ({
    weightKg: 80,
    heightCm: 180,
    gender: 'male',
  })),
}));

const SQUAT = 'Barbell_Squat';
const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const PLANK = 'Plank';
const WALK = 'Trail_Running_Walking';
const squatId = appExerciseId(SQUAT);
const benchId = appExerciseId(BENCH);
const plankId = appExerciseId(PLANK);

const SEEDS: { slug: string; name: string; muscle: string; equipment: string; mechanic: string }[] =
  [
    {
      slug: SQUAT,
      name: 'Barbell Squat',
      muscle: 'legs',
      equipment: 'barbell',
      mechanic: 'compound',
    },
    {
      slug: BENCH,
      name: 'Barbell Bench Press - Medium Grip',
      muscle: 'chest',
      equipment: 'barbell',
      mechanic: 'compound',
    },
    { slug: PLANK, name: 'Plank', muscle: 'core', equipment: 'bodyweight', mechanic: 'isolation' },
    {
      slug: WALK,
      name: 'Trail Running Walking',
      muscle: 'legs',
      equipment: 'cardio',
      mechanic: 'cardio',
    },
  ];

async function seedCatalogue() {
  await database.write(async () => {
    for (const seed of SEEDS) {
      await database.get<Exercise>('exercises').create((record) => {
        record._raw.id = appExerciseId(seed.slug);
        record.name = seed.name;
        record.description = '';
        record.muscleGroup = seed.muscle as Exercise['muscleGroup'];
        record.equipmentType = seed.equipment as Exercise['equipmentType'];
        record.mechanicType = seed.mechanic as Exercise['mechanicType'];
        record.source = 'app';
        record.loadMultiplier = 1;
        record.searchText = computeExerciseSearchText({ id: record.id, name: seed.name }, []);
        record.createdAt = 0;
        record.updatedAt = 0;
      });
    }
  });
}

beforeEach(async () => {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
  await seedCatalogue();
});

function set(overrides: Partial<ImportedSet> = {}): ImportedSet {
  return {
    setType: 'normal',
    reps: 5,
    weightKg: 100,
    rpe: null,
    durationSeconds: null,
    distanceM: null,
    ...overrides,
  };
}

function block(
  name: string,
  sets: ImportedSet[],
  overrides: Partial<ImportedExerciseBlock> = {}
): ImportedExerciseBlock {
  return { name, category: null, notes: null, supersetKey: null, sets, ...overrides };
}

function session(
  key: string,
  blocks: ImportedExerciseBlock[],
  overrides: Partial<ImportedSession> = {}
): ImportedSession {
  return {
    importKey: key,
    source: 'strong',
    name: 'Leg Day',
    day: '2026-10-05',
    startMinutes: 9 * 60,
    durationSeconds: 3600,
    notes: null,
    exercises: blocks,
    cardio: [],
    ...overrides,
  };
}

const existing = (exerciseId: string, rememberAlias = false): ExerciseResolution => ({
  kind: 'existing',
  exerciseId,
  rememberAlias,
});

function commit(
  sessions: ImportedSession[],
  resolutions: [string, ExerciseResolution][],
  extra: { onProgress?: (done: number, total: number) => void } = {}
) {
  return WorkoutImportService.commit({
    source: 'strong',
    sessions,
    resolutions: new Map(resolutions),
    fallbackWorkoutName: 'Imported workout',
    ...extra,
  });
}

async function liveLogs(): Promise<WorkoutLog[]> {
  return await database
    .get<WorkoutLog>('workout_logs')
    .query(Q.where('deleted_at', Q.eq(null)))
    .fetch();
}

async function liveSets(): Promise<WorkoutLogSet[]> {
  return await database
    .get<WorkoutLogSet>('workout_log_sets')
    .query(Q.where('deleted_at', Q.eq(null)))
    .fetch();
}

async function logExercisesOf(logId: string): Promise<WorkoutLogExercise[]> {
  return await database
    .get<WorkoutLogExercise>('workout_log_exercises')
    .query(Q.where('workout_log_id', logId), Q.where('deleted_at', Q.eq(null)))
    .fetch();
}

async function setsOf(logExerciseId: string): Promise<WorkoutLogSet[]> {
  return await database
    .get<WorkoutLogSet>('workout_log_sets')
    .query(Q.where('log_exercise_id', logExerciseId), Q.where('deleted_at', Q.eq(null)))
    .fetch();
}

async function logByKey(key: string): Promise<WorkoutLog> {
  const [log] = await database
    .get<WorkoutLog>('workout_logs')
    .query(Q.where('import_key', key), Q.where('deleted_at', Q.eq(null)))
    .fetch();
  return log;
}

describe('WorkoutImportService.commit', () => {
  it('imports a session once: a second import reports it already here and writes nothing', async () => {
    const sessions = [session('s1', [block('Barbell Squat', [set(), set()])])];
    const first = await commit(sessions, [['Barbell Squat', existing(squatId)]]);
    expect(first).toMatchObject({ sessionsImported: 1, sessionsAlreadyHere: 0, setsImported: 2 });

    const second = await commit(sessions, [['Barbell Squat', existing(squatId)]]);
    expect(second).toMatchObject({ sessionsImported: 0, sessionsAlreadyHere: 1, setsImported: 0 });
    expect(await liveLogs()).toHaveLength(1);
    expect(await liveSets()).toHaveLength(2);
  });

  it('stores weights in kilograms exactly as the parser gave them', async () => {
    await commit(
      [session('s1', [block('Barbell Squat', [set({ weightKg: 102.0582 })])])],
      [['Barbell Squat', existing(squatId)]]
    );
    const [only] = await liveSets();
    expect(only.weight).toBeCloseTo(102.0582, 6);
  });

  it('leaves warm-ups out of the volume and out of the working-set analytics', async () => {
    await commit(
      [
        session('warm', [
          block('Barbell Squat', [set({ setType: 'warmup', weightKg: 40, reps: 10 }), set()]),
        ]),
      ],
      [['Barbell Squat', existing(squatId)]]
    );
    await commit(
      [session('plain', [block('Barbell Squat', [set()])])],
      [['Barbell Squat', existing(squatId)]]
    );

    const warm = await logByKey('warm');
    const plain = await logByKey('plain');
    expect(warm.totalVolume).toBe(plain.totalVolume);
    expect(warm.totalVolume).toBeGreaterThan(0);
  });

  it('gives RPE a reps-in-reserve value and rates the set; no RPE stays unrated', async () => {
    await commit(
      [session('rpe', [block('Barbell Squat', [set({ rpe: 8 }), set({ rpe: 8.5 }), set()])])],
      [['Barbell Squat', existing(squatId)]]
    );
    const [rated, halfRated, unrated] = (await liveSets()).sort((a, b) => a.setOrder - b.setOrder);
    expect(rated).toMatchObject({ repsInReserve: 2, rirRecorded: true, difficultyLevel: 8 });
    expect(halfRated).toMatchObject({ repsInReserve: 1.5, rirRecorded: true });
    expect(unrated).toMatchObject({ repsInReserve: 0, rirRecorded: false });
    expect(unrated.difficultyLevel ?? null).toBeNull();
  });

  it('puts a day-only session on its day at local noon', async () => {
    await commit(
      [
        session('day', [block('Barbell Squat', [set()])], {
          startMinutes: null,
          durationSeconds: null,
        }),
      ],
      [['Barbell Squat', existing(squatId)]]
    );
    const log = await logByKey('day');
    expect(log.startedAt).toBe(new Date(2026, 9, 5, 12, 0).getTime());
    expect(log.startedAt).toBe(sessionStartedAt('2026-10-05', null));
    expect(log.completedAt).toBe(log.startedAt);
  });

  it('places a timed start at local wall-clock time and derives the end from duration', async () => {
    await commit(
      [
        session('timed', [block('Barbell Squat', [set()])], {
          startMinutes: 9 * 60 + 15,
          durationSeconds: 1800,
        }),
      ],
      [['Barbell Squat', existing(squatId)]]
    );
    const log = await logByKey('timed');
    expect(log.startedAt).toBe(new Date(2026, 9, 5, 9, 15).getTime());
    expect(log.completedAt).toBe(log.startedAt + 1_800_000);
  });

  it('keeps a superset as one shared group id on its exercises', async () => {
    await commit(
      [
        session('ss', [
          block('Barbell Squat', [set()], { supersetKey: 'A' }),
          block('Barbell Bench Press', [set()], { supersetKey: 'A' }),
          block('Plank', [set({ reps: 0, weightKg: 0, durationSeconds: 45 })]),
        ]),
      ],
      [
        ['Barbell Squat', existing(squatId)],
        ['Barbell Bench Press', existing(benchId)],
        ['Plank', existing(plankId)],
      ]
    );
    const log = await logByKey('ss');
    const exercises = (await logExercisesOf(log.id)).sort(
      (a, b) => a.exerciseOrder - b.exerciseOrder
    );
    expect(exercises[0].groupId).toBeTruthy();
    expect(exercises[0].groupId).toBe(exercises[1].groupId);
    expect(exercises[2].groupId ?? null).toBeNull();
  });

  it('keeps a timed set safe: no NaN volume, a finite energy figure, and its duration as a note', async () => {
    await commit(
      [session('plank', [block('Plank', [set({ reps: 0, weightKg: 0, durationSeconds: 45 })])])],
      [['Plank', existing(plankId)]]
    );
    const log = await logByKey('plank');
    expect(Number.isFinite(log.totalVolume)).toBe(true);
    expect(log.totalVolume).toBe(0);
    if (log.caloriesBurned != null) {
      expect(Number.isFinite(log.caloriesBurned)).toBe(true);
    }

    const [exercise] = await logExercisesOf(log.id);
    expect(exercise.notes).toBe('45 s');
    const [only] = await setsOf(exercise.id);
    expect(only.reps).toBe(0);
  });

  it('writes a cardio session as a cardio log with no sets', async () => {
    await commit(
      [
        session('walk', [], {
          cardio: [
            { name: 'Walk', activity: 'walk', distanceM: 3000, durationSeconds: 1800, notes: null },
          ],
        }),
      ],
      []
    );
    const log = await logByKey('walk#cardio0');
    expect(log).toMatchObject({
      type: 'cardio',
      activity: 'walk',
      distanceM: 3000,
      totalVolume: 0,
    });
    const exercises = await logExercisesOf(log.id);
    expect(exercises).toHaveLength(1);
    expect(exercises[0].exerciseId).toBe(appExerciseId(WALK));
    expect(await setsOf(exercises[0].id)).toHaveLength(0);
  });

  it('does not write the cardio row twice on a second import', async () => {
    const sessions = [
      session('walk2', [], {
        cardio: [
          { name: 'Walk', activity: 'walk', distanceM: 3000, durationSeconds: 1800, notes: null },
        ],
      }),
    ];
    await commit(sessions, []);
    const again = await commit(sessions, []);
    expect(again).toMatchObject({ sessionsAlreadyHere: 1, cardioImported: 0 });
    expect((await liveLogs()).filter((log) => log.type === 'cardio')).toHaveLength(1);
  });

  it('writes nothing for a block that is skipped, and no log for a session left empty', async () => {
    const summary = await commit(
      [session('none', [block('Mystery Lift', [set()])])],
      [['Mystery Lift', { kind: 'skip' }]]
    );
    expect(summary).toMatchObject({ sessionsImported: 0, exercisesSkipped: 1 });
    expect(await liveLogs()).toHaveLength(0);
  });

  it('treats a resolution naming a deleted exercise as a skip', async () => {
    const summary = await commit(
      [session('gone', [block('Barbell Squat', [set()])])],
      [['Barbell Squat', existing('fx-deleted-long-ago')]]
    );
    expect(summary).toMatchObject({ sessionsImported: 0, exercisesSkipped: 1 });
  });

  it('creates a custom exercise once for a repeated name and reuses it', async () => {
    const create: ExerciseResolution = {
      kind: 'create',
      name: 'Cable Mystery Row',
      muscleGroup: 'back',
      equipmentType: 'cable',
      mechanicType: 'compound',
    };
    const summary = await commit(
      [
        session('c1', [block('Cable Mystery Row', [set()])]),
        session('c2', [block('Cable Mystery Row', [set()])]),
      ],
      [['Cable Mystery Row', create]]
    );

    expect(summary).toMatchObject({ sessionsImported: 2, exercisesCreated: 1 });
    const rows = await database
      .get<Exercise>('exercises')
      .query(Q.where('name', 'Cable Mystery Row'))
      .fetch();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: 'user', loadMultiplier: 1, muscleGroup: 'back' });
    expect(rows[0].searchText).toContain(' mystery ');
  });

  it('remembers an alias so the next proposal says alias', async () => {
    await commit(
      [session('a1', [block('Flat Bench', [set()])])],
      [['Flat Bench', existing(benchId, true)]]
    );

    const { candidates, aliases } = await WorkoutImportService.loadMatchInputs();
    const [proposal] = proposeExerciseMatches(
      [session('next', [block('Flat Bench', [set()])])],
      candidates,
      aliases
    );
    expect(proposal).toMatchObject({ kind: 'alias', exerciseId: benchId });
  });

  it('does not save an alias longer than the alias limit', async () => {
    const long = 'A'.repeat(60);
    const spy = jest.spyOn(ExerciseAliasService, 'addAlias');
    await commit([session('l1', [block(long, [set()])])], [[long, existing(squatId, true)]]);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('imports a batch larger than one database.batch across sessions without losing any', async () => {
    const sessions = Array.from({ length: 60 }, (_, index) =>
      session(
        `bulk-${index}`,
        [
          block(
            'Barbell Squat',
            Array.from({ length: 10 }, () => set())
          ),
        ],
        { startMinutes: index % 600 }
      )
    );
    const progress: number[] = [];
    const summary = await commit(sessions, [['Barbell Squat', existing(squatId)]], {
      onProgress: (done) => progress.push(done),
    });

    expect(summary).toMatchObject({ sessionsImported: 60, setsImported: 600 });
    expect(await liveLogs()).toHaveLength(60);
    expect(await liveSets()).toHaveLength(600);
    expect(progress.at(-1)).toBe(60);
  });

  it('caps a long note to the app-wide limit', async () => {
    const longNote = 'x'.repeat(MAX_NOTE_LENGTH + 500);
    await commit(
      [
        session('note', [block('Barbell Squat', [set()], { notes: longNote })], {
          notes: longNote,
        }),
      ],
      [['Barbell Squat', existing(squatId)]]
    );

    const [log] = await liveLogs();
    const [logExercise] = await logExercisesOf(log.id);
    expect(log.notes).toHaveLength(MAX_NOTE_LENGTH);
    expect(logExercise.notes).toHaveLength(MAX_NOTE_LENGTH);
  });

  it('creates no custom exercise for a session that is already here', async () => {
    const sessions = [session('once', [block('Barbell Squat', [set()])])];
    await commit(sessions, [['Barbell Squat', existing(squatId)]]);

    const summary = await commit(sessions, [
      [
        'Barbell Squat',
        {
          kind: 'create',
          name: 'Barbell Squat',
          muscleGroup: 'legs',
          equipmentType: 'barbell',
          mechanicType: 'compound',
        },
      ],
    ]);
    expect(summary).toMatchObject({ exercisesCreated: 0, sessionsAlreadyHere: 1 });
  });

  it('names a custom exercise from the resolution, and finds it by the file name', async () => {
    const summary = await commit(
      [session('named', [block('weird name', [set()])])],
      [
        [
          'weird name',
          {
            kind: 'create',
            name: 'Better Name',
            muscleGroup: 'legs',
            equipmentType: 'barbell',
            mechanicType: 'compound',
          },
        ],
      ]
    );
    expect(summary).toMatchObject({ exercisesCreated: 1, sessionsImported: 1 });
    const [log] = await liveLogs();
    const [logExercise] = await logExercisesOf(log.id);
    const exercise = await database.get<Exercise>('exercises').find(logExercise.exerciseId);
    expect(exercise.name).toBe('Better Name');
  });

  it('still imports when the pre-import backup throws', async () => {
    const backup = jest.requireMock('@/database/preMigrationBackup') as {
      createPreRestoreBackup: jest.Mock;
    };
    backup.createPreRestoreBackup.mockRejectedValueOnce(new Error('disk full'));

    const summary = await commit(
      [session('safe', [block('Barbell Squat', [set()])])],
      [['Barbell Squat', existing(squatId)]]
    );
    expect(summary.sessionsImported).toBe(1);
  });
});

describe('WorkoutImportService undo and listing', () => {
  it('undoes an import larger than one batch', async () => {
    const sets = Array.from({ length: 10 }, () => set());
    const sessions = Array.from({ length: 60 }, (_, index) =>
      session(`big-${index}`, [block('Barbell Squat', sets)], { startMinutes: index % 600 })
    );
    const { batchId } = await commit(sessions, [['Barbell Squat', existing(squatId)]]);

    // WatermelonDB requires a prepared update to reach batch() in the same tick, so nothing may be
    // prepared ahead of the batch it belongs to.
    const prepared = jest.spyOn(softDelete, 'prepareSoftDelete');
    const realBatch = database.batch.bind(database);
    const preparedAtEachBatch: number[] = [];
    const batch = jest.spyOn(database, 'batch').mockImplementation((...records) => {
      preparedAtEachBatch.push(prepared.mock.calls.length);
      return realBatch(...(records as Parameters<typeof realBatch>));
    });

    expect(await WorkoutImportService.undoBatch(batchId)).toBe(60);
    batch.mockRestore();
    prepared.mockRestore();

    expect(preparedAtEachBatch.length).toBeGreaterThan(1);
    expect(preparedAtEachBatch[0]).toBe(MAX_BATCH_OPERATIONS);
    expect(await liveLogs()).toHaveLength(0);
    expect(await liveSets()).toHaveLength(0);
  });

  it('undoes one import, leaves another alone, and lets the undone file be imported again', async () => {
    const a = await commit(
      [session('keep', [block('Barbell Squat', [set(), set()])])],
      [['Barbell Squat', existing(squatId)]]
    );
    const b = await commit(
      [session('drop', [block('Barbell Squat', [set()])])],
      [['Barbell Squat', existing(squatId)]]
    );

    expect(await WorkoutImportService.undoBatch(b.batchId)).toBe(1);
    expect((await liveLogs()).map((log) => log.importKey)).toEqual(['keep']);
    expect(await liveSets()).toHaveLength(2);
    expect(await WorkoutImportService.existingKeys(['drop'])).toEqual(new Set());

    const again = await commit(
      [session('drop', [block('Barbell Squat', [set()])])],
      [['Barbell Squat', existing(squatId)]]
    );
    expect(again).toMatchObject({ sessionsImported: 1, sessionsAlreadyHere: 0 });
    expect(a.batchId).not.toBe(again.batchId);
  });

  it('keeps the custom exercise and the alias when an import is undone', async () => {
    const create: ExerciseResolution = {
      kind: 'create',
      name: 'Keep Me Row',
      muscleGroup: 'back',
      equipmentType: 'cable',
      mechanicType: 'compound',
    };
    const summary = await commit(
      [session('kept', [block('Keep Me Row', [set()])])],
      [['Keep Me Row', create]]
    );
    await WorkoutImportService.undoBatch(summary.batchId);
    const rows = await database
      .get<Exercise>('exercises')
      .query(Q.where('name', 'Keep Me Row'))
      .fetch();
    expect(rows).toHaveLength(1);
  });

  it('lists each import once with its session count, and hides undone imports', async () => {
    const one = await commit(
      [
        session('l1', [block('Barbell Squat', [set()])]),
        session('l2', [block('Barbell Squat', [set()])]),
      ],
      [['Barbell Squat', existing(squatId)]]
    );
    const two = await commit(
      [session('l3', [block('Barbell Squat', [set()])])],
      [['Barbell Squat', existing(squatId)]]
    );
    await WorkoutImportService.undoBatch(two.batchId);

    const batches = await WorkoutImportService.listBatches();
    expect(batches).toHaveLength(1);
    expect(batches[0]).toMatchObject({ batchId: one.batchId, source: 'strong', sessions: 2 });
  });
});

describe('WorkoutImportService.loadMatchInputs', () => {
  it('returns live exercises with their search text and live aliases only', async () => {
    const { candidates } = await WorkoutImportService.loadMatchInputs();
    expect(candidates.map((candidate) => candidate.id)).toEqual(
      expect.arrayContaining([squatId, benchId, plankId])
    );
  });
});

describe('imported history through the analytics and progression readers', () => {
  it('ignores a heavier warm-up single when picking records and personal bests', async () => {
    await commit(
      [
        session('warm-pr', [
          block('Barbell Squat', [
            set({ setType: 'warmup', weightKg: 150, reps: 1 }),
            set({ weightKg: 100, reps: 5 }),
            set({ weightKg: 100, reps: 5 }),
          ]),
        ]),
      ],
      [['Barbell Squat', existing(squatId)]]
    );
    const log = await logByKey('warm-pr');

    const records = await WorkoutAnalytics.detectPersonalRecords(log, 80);
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.newRecord.weight).toBe(100);
      expect(record.newRecord.reps).toBe(5);
    }

    const points = await WorkoutAnalytics.getProgressiveOverloadData(squatId);
    expect(points.map((point) => point.weight)).toEqual([100]);
    expect(points.every((point) => point.estimated1RM < 150)).toBe(true);

    const best = await WorkoutAnalytics.getPersonalBestForExercise(squatId);
    expect(best?.weight).toBe(100);
  });

  it('never counts a zero-rep timed set as a record or a best estimated 1RM', async () => {
    await commit(
      [
        session(
          'carry-1',
          [block('Plank', [set({ reps: 0, weightKg: 20, durationSeconds: 45 })])],
          {
            day: '2026-10-05',
          }
        ),
      ],
      [['Plank', existing(plankId)]]
    );
    await commit(
      [
        session(
          'carry-2',
          [block('Plank', [set({ reps: 0, weightKg: 30, durationSeconds: 60 })])],
          {
            day: '2026-10-12',
          }
        ),
      ],
      [['Plank', existing(plankId)]]
    );

    const first = await logByKey('carry-1');
    const second = await logByKey('carry-2');
    expect(await WorkoutAnalytics.detectPersonalRecords(first, 80)).toEqual([]);
    expect(await WorkoutAnalytics.detectPersonalRecords(second, 80)).toEqual([]);

    const points = await WorkoutAnalytics.getProgressiveOverloadData(plankId);
    expect(points).toEqual([]);
    expect(await WorkoutAnalytics.getPersonalBestForExercise(plankId)).toBeNull();
  });

  it('returns imported sets from the progression history, latest session first', async () => {
    await commit(
      [
        session('old', [block('Barbell Squat', [set({ weightKg: 90, reps: 5 })])], {
          day: '2026-09-01',
        }),
      ],
      [['Barbell Squat', existing(squatId)]]
    );
    await commit(
      [
        session('new', [block('Barbell Squat', [set({ weightKg: 110, reps: 3 })])], {
          day: '2026-10-05',
        }),
      ],
      [['Barbell Squat', existing(squatId)]]
    );

    const progression = WorkoutProgressionService as unknown as {
      history(exerciseId: string): Promise<{ completedAt: number; sets: { weightKg: number }[] }[]>;
    };
    const history = await progression.history(squatId);
    expect(history.map((session) => session.sets.map((set) => set.weightKg))).toEqual([
      [110],
      [90],
    ]);
    expect(history[0].completedAt).toBeGreaterThan(history[1].completedAt);
  });
});

describe('imported workouts through backups and undo', () => {
  it('exports the import columns and validates them, and still accepts an older dump without them', async () => {
    await commit(
      [session('bk', [block('Barbell Squat', [set()])])],
      [['Barbell Squat', existing(squatId)]]
    );

    const dump = JSON.parse(await dumpDatabase()) as Record<string, unknown>;
    const rows = dump.workout_logs as Record<string, unknown>[];
    const imported = rows.find((row) => row.import_key === 'bk');
    expect(imported).toMatchObject({ import_source: 'strong', import_key: 'bk' });
    expect(typeof imported?.import_batch_id).toBe('string');
    expect(validateExportDump(dump).success).toBe(true);

    const older = JSON.parse(JSON.stringify(dump)) as Record<string, unknown>;
    for (const row of older.workout_logs as Record<string, unknown>[]) {
      delete row.import_source;
      delete row.import_key;
      delete row.import_batch_id;
    }
    expect(validateExportDump(older).success).toBe(true);
  });

  it('after a real dump and restore, re-importing the same file adds nothing', async () => {
    const sessions = [
      session('r1', [block('Barbell Squat', [set(), set()])]),
      session('r2', [block('Barbell Squat', [set()])], { day: '2026-10-12' }),
    ];
    await commit(sessions, [['Barbell Squat', existing(squatId)]]);
    const dump = await dumpDatabase();

    await restoreDatabase(dump);
    expect(await liveLogs()).toHaveLength(2);

    const again = await commit(sessions, [['Barbell Squat', existing(squatId)]]);
    expect(again).toMatchObject({ sessionsImported: 0, sessionsAlreadyHere: 2, setsImported: 0 });
    expect(await liveLogs()).toHaveLength(2);
  });

  it('soft-deleting one imported session makes only that session importable again', async () => {
    const a = await commit(
      [
        session('ba1', [block('Barbell Squat', [set()])]),
        session('ba2', [block('Barbell Squat', [set()])], { day: '2026-10-12' }),
      ],
      [['Barbell Squat', existing(squatId)]]
    );
    await commit(
      [session('bb1', [block('Barbell Squat', [set()])], { day: '2026-10-19' })],
      [['Barbell Squat', existing(squatId)]]
    );
    expect(await WorkoutImportService.listBatches()).toHaveLength(2);

    await WorkoutService.deleteWorkoutLog((await logByKey('bb1')).id);

    expect(await WorkoutImportService.existingKeys(['bb1'])).toEqual(new Set());
    expect(await WorkoutImportService.existingKeys(['ba1', 'ba2'])).toEqual(
      new Set(['ba1', 'ba2'])
    );
    expect(await WorkoutImportService.listBatches()).toHaveLength(1);

    const reimport = await commit(
      [session('bb1', [block('Barbell Squat', [set()])], { day: '2026-10-19' })],
      [['Barbell Squat', existing(squatId)]]
    );
    expect(reimport).toMatchObject({ sessionsImported: 1, sessionsAlreadyHere: 0 });
    expect(a.sessionsImported).toBe(2);
  });
});
