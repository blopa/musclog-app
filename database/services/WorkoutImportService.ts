import { type Model, Q } from '@nozbe/watermelondb';
import { randomUUID } from 'expo-crypto';

import { database } from '@/database/database-instance';
import { computeExerciseSearchText } from '@/database/exerciseSearchText';
import type Exercise from '@/database/models/Exercise';
import type ExerciseAlias from '@/database/models/ExerciseAlias';
import type WorkoutLog from '@/database/models/WorkoutLog';
import type WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import type WorkoutLogSet from '@/database/models/WorkoutLogSet';
import { createPreRestoreBackup } from '@/database/preMigrationBackup';
import { prepareSoftDelete } from '@/database/prepareSoftDelete';
import { chunked, fetchByIds, MAX_BATCH_OPERATIONS } from '@/database/queryByIds';
import { estimateCardioKcal } from '@/utils/cardioEnergy';
import { appExerciseId } from '@/utils/exerciseImage';
import { normalizeNote } from '@/utils/noteText';
import { repsInReserveFromRpe, writeSetEffort } from '@/utils/setEffort';
import { getTimezoneAt } from '@/utils/timezone';
import { calculateSessionVolumeFromSets, type ExerciseVolumeData } from '@/utils/workoutCalculator';
import {
  blockNotes,
  type CustomExerciseSpec,
  distinctBlockNames,
  type ExerciseResolution,
  isTimedSet,
  partitionResolutions,
  type PlannedBlock,
  plannedBlocks,
  sessionStartedAt,
} from '@/utils/workoutImport/commitPlan';
import type {
  ExerciseMatchCandidate,
  SavedExerciseAlias,
} from '@/utils/workoutImport/exerciseMatch';
import {
  CARDIO_KEY_INFIX,
  cardioImportKey,
  isSessionPresent,
  sessionImportKeys,
} from '@/utils/workoutImport/importKey';
import type {
  ImportedSession,
  ImportSummary,
  WorkoutImportSource,
} from '@/utils/workoutImport/types';
import {
  estimateWorkoutKcalFromSets,
  type WorkoutEnergyProfile,
} from '@/utils/workoutKcalEstimate';

import { CARDIO_CATALOGUE_SLUGS } from './CardioLogService';
import { ExerciseAliasService, MAX_EXERCISE_ALIAS_LENGTH } from './ExerciseAliasService';
import { UserMetricService } from './UserMetricService';
import { loadWorkoutEnergyProfile } from './workoutEnergyProfile';

export interface ImportCommitInput {
  source: WorkoutImportSource;
  sessions: readonly ImportedSession[];
  resolutions: ReadonlyMap<string, ExerciseResolution>;
  /** Translated, for a session the file gives no name. */
  fallbackWorkoutName: string;
  onProgress?: (done: number, total: number) => void;
}

export interface ImportBatch {
  batchId: string;
  source: string;
  sessions: number;
  firstStartedAt: number;
  lastStartedAt: number;
  importedAt: number;
}

/** What a row needs from an exercise to compute volume and energy. */
type ExerciseInfo = Pick<
  Exercise,
  'id' | 'mechanicType' | 'muscleGroup' | 'equipmentType' | 'loadMultiplier'
>;

/** What the writers share. Built once per import, so no session rebuilds a lookup. */
interface CommitContext {
  source: WorkoutImportSource;
  batchId: string;
  now: number;
  fallbackWorkoutName: string;
  profile: WorkoutEnergyProfile | null;
  bodyWeightKg: number;
  exerciseIdByName: ReadonlyMap<string, string>;
  volumeByExercise: Map<string, ExerciseVolumeData>;
  exercises: ExerciseInfo[];
}

/** The base key of a stored log: a cardio row's key is the session key plus its suffix. */
function sessionKeyOf(storedKey: string): string {
  const at = storedKey.indexOf(CARDIO_KEY_INFIX);
  return at === -1 ? storedKey : storedKey.slice(0, at);
}

interface ImportedLogFields {
  workoutName: string;
  type: 'free' | 'cardio';
  importKey: string;
  startedAt: number;
  durationSeconds: number | null;
  totalVolume: number;
  kcal: number;
  notes: string | null;
  cardio?: { activity: 'walk' | 'run'; distanceM: number };
}

