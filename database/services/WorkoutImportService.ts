import { type Model, Q } from '@nozbe/watermelondb';
import { randomUUID } from 'expo-crypto';

import { database } from '@/database/database-instance';
import { computeExerciseSearchText } from '@/database/exerciseSearchText';
import type Exercise from '@/database/models/Exercise';
import type { EquipmentType, MechanicType, MuscleGroup } from '@/database/models/Exercise';
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
import { writeSetEffort } from '@/utils/setEffort';
import { getTimezoneAt } from '@/utils/timezone';
import { calculateSessionVolumeFromSets, type ExerciseVolumeData } from '@/utils/workoutCalculator';
import type {
  ExerciseMatchCandidate,
  SavedExerciseAlias,
} from '@/utils/workoutImport/exerciseMatch';
import {
  CARDIO_KEY_INFIX,
  cardioImportKey,
  sessionImportKeys,
} from '@/utils/workoutImport/importKey';
import type {
  ImportedExerciseBlock,
  ImportedSession,
  ImportedSet,
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

/** What to do with one exercise name from the file. Keyed by the file's exact name. */
export type ExerciseResolution =
  | { kind: 'existing'; exerciseId: string; rememberAlias: boolean }
  | {
      kind: 'create';
      name: string;
      muscleGroup: MuscleGroup;
      equipmentType: EquipmentType;
      mechanicType: MechanicType;
    }
  | { kind: 'skip' };

export interface ImportCommitInput {
  source: WorkoutImportSource;
  sessions: readonly ImportedSession[];
  resolutions: ReadonlyMap<string, ExerciseResolution>;
  /** Translated, for a session the file gives no name. */
  fallbackWorkoutName: string;
  onProgress?: (done: number, total: number) => void;
}

export interface ImportSummary {
  batchId: string;
  sessionsImported: number;
  sessionsAlreadyHere: number;
  setsImported: number;
  cardioImported: number;
  exercisesCreated: number;
  exercisesSkipped: number;
  timedSets: number;
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

/** The base key of a stored log: a cardio row's key is the session key plus its suffix. */
function sessionKeyOf(storedKey: string): string {
  const at = storedKey.indexOf(CARDIO_KEY_INFIX);
  return at === -1 ? storedKey : storedKey.slice(0, at);
}

/**
 * The session's start in local time. A day-only file gets local noon, so the workout stays on its
 * day in every timezone.
 */
export function sessionStartedAt(day: string, startMinutes: number | null): number {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  if (startMinutes === null) {
    return new Date(year, month - 1, dayOfMonth, 12, 0).getTime();
  }

  return new Date(year, month - 1, dayOfMonth, 0, startMinutes).getTime();
}

function timedNoteLines(set: ImportedSet): string[] {
  if (set.reps > 0) {
    return [];
  }

  // Language-neutral on purpose: a note written in the file's own units, not translated copy.
  const lines: string[] = [];
  if (set.durationSeconds !== null && set.durationSeconds > 0) {
    lines.push(`${Math.round(set.durationSeconds)} s`);
  }

  if (set.distanceM !== null && set.distanceM > 0) {
    lines.push(`${Math.round(set.distanceM / 10) / 100} km`);
  }

  return lines;
}

function blockNotes(block: ImportedExerciseBlock): string | undefined {
  const lines = new Set<string>();
  for (const line of (block.notes ?? '').split('\n')) {
    if (line.trim()) {
      lines.add(line.trim());
    }
  }

  for (const set of block.sets) {
    for (const line of timedNoteLines(set)) {
      lines.add(line);
    }
  }

  return normalizeNote([...lines].join('\n'));
}

/** RPE 8 is two reps in reserve. Unrated stays null, never a fabricated zero. */
function repsInReserveFromRpe(rpe: number | null): number | null {
  return rpe === null ? null : Math.min(9, Math.max(0, 10 - rpe));
}

interface PlannedSet {
  exerciseId: string;
  weight: number;
  reps: number;
  set: ImportedSet;
}

interface PlannedBlock {
  block: ImportedExerciseBlock;
  exerciseId: string;
  sets: PlannedSet[];
}

/** Blocks that will be written: resolved to a live exercise and with at least one set. */
function plannedBlocks(
  session: ImportedSession,
  exerciseIdByName: Map<string, string>
): PlannedBlock[] {
  return session.exercises.flatMap((block) => {
    const exerciseId = exerciseIdByName.get(block.name);
    if (!exerciseId || block.sets.length === 0) {
      return [];
    }

    return [
      {
        block,
        exerciseId,
        sets: block.sets.map((set) => ({ exerciseId, weight: set.weightKg, reps: set.reps, set })),
      },
    ];
  });
}

interface StrengthTotals {
  totalVolume: number;
  kcal: number;
}

function strengthTotals(planned: PlannedBlock[], ctx: CommitContext): StrengthTotals {
  const performed = planned.flatMap((block) =>
    block.sets.map((set) => ({
      exerciseId: set.exerciseId,
      weight: set.weight,
      reps: set.reps,
      completionStatus: 'performed' as const,
      setType: set.set.setType,
    }))
  );

  const volumeByExercise = new Map<string, ExerciseVolumeData>(
    [...ctx.infoById].map(([id, info]) => [id, { equipmentType: info.equipmentType }])
  );
  // A timed set has no reps to lift, and the 1RM formula would give a bodyweight plank real volume.
  const volumeSets = performed.filter((set) => set.reps > 0);
  const totalVolume = calculateSessionVolumeFromSets(
    volumeSets,
    volumeByExercise,
    ctx.bodyWeightKg,
    {
      onlyCompletedSets: true,
    }
  );
  const kcal = ctx.profile
    ? estimateWorkoutKcalFromSets(
        ctx.profile,
        performed.map(({ exerciseId, weight, reps, completionStatus }) => ({
          exerciseId,
          weight,
          reps,
          completionStatus,
        })),
        [...ctx.infoById.values()]
      )
    : 0;

  return { totalVolume, kcal };
}

interface CommitContext {
  source: WorkoutImportSource;
  batchId: string;
  now: number;
  fallbackWorkoutName: string;
  profile: WorkoutEnergyProfile | null;
  bodyWeightKg: number;
  exerciseIdByName: Map<string, string>;
  infoById: Map<string, ExerciseInfo>;
  liveKeys: Set<string>;
}

function prepareStrengthLog(
  session: ImportedSession,
  startedAt: number,
  planned: PlannedBlock[],
  ctx: CommitContext
): { ops: Model[]; setCount: number; timedSets: number } {
  const completedAt =
    session.durationSeconds === null
      ? startedAt
      : startedAt + Math.round(session.durationSeconds * 1000);
  const { totalVolume, kcal } = strengthTotals(planned, ctx);

  const log = database.get<WorkoutLog>('workout_logs').prepareCreate((record) => {
    record.workoutName = session.name || ctx.fallbackWorkoutName;
    record.templateId = undefined;
    record.type = 'free';
    record.startedAt = startedAt;
    record.completedAt = completedAt;
    record.timezone = getTimezoneAt(startedAt);
    record.totalVolume = totalVolume;
    record.caloriesBurned = kcal > 0 ? kcal : undefined;
    record.notes = normalizeNote(session.notes);
    record.exhaustionLevel = undefined;
    record.workoutScore = undefined;
    record.importSource = ctx.source;
    record.importKey = session.importKey;
    record.importBatchId = ctx.batchId;
    record.createdAt = ctx.now;
    record.updatedAt = ctx.now;
  });

  const ops: Model[] = [log];
  const groupIdBySuperset = new Map<string, string>();
  let setOrder = 0;
  let setCount = 0;
  let timedSets = 0;

  planned.forEach(({ block, exerciseId, sets }, exerciseOrder) => {
    let groupId: string | undefined;
    if (block.supersetKey) {
      groupId = groupIdBySuperset.get(block.supersetKey);
      if (!groupId) {
        groupId = randomUUID();
        groupIdBySuperset.set(block.supersetKey, groupId);
      }
    }

    const logExercise = database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .prepareCreate((record) => {
        record.workoutLogId = log.id;
        record.exerciseId = exerciseId;
        record.exerciseOrder = exerciseOrder;
        record.groupId = groupId;
        record.notes = blockNotes(block);
        record.createdAt = ctx.now;
        record.updatedAt = ctx.now;
      });
    ops.push(logExercise);

    for (const { set } of sets) {
      setOrder += 1;
      setCount += 1;
      if (set.reps === 0 && (set.durationSeconds ?? set.distanceM ?? 0) > 0) {
        timedSets += 1;
      }

      const rir = repsInReserveFromRpe(set.rpe);
      ops.push(
        database.get<WorkoutLogSet>('workout_log_sets').prepareCreate((record) => {
          record.logExerciseId = logExercise.id;
          record.reps = set.reps;
          record.weight = set.weightKg;
          record.partials = 0;
          record.restTimeAfter = 0;
          writeSetEffort(record, rir);
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

  return { ops, setCount, timedSets };
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
    const completedAt = startedAt + Math.round(durationS * 1000);
    const log = database.get<WorkoutLog>('workout_logs').prepareCreate((record) => {
      record.workoutName = cardio.name || session.name || ctx.fallbackWorkoutName;
      record.templateId = undefined;
      record.type = 'cardio';
      record.activity = cardio.activity;
      record.distanceM = cardio.distanceM;
      record.startedAt = startedAt;
      record.completedAt = completedAt;
      record.timezone = getTimezoneAt(startedAt);
      record.totalVolume = 0;
      record.caloriesBurned = kcal > 0 ? kcal : undefined;
      record.notes = normalizeNote(cardio.notes);
      record.exhaustionLevel = undefined;
      record.workoutScore = undefined;
      record.importSource = ctx.source;
      record.importKey = cardioImportKey(session.importKey, index);
      record.importBatchId = ctx.batchId;
      record.createdAt = ctx.now;
      record.updatedAt = ctx.now;
    });
    const logExercise = database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .prepareCreate((record) => {
        record.workoutLogId = log.id;
        record.exerciseId = appExerciseId(CARDIO_CATALOGUE_SLUGS.outdoor[cardio.activity]);
        record.exerciseOrder = 0;
        record.createdAt = ctx.now;
        record.updatedAt = ctx.now;
      });

    return [log, logExercise];
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
  const cardioOps = prepareCardioLogs(session, startedAt, ctx);

  return {
    ops: [...strength.ops, ...cardioOps],
    setCount: strength.setCount,
    cardioCount: session.cardio.length,
    timedSets: strength.timedSets,
  };
}

async function liveLogKeys(keys: readonly string[]): Promise<Set<string>> {
  const rows = await fetchByIds<WorkoutLog>(
    'workout_logs',
    'import_key',
    keys,
    Q.where('deleted_at', Q.eq(null))
  );
  return new Set(rows.map((row) => row.importKey).filter((key): key is string => Boolean(key)));
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
 * Creates the custom exercises a file needs, one row per distinct name, in the open writer.
 * Returns the ids to use for each name and the rows created.
 */
function prepareCustomExercises(
  names: readonly {
    fileName: string;
    name: string;
    muscleGroup: MuscleGroup;
    equipmentType: EquipmentType;
    mechanicType: MechanicType;
  }[]
): { ops: Model[]; idByName: Map<string, string>; infos: ExerciseInfo[] } {
  const ops: Model[] = [];
  const idByName = new Map<string, string>();
  const infos: ExerciseInfo[] = [];
  const now = Date.now();

  for (const item of names) {
    const exercise = database.get<Exercise>('exercises').prepareCreate((record) => {
      record.name = item.name;
      record.description = '';
      record.imageUrl = undefined;
      record.muscleGroup = item.muscleGroup;
      record.equipmentType = item.equipmentType;
      record.mechanicType = item.mechanicType;
      record.source = 'user';
      record.loadMultiplier = 1;
      record.searchText = computeExerciseSearchText(record, []);
      record.createdAt = now;
      record.updatedAt = now;
    });
    ops.push(exercise);
    idByName.set(item.fileName, exercise.id);
    infos.push({
      id: exercise.id,
      mechanicType: item.mechanicType,
      muscleGroup: item.muscleGroup,
      equipmentType: item.equipmentType,
      loadMultiplier: 1,
    });
  }

  return { ops, idByName, infos };
}

function distinctBlockNames(sessions: readonly ImportedSession[]): string[] {
  return [...new Set(sessions.flatMap((session) => session.exercises.map((block) => block.name)))];
}

/**
 * Writes the import's sessions. Sessions are packed into `database.batch` calls at session
 * boundaries, so a crash leaves whole sessions behind and importing the same file again fills in
 * the rest.
 */
async function writeSessions(
  sessions: readonly ImportedSession[],
  ctx: CommitContext,
  onProgress: ((done: number, total: number) => void) | undefined
): Promise<{
  sessionsImported: number;
  sessionsAlreadyHere: number;
  setsImported: number;
  cardioImported: number;
  timedSets: number;
}> {
  const totals = {
    sessionsImported: 0,
    sessionsAlreadyHere: 0,
    setsImported: 0,
    cardioImported: 0,
    timedSets: 0,
  };
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
    if (sessionImportKeys(session).some((key) => ctx.liveKeys.has(key))) {
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
    ctx.liveKeys.add(session.importKey);
  }

  await flush();
  return totals;
}

export class WorkoutImportService {
  /** Keys already present on a live log. Soft-deleted logs are ignored so an undo can be re-imported. */
  static async existingKeys(keys: readonly string[]): Promise<Set<string>> {
    if (keys.length === 0) {
      return new Set();
    }

    return await liveLogKeys(keys);
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

    const existingIds = [
      ...new Set(
        [...input.resolutions.values()].flatMap((resolution) =>
          resolution.kind === 'existing' ? [resolution.exerciseId] : []
        )
      ),
    ];
    const existingInfos = await loadExerciseInfos(existingIds);

    const names = distinctBlockNames(input.sessions);
    const skippedNames = new Set<string>();
    const existingIdByName = new Map<string, string>();
    const customSpecs: {
      fileName: string;
      name: string;
      muscleGroup: MuscleGroup;
      equipmentType: EquipmentType;
      mechanicType: MechanicType;
    }[] = [];

    for (const name of names) {
      const resolution = input.resolutions.get(name);
      if (!resolution || resolution.kind === 'skip') {
        skippedNames.add(name);
      } else if (resolution.kind === 'existing') {
        if (existingInfos.has(resolution.exerciseId)) {
          existingIdByName.set(name, resolution.exerciseId);
        } else {
          // A resolution naming an exercise that has since been deleted is a skip, not a guess.
          skippedNames.add(name);
        }
      } else {
        customSpecs.push({
          fileName: name,
          name: resolution.name,
          muscleGroup: resolution.muscleGroup,
          equipmentType: resolution.equipmentType,
          mechanicType: resolution.mechanicType,
        });
      }
    }

    const summary: ImportSummary = {
      batchId,
      sessionsImported: 0,
      sessionsAlreadyHere: 0,
      setsImported: 0,
      cardioImported: 0,
      exercisesCreated: 0,
      exercisesSkipped: 0,
      timedSets: 0,
    };

    await database.write(async () => {
      const allKeys = input.sessions.flatMap(sessionImportKeys);
      const liveKeys = await liveLogKeys(allKeys);

      // A session already here writes nothing, so it must not leave a new exercise behind either.
      const namesToWrite = new Set(
        distinctBlockNames(
          input.sessions.filter(
            (session) => !sessionImportKeys(session).some((key) => liveKeys.has(key))
          )
        )
      );
      const custom = prepareCustomExercises(
        customSpecs.filter((spec) => namesToWrite.has(spec.fileName))
      );
      for (const chunk of chunked(custom.ops, MAX_BATCH_OPERATIONS)) {
        await database.batch(...chunk);
      }

      const exerciseIdByName = new Map([...existingIdByName, ...custom.idByName]);
      const infoById = new Map<string, ExerciseInfo>(existingInfos);
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
        exerciseIdByName,
        infoById,
        liveKeys,
      };

      const written = await writeSessions(input.sessions, ctx, input.onProgress);
      Object.assign(summary, written, { exercisesCreated: custom.idByName.size });
    });

    summary.exercisesSkipped = skippedNames.size;

    // Remembering aliases happens after the import, and a failure here does not undo it.
    for (const name of names) {
      const resolution = input.resolutions.get(name);
      if (resolution?.kind !== 'existing' || !resolution.rememberAlias) {
        continue;
      }

      if (
        name.trim().length > MAX_EXERCISE_ALIAS_LENGTH ||
        !existingInfos.has(resolution.exerciseId)
      ) {
        continue;
      }

      try {
        await ExerciseAliasService.addAlias(resolution.exerciseId, name);
      } catch (error) {
        console.warn('Could not remember an import exercise alias:', error);
      }
    }

    return summary;
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