/** The `workout_logs` row of an imported session, strength or cardio. */
function prepareImportedLog(ctx: CommitContext, fields: ImportedLogFields): WorkoutLog {
  return database.get<WorkoutLog>('workout_logs').prepareCreate((record) => {
    record.workoutName = fields.workoutName;
    record.type = fields.type;
    record.startedAt = fields.startedAt;
    record.completedAt = fields.startedAt + Math.round((fields.durationSeconds ?? 0) * 1000);
    record.timezone = getTimezoneAt(fields.startedAt);
    record.totalVolume = fields.totalVolume;
    record.caloriesBurned = fields.kcal > 0 ? fields.kcal : undefined;
    record.notes = normalizeNote(fields.notes);
    record.importSource = ctx.source;
    record.importKey = fields.importKey;
    record.importBatchId = ctx.batchId;
    record.createdAt = ctx.now;
    record.updatedAt = ctx.now;
    if (fields.cardio) {
      record.activity = fields.cardio.activity;
      record.distanceM = fields.cardio.distanceM;
    }
  });
}

function prepareLogExercise(
  ctx: CommitContext,
  logId: string,
  exerciseId: string,
  exerciseOrder: number,
  extra: { groupId?: string; notes?: string } = {}
): WorkoutLogExercise {
  return database.get<WorkoutLogExercise>('workout_log_exercises').prepareCreate((record) => {
    record.workoutLogId = logId;
    record.exerciseId = exerciseId;
    record.exerciseOrder = exerciseOrder;
    record.groupId = extra.groupId;
    record.notes = extra.notes;
    record.createdAt = ctx.now;
    record.updatedAt = ctx.now;
  });
}

function strengthTotals(
  planned: PlannedBlock[],
  ctx: CommitContext
): { totalVolume: number; kcal: number } {
  const performed = planned.flatMap(({ exerciseId, sets }) =>
    sets.map((set) => ({
      exerciseId,
      weight: set.weightKg,
      reps: set.reps,
      completionStatus: 'performed' as const,
      setType: set.setType,
    }))
  );

  // A timed set has no reps to lift, and the 1RM formula would give a bodyweight plank real volume.
  const totalVolume = calculateSessionVolumeFromSets(
    performed.filter((set) => set.reps > 0),
    ctx.volumeByExercise,
    ctx.bodyWeightKg,
    { onlyCompletedSets: true }
  );
  const kcal = ctx.profile ? estimateWorkoutKcalFromSets(ctx.profile, performed, ctx.exercises) : 0;

  return { totalVolume, kcal };
}

function prepareStrengthLog(
  session: ImportedSession,
  startedAt: number,
  planned: PlannedBlock[],
  ctx: CommitContext
): { ops: Model[]; setCount: number; timedSets: number } {
  const { totalVolume, kcal } = strengthTotals(planned, ctx);
  const log = prepareImportedLog(ctx, {
    workoutName: session.name || ctx.fallbackWorkoutName,
    type: 'free',
    importKey: session.importKey,
    startedAt,
    durationSeconds: session.durationSeconds,
    totalVolume,
    kcal,
    notes: session.notes,
  });

  const ops: Model[] = [log];
  const groupIdBySuperset = new Map<string, string>();
  const groupIdFor = (supersetKey: string | null): string | undefined => {
    if (!supersetKey) {
      return undefined;
    }

    const known = groupIdBySuperset.get(supersetKey);
    if (known) {
      return known;
    }

    const created = randomUUID();
    groupIdBySuperset.set(supersetKey, created);
    return created;
  };

  let setOrder = 0;
  let timedSets = 0;

  planned.forEach(({ block, exerciseId, sets }, exerciseOrder) => {
    const logExercise = prepareLogExercise(ctx, log.id, exerciseId, exerciseOrder, {
      groupId: groupIdFor(block.supersetKey),
      notes: blockNotes(block),
    });
    ops.push(logExercise);

    for (const set of sets) {
      setOrder += 1;
      if (isTimedSet(set)) {
        timedSets += 1;
      }

      ops.push(
        database.get<WorkoutLogSet>('workout_log_sets').prepareCreate((record) => {
          record.logExerciseId = logExercise.id;
          record.reps = set.reps;
          record.weight = set.weightKg;
          record.partials = 0;
          record.restTimeAfter = 0;
          writeSetEffort(record, repsInReserveFromRpe(set.rpe));
          record.completionStatus = 'performed';
          record.difficultyLevel = set.rpe ?? undefined;
          record.setType = set.setType;
          record.setOrder = setOrder;
          record.createdAt = ctx.now;
          record.updatedAt = ctx.now;
        })
      );
    }
  });

  return { ops, setCount: setOrder, timedSets };
}

function prepareCardioLogs(
  session: ImportedSession,
  startedAt: number,
  ctx: CommitContext
): Model[] {
  return session.cardio.flatMap((cardio, index) => {
    const durationS = cardio.durationSeconds ?? 0;
    const kcal =
      ctx.bodyWeightKg > 0
        ? estimateCardioKcal({
            activity: cardio.activity,
            distanceM: cardio.distanceM,
            durationS,
            bodyMassKg: ctx.bodyWeightKg,
          })
        : 0;
    const log = prepareImportedLog(ctx, {
      workoutName: cardio.name || session.name || ctx.fallbackWorkoutName,
      type: 'cardio',
      importKey: cardioImportKey(session.importKey, index),
      startedAt,
      durationSeconds: durationS,
      totalVolume: 0,
      kcal,
      notes: cardio.notes,
      cardio: { activity: cardio.activity, distanceM: cardio.distanceM },
    });
    const exerciseId = appExerciseId(CARDIO_CATALOGUE_SLUGS.outdoor[cardio.activity]);

    return [log, prepareLogExercise(ctx, log.id, exerciseId, 0)];
  });
}

interface SessionWrites {
  ops: Model[];
  setCount: number;
  cardioCount: number;
  timedSets: number;
}

/** Prepares everything one session writes. Empty `ops` means the session wrote nothing. */
function prepareSession(session: ImportedSession, ctx: CommitContext): SessionWrites {
  const planned = plannedBlocks(session, ctx.exerciseIdByName);
  const startedAt = sessionStartedAt(session.day, session.startMinutes);
  const strength =
    planned.length > 0
      ? prepareStrengthLog(session, startedAt, planned, ctx)
      : { ops: [], setCount: 0, timedSets: 0 };

  return {
    ops: [...strength.ops, ...prepareCardioLogs(session, startedAt, ctx)],
    setCount: strength.setCount,
    cardioCount: session.cardio.length,
    timedSets: strength.timedSets,
  };
}

async function loadExerciseInfos(ids: readonly string[]): Promise<Map<string, ExerciseInfo>> {
  const rows = await fetchByIds<Exercise>(
    'exercises',
    'id',
    ids,
    Q.where('deleted_at', Q.eq(null))
  );
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * Prepares the custom exercises a file needs, one row per distinct name. Returns the id to use for
 * each file name and the row facts the volume and energy maths need.
 */
function prepareCustomExercises(specs: readonly [fileName: string, spec: CustomExerciseSpec][]): {
  ops: Model[];
  idByName: Map<string, string>;
  infos: ExerciseInfo[];
} {
  const ops: Model[] = [];
  const idByName = new Map<string, string>();
  const infos: ExerciseInfo[] = [];
  const now = Date.now();

  for (const [fileName, spec] of specs) {
    const exercise = database.get<Exercise>('exercises').prepareCreate((record) => {
      record.name = spec.name;
      record.description = '';
      record.imageUrl = undefined;
      record.muscleGroup = spec.muscleGroup;
      record.equipmentType = spec.equipmentType;
      record.mechanicType = spec.mechanicType;
      record.source = 'user';
      record.loadMultiplier = 1;
      record.searchText = computeExerciseSearchText(record, []);
      record.createdAt = now;
      record.updatedAt = now;
    });
    ops.push(exercise);
    idByName.set(fileName, exercise.id);
    infos.push({
      id: exercise.id,
      mechanicType: spec.mechanicType,
      muscleGroup: spec.muscleGroup,
      equipmentType: spec.equipmentType,
      loadMultiplier: 1,
    });
  }

  return { ops, idByName, infos };
}

type ImportTotals = Omit<ImportSummary, 'batchId' | 'exercisesCreated' | 'exercisesSkipped'>;

/**
 * Writes the import's sessions. Sessions are packed into `database.batch` calls at session
 * boundaries, so a crash leaves whole sessions behind and importing the same file again fills in
 * the rest.
 */
async function writeSessions(
  sessions: readonly ImportedSession[],
  ctx: CommitContext,
  liveKeys: ReadonlySet<string>,
  onProgress: ((done: number, total: number) => void) | undefined
): Promise<ImportTotals> {
  const totals: ImportTotals = {
    sessionsImported: 0,
    sessionsAlreadyHere: 0,
    setsImported: 0,
    cardioImported: 0,
    timedSets: 0,
  };
  // A key repeated inside the file counts as already here once its first session is queued.
  const seenKeys = new Set(liveKeys);
  let pending: Model[] = [];
  let pendingSessions = 0;
  let done = 0;

  const flush = async () => {
    if (pending.length === 0) {
      return;
    }

    await database.batch(...pending);
    done += pendingSessions;
    onProgress?.(done, sessions.length);
    pending = [];
    pendingSessions = 0;
  };

  for (const session of sessions) {
    if (isSessionPresent(session, seenKeys)) {
      totals.sessionsAlreadyHere += 1;
      done += 1;
      continue;
    }

    const writes = prepareSession(session, ctx);
    if (writes.ops.length === 0) {
      done += 1;
      continue;
    }

    if (pending.length > 0 && pending.length + writes.ops.length > MAX_BATCH_OPERATIONS) {
      await flush();
    }

    pending.push(...writes.ops);
    pendingSessions += 1;
    totals.sessionsImported += 1;
    totals.setsImported += writes.setCount;
    totals.cardioImported += writes.cardioCount;
    totals.timedSets += writes.timedSets;
    seenKeys.add(session.importKey);
  }

  await flush();
  return totals;
}

export class WorkoutImportService {
  /** Keys already present on a live log. Soft-deleted logs are ignored so an undo can be re-imported. */
  static async existingKeys(keys: readonly string[]): Promise<Set<string>> {
    const rows = await fetchByIds<WorkoutLog>(
      'workout_logs',
      'import_key',
      keys,
      Q.where('deleted_at', Q.eq(null))
    );
    return new Set(rows.map((row) => row.importKey).filter((key): key is string => Boolean(key)));
  }

  /** The candidates and saved aliases `proposeExerciseMatches` needs. */
  static async loadMatchInputs(): Promise<{
    candidates: ExerciseMatchCandidate[];
    aliases: SavedExerciseAlias[];
  }> {
    const [exercises, aliases] = await Promise.all([
      database
        .get<Exercise>('exercises')
        .query(Q.where('deleted_at', Q.eq(null)))
        .fetch(),
      database
        .get<ExerciseAlias>('exercise_aliases')
        .query(Q.where('deleted_at', Q.eq(null)))
        .fetch(),
    ]);

    return {
      candidates: exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        searchText: exercise.searchText ?? null,
      })),
      aliases: aliases.map((alias) => ({ alias: alias.alias, exerciseId: alias.exerciseId })),
    };
  }

  static async commit(input: ImportCommitInput): Promise<ImportSummary> {
    const batchId = randomUUID();
    // Best effort: a failed safety copy must never block the import itself.
    try {
      await createPreRestoreBackup();
    } catch (error) {
      console.warn('Pre-import backup failed; importing anyway:', error);
    }

    const [profile, bodyWeightKg] = await Promise.all([
      loadWorkoutEnergyProfile(),
      UserMetricService.getUserBodyWeightKgForVolume(),
    ]);

    const chosenIds = [...input.resolutions.values()].flatMap((resolution) =>
      resolution.kind === 'existing' ? [resolution.exerciseId] : []
    );
    const existingInfos = await loadExerciseInfos(chosenIds);
    const names = distinctBlockNames(input.sessions);
    const resolved = partitionResolutions(names, input.resolutions, existingInfos);

    const { totals, exercisesCreated } = await database.write(async () => {
      const liveKeys = await WorkoutImportService.existingKeys(
        input.sessions.flatMap(sessionImportKeys)
      );

      // A session already here writes nothing, so it must not leave a new exercise behind either.
      const namesToWrite = new Set(
        distinctBlockNames(input.sessions.filter((session) => !isSessionPresent(session, liveKeys)))
      );
      const custom = prepareCustomExercises(
        [...resolved.custom].filter(([fileName]) => namesToWrite.has(fileName))
      );
      for (const chunk of chunked(custom.ops, MAX_BATCH_OPERATIONS)) {
        await database.batch(...chunk);
      }

      const infoById = new Map(existingInfos);
      for (const info of custom.infos) {
        infoById.set(info.id, info);
      }

      const ctx: CommitContext = {
        source: input.source,
        batchId,
        now: Date.now(),
        fallbackWorkoutName: input.fallbackWorkoutName,
        profile,
        bodyWeightKg,
        exerciseIdByName: new Map([
          ...[...resolved.existing].map(([name, { exerciseId }]): [string, string] => [
            name,
            exerciseId,
          ]),
          ...custom.idByName,
        ]),
        volumeByExercise: new Map(
          [...infoById].map(([id, info]) => [id, { equipmentType: info.equipmentType }])
        ),
        exercises: [...infoById.values()],
      };

      return {
        totals: await writeSessions(input.sessions, ctx, liveKeys, input.onProgress),
        exercisesCreated: custom.ops.length,
      };
    });

    // Remembering aliases happens after the import, and a failure here does not undo it.
    for (const [name, { exerciseId, rememberAlias }] of resolved.existing) {
      if (!rememberAlias || name.trim().length > MAX_EXERCISE_ALIAS_LENGTH) {
        continue;
      }

      try {
        await ExerciseAliasService.addAlias(exerciseId, name);
      } catch (error) {
        console.warn('Could not remember an import exercise alias:', error);
      }
    }

    return { batchId, ...totals, exercisesCreated, exercisesSkipped: resolved.skipped.size };
  }

  static async listBatches(): Promise<ImportBatch[]> {
    const logs = await database
      .get<WorkoutLog>('workout_logs')
      .query(Q.where('import_batch_id', Q.notEq(null)), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    const groups = new Map<
      string,
      { source: string; sessionKeys: Set<string>; first: number; last: number; importedAt: number }
    >();
    for (const log of logs) {
      const batchId = log.importBatchId;
      if (!batchId) {
        continue;
      }

      const group = groups.get(batchId) ?? {
        source: log.importSource ?? '',
        sessionKeys: new Set<string>(),
        first: log.startedAt,
        last: log.startedAt,
        importedAt: log.createdAt,
      };
      group.sessionKeys.add(sessionKeyOf(log.importKey ?? log.id));
      group.first = Math.min(group.first, log.startedAt);
      group.last = Math.max(group.last, log.startedAt);
      group.importedAt = Math.min(group.importedAt, log.createdAt);
      groups.set(batchId, group);
    }

    return [...groups]
      .map(([batchId, group]) => ({
        batchId,
        source: group.source,
        sessions: group.sessionKeys.size,
        firstStartedAt: group.first,
        lastStartedAt: group.last,
        importedAt: group.importedAt,
      }))
      .sort((a, b) => b.importedAt - a.importedAt);
  }

  /**
   * Soft-deletes everything one import wrote: its logs, their exercises and their sets. Custom
   * exercises and saved aliases are deliberately kept, since the user may still use them, and a
   * re-import reuses them.
   */
  static async undoBatch(batchId: string): Promise<number> {
    return await database.write(async () => {
      const logs = await database
        .get<WorkoutLog>('workout_logs')
        .query(Q.where('import_batch_id', batchId), Q.where('deleted_at', Q.eq(null)))
        .fetch();
      if (logs.length === 0) {
        return 0;
      }

      const logIds = logs.map((log) => log.id);
      const logExercises = await fetchByIds<WorkoutLogExercise>(
        'workout_log_exercises',
        'workout_log_id',
        logIds,
        Q.where('deleted_at', Q.eq(null))
      );
      const sets = await fetchByIds<WorkoutLogSet>(
        'workout_log_sets',
        'log_exercise_id',
        logExercises.map((logExercise) => logExercise.id),
        Q.where('deleted_at', Q.eq(null))
      );

      const now = Date.now();
      // Prepared per chunk: WatermelonDB requires a prepared update to reach batch() in the same tick.
      for (const chunk of chunked([...logs, ...logExercises, ...sets], MAX_BATCH_OPERATIONS)) {
        await database.batch(...chunk.map((record) => prepareSoftDelete(record, now)));
      }

      return logs.length;
    });
  }
}
