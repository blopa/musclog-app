import { Model, Q } from '@nozbe/watermelondb';

import exercisesData from '@/data/exercisesData.json';
import { database } from '@/database';
import Exercise, {
  type EquipmentType,
  type ExerciseSource,
  type MechanicType,
  type MuscleGroup,
} from '@/database/models/Exercise';
import ExerciseGoal from '@/database/models/ExerciseGoal';
import ExerciseMuscle from '@/database/models/ExerciseMuscle';
import WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import WorkoutTemplateExercise from '@/database/models/WorkoutTemplateExercise';
import i18n, { EN_US, EXERCISES_JSON } from '@/lang/lang';
import {
  APP_EXERCISE_ID_PREFIX,
  appExerciseId,
  buildExerciseCloudUrl,
  buildLegacyExerciseCloudUrl,
  exerciseSlugFromId,
} from '@/utils/exerciseImage';
import { purgeRetiredExerciseImageCache } from '@/utils/exerciseImageCache';

import { MuscleService } from './MuscleService';

const EXERCISE_JSON_MUSCLE_GROUPS = [
  'abdomen',
  'arms',
  'back',
  'chest',
  'core',
  'full_body',
  'glutes',
  'legs',
  'shoulders',
] as const;

type ExerciseJsonMuscleGroup = (typeof EXERCISE_JSON_MUSCLE_GROUPS)[number];

interface ExerciseJsonData {
  exerciseIndex: number;
  freeExerciseDbId: string;
  name: string;
  description: string;
  muscleGroup: ExerciseJsonMuscleGroup;
  equipmentType: EquipmentType;
  mechanicType: MechanicType;
  targetMuscles?: string[];
  loadMultiplier?: number;
}

const exercisesDataMap = new Map(exercisesData.map((d) => [d.exerciseIndex, d]));

function buildMergedExercisesJson(locale: keyof typeof EXERCISES_JSON): ExerciseJsonData[] {
  const result: ExerciseJsonData[] = [];
  for (const localeEntry of EXERCISES_JSON[locale]) {
    const data = exercisesDataMap.get(localeEntry.exerciseIndex);
    if (!data) {
      continue;
    }

    result.push({
      exerciseIndex: localeEntry.exerciseIndex,
      freeExerciseDbId: data.__freeExerciseDbId,
      name: localeEntry.name,
      description: localeEntry.description,
      muscleGroup: data.muscleGroup as ExerciseJsonMuscleGroup,
      equipmentType: data.equipmentType as EquipmentType,
      mechanicType: data.mechanicType as MechanicType,
      targetMuscles: data.targetMuscles,
      loadMultiplier: data.loadMultiplier,
    });
  }

  return result;
}

const exercisesLocale = (
  i18n.language in EXERCISES_JSON ? i18n.language : EN_US
) as keyof typeof EXERCISES_JSON;
const exercisesJson = buildMergedExercisesJson(exercisesLocale);

/**
 * Id prefix for the user-owned copy of an exercise retired with the pre-free-exercise-db
 * catalogue. Derived from the retired row's id so the copy can be found again, which is
 * what makes `migrateLegacyAppExercises` resumable rather than duplicating on a retry.
 */
const RETIRED_EXERCISE_CLONE_ID_PREFIX = 'lx-';

/** WatermelonDB's native batch is unreliable on Android past a few thousand operations. */
const MAX_BATCH_OPERATIONS = 500;

/** SQLite caps host parameters (999 on older Android), so id lists are queried in slices. */
const MAX_QUERY_IDS = 300;

export interface LegacyCatalogueMigrationReport {
  cloned: number;
  destroyed: number;
  repointed: number;
  skippedStillReferenced: number;
}

/**
 * The shape every table that points at an exercise shares. `exercise_goals` declares
 * `exerciseId` nullable while the workout tables declare it required, so the repoint
 * helper is written against the union rather than one model.
 */
type RepointableRow = Model & { exerciseId?: null | string; updatedAt: number };

function chunked<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * A `source='app'` row that predates the free-exercise-db catalogue. Catalogue rows are
 * always `fx-<slug>`, so this is true for the old numeric ids AND for the WatermelonDB
 * UUIDs that web installs carry (migration v18's SQL renumbering never ran on LokiJS).
 *
 * Deliberately narrow: it is NOT "any app row missing from the shipped catalogue", which
 * would leave a permanently armed deletion path that a bad catalogue build could fire.
 */
function isRetiredCatalogueExercise(exercise: Exercise): boolean {
  return exercise.source === 'app' && !exercise.id.startsWith(APP_EXERCISE_ID_PREFIX);
}

async function fetchByExerciseIds<T>(table: string, exerciseIds: string[]): Promise<T[]> {
  const results: T[] = [];
  for (const slice of chunked(exerciseIds, MAX_QUERY_IDS)) {
    results.push(
      ...((await database
        .get(table)
        .query(Q.where('exercise_id', Q.oneOf(slice)))
        .fetch()) as T[])
    );
  }
  return results;
}

/**
 * The hosted URL for a retired exercise's illustration, so a cloned exercise keeps the
 * picture the user has been looking at. Recovers the image number from the row's own
 * `image_url` (cloud or the even older `file://` form) and falls back to its numeric id.
 * A custom URL the user set themselves is preserved verbatim.
 */
function retiredExerciseImageUrl(exercise: Exercise): string | undefined {
  const imageUrl = exercise.imageUrl ?? '';

  if (imageUrl && !/\/exercises\//.test(imageUrl)) {
    return imageUrl;
  }

  const filename = imageUrl.split('/').pop() ?? '';
  if (filename === 'exercise-fallback.png' || filename === 'fallback.png') {
    return undefined;
  }

  const fromFilename = filename.match(/^(?:exercise)?(\d+)\.\w+$/)?.[1];
  const exerciseNumber = Number(fromFilename ?? exercise.id);

  return Number.isInteger(exerciseNumber) && exerciseNumber > 0
    ? buildLegacyExerciseCloudUrl(exerciseNumber)
    : undefined;
}

export class ExerciseService {
  /**
   * Get all exercises (non-deleted), sorted with app exercises first by JSON order, then user exercises by name
   */
  static async getAllExercises(): Promise<Exercise[]> {
    return await database
      .get<Exercise>('exercises')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('source', Q.asc),
        Q.sortBy('order_index', Q.asc),
        Q.sortBy('name', Q.asc)
      )
      .fetch();
  }

  /**
   * Get exercises by muscle group
   */
  static async getExercisesByMuscleGroup(muscleGroup: MuscleGroup | string): Promise<Exercise[]> {
    return await database
      .get<Exercise>('exercises')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('muscle_group', muscleGroup),
        Q.sortBy('source', Q.asc),
        Q.sortBy('order_index', Q.asc),
        Q.sortBy('name', Q.asc)
      )
      .fetch();
  }

  /**
   * Get exercises by equipment type
   */
  static async getExercisesByEquipmentType(
    equipmentType: EquipmentType | string
  ): Promise<Exercise[]> {
    return await database
      .get<Exercise>('exercises')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('equipment_type', equipmentType),
        Q.sortBy('source', Q.asc),
        Q.sortBy('order_index', Q.asc),
        Q.sortBy('name', Q.asc)
      )
      .fetch();
  }

  /**
   * Get exercises by mechanic type
   */
  static async getExercisesByMechanicType(
    mechanicType: MechanicType | string
  ): Promise<Exercise[]> {
    return await database
      .get<Exercise>('exercises')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('mechanic_type', mechanicType),
        Q.sortBy('source', Q.asc),
        Q.sortBy('order_index', Q.asc),
        Q.sortBy('name', Q.asc)
      )
      .fetch();
  }

  /**
   * Search exercises by name
   */
  static async searchExercises(searchTerm: string): Promise<Exercise[]> {
    return await database
      .get<Exercise>('exercises')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('name', Q.like(`%${searchTerm}%`)),
        Q.sortBy('source', Q.asc),
        Q.sortBy('order_index', Q.asc),
        Q.sortBy('name', Q.asc)
      )
      .fetch();
  }

  /**
   * Get exercise by ID
   */
  static async getExerciseById(id: string): Promise<Exercise | null> {
    try {
      const exercise = await database.get<Exercise>('exercises').find(id);
      return exercise.deletedAt ? null : exercise;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create a new exercise
   */
  static async createExercise(
    name: string,
    description: string,
    muscleGroup: MuscleGroup | string,
    equipmentType: EquipmentType | string,
    mechanicType: MechanicType | string,
    loadMultiplier: number = 1.0,
    imageUrl?: string,
    source: ExerciseSource = 'user'
  ): Promise<Exercise> {
    return await database.write(async () => {
      const now = Date.now();

      return await database.get<Exercise>('exercises').create((exercise) => {
        exercise.name = name;
        exercise.description = description;
        exercise.imageUrl = imageUrl;
        exercise.muscleGroup = muscleGroup as MuscleGroup;
        exercise.equipmentType = equipmentType as EquipmentType;
        exercise.mechanicType = mechanicType as MechanicType;
        exercise.source = source;
        exercise.loadMultiplier = loadMultiplier;
        exercise.createdAt = now;
        exercise.updatedAt = now;
      });
    });
  }

  /**
   * Update exercise
   */
  static async updateExercise(
    id: string,
    updates: {
      name?: string;
      description?: string;
      imageUrl?: string;
      muscleGroup?: MuscleGroup | string;
      equipmentType?: EquipmentType | string;
      mechanicType?: MechanicType | string;
      loadMultiplier?: number;
    }
  ): Promise<Exercise> {
    return await database.write(async () => {
      const exercise = await database.get<Exercise>('exercises').find(id);

      if (exercise.deletedAt) {
        throw new Error('Cannot update deleted exercise');
      }

      await exercise.update((record) => {
        if (updates.name !== undefined) {
          record.name = updates.name;
        }
        if (updates.description !== undefined) {
          record.description = updates.description;
        }
        if (updates.imageUrl !== undefined) {
          record.imageUrl = updates.imageUrl;
        }
        if (updates.muscleGroup !== undefined) {
          record.muscleGroup = updates.muscleGroup as MuscleGroup;
        }
        if (updates.equipmentType !== undefined) {
          record.equipmentType = updates.equipmentType as EquipmentType;
        }
        if (updates.mechanicType !== undefined) {
          record.mechanicType = updates.mechanicType as MechanicType;
        }
        if (updates.loadMultiplier !== undefined) {
          record.loadMultiplier = updates.loadMultiplier;
        }
        record.updatedAt = Date.now();
      });

      return exercise;
    });
  }

  /**
   * Delete exercise (soft delete)
   */
  static async deleteExercise(id: string): Promise<void> {
    const exercise = await database.get<Exercise>('exercises').find(id);
    // markAsDeleted is a @writer method, so it already manages its own write transaction
    await exercise.markAsDeleted();
  }

  /**
   * Get all muscle groups
   */
  static async getMuscleGroups(): Promise<string[]> {
    const exercises = await database
      .get<Exercise>('exercises')
      .query(Q.where('deleted_at', Q.eq(null)))
      .fetch();

    // Extract unique muscle groups
    const muscleGroups = [...new Set(exercises.map((e) => e.muscleGroup ?? ''))].filter((m) => m);
    return muscleGroups.sort();
  }

  /**
   * Get all equipment types
   */
  static async getEquipmentTypes(): Promise<string[]> {
    const exercises = await database
      .get<Exercise>('exercises')
      .query(Q.where('deleted_at', Q.eq(null)))
      .fetch();

    // Extract unique equipment types
    const equipmentTypes = [...new Set(exercises.map((e) => e.equipmentType ?? ''))].filter(
      (t) => t
    );
    return equipmentTypes.sort();
  }

  /**
   * Get exercises with pagination (for Manage Exercise Data modal).
   * Ordered by created_at desc. Most recent first.
   */
  static async getExercisesPaginated(limit: number, offset: number): Promise<Exercise[]> {
    let query = database
      .get<Exercise>('exercises')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc));

    if (limit > 0) {
      if (offset > 0) {
        query = query.extend(Q.skip(offset), Q.take(limit));
      } else {
        query = query.extend(Q.take(limit));
      }
    }

    return await query.fetch();
  }

  /**
   * Get exercises with pagination and optional filters (for Replace Exercise modal).
   * Ordered by name asc. Supports filter by muscle group and/or search by name.
   */
  static async getExercisesPaginatedFiltered(
    limit: number,
    offset: number,
    filters?: { muscleGroup?: string; searchTerm?: string }
  ): Promise<Exercise[]> {
    let query = database.get<Exercise>('exercises').query(Q.where('deleted_at', Q.eq(null)));

    if (filters?.muscleGroup) {
      query = query.extend(Q.where('muscle_group', filters.muscleGroup));
    }
    if (filters?.searchTerm?.trim()) {
      query = query.extend(Q.where('name', Q.like(`%${filters.searchTerm.trim()}%`)));
    }

    query = query.extend(
      Q.sortBy('source', Q.asc),
      Q.sortBy('order_index', Q.asc),
      Q.sortBy('name', Q.asc)
    );
    if (limit > 0) {
      if (offset > 0) {
        query = query.extend(Q.skip(offset), Q.take(limit));
      } else {
        query = query.extend(Q.take(limit));
      }
    }

    return await query.fetch();
  }

  /**
   * Get frequently used exercises (based on workout logs)
   */
  static async getFrequentlyUsedExercises(limit: number = 10): Promise<Exercise[]> {
    // TODO: Implement exercise usage tracking and frequency calculation
    // This is a simplified version - in a real app you might want to add a usage counter
    // For now, we'll return exercises ordered by source (app first), then JSON order
    return await database
      .get<Exercise>('exercises')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('source', Q.asc),
        Q.sortBy('order_index', Q.asc),
        Q.sortBy('created_at', Q.desc),
        Q.take(limit)
      )
      .fetch();
  }

  /**
   * Get exercises count
   */
  static async getExercisesCount(): Promise<number> {
    const exercises = await database
      .get<Exercise>('exercises')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.take(0) // Just get count
      )
      .fetch();

    return exercises.length;
  }

  /**
   * Duplicate exercise (create a copy)
   */
  static async duplicateExercise(id: string): Promise<Exercise> {
    return await database.write(async () => {
      const originalExercise = await database.get<Exercise>('exercises').find(id);

      if (originalExercise.deletedAt) {
        throw new Error('Cannot duplicate deleted exercise');
      }

      const now = Date.now();

      // Create new exercise with "(Copy)" suffix
      return await database.get<Exercise>('exercises').create((exercise) => {
        exercise.name = `${originalExercise.name} (Copy)`;
        exercise.description = originalExercise.description;
        exercise.imageUrl = originalExercise.imageUrl;
        exercise.muscleGroup = originalExercise.muscleGroup;
        exercise.equipmentType = originalExercise.equipmentType;
        exercise.mechanicType = originalExercise.mechanicType;
        exercise.source = 'user';
        exercise.loadMultiplier = originalExercise.loadMultiplier;
        exercise.createdAt = now;
        exercise.updatedAt = now;
      });
    });
  }

  /**
   * Infers equipment type from exercise name
   * This is a helper to improve accuracy of equipment type mapping
   */
  private static inferEquipmentFromName(
    name: string,
    defaultEquipment: EquipmentType
  ): EquipmentType {
    const lowerName = name.toLowerCase();

    if (lowerName.includes('dumbbell') || lowerName.includes('db ')) {
      return 'dumbbell' as EquipmentType;
    }
    if (lowerName.includes('barbell') || lowerName.includes('bb ')) {
      return 'barbell' as EquipmentType;
    }
    if (lowerName.includes('cable')) {
      return 'cable' as EquipmentType;
    }
    if (lowerName.includes('kettlebell')) {
      return 'kettlebell' as EquipmentType;
    }
    if (lowerName.includes('machine') || lowerName.includes(' smith')) {
      return 'plate_machine' as EquipmentType;
    }

    return defaultEquipment;
  }

  /**
   * Backfills the `source` field for exercises that predate the column addition.
   * Exercises with no source are ordered by creation date (oldest first); the first
   * `appExerciseCount` are assumed to be app-seeded and get `'app'`, the rest get `'user'`.
   * The default count is a frozen historical heuristic, not the current catalogue size.
   * Anything it identifies as an old app exercise is retired by
   * `migrateLegacyAppExercises` later in the same boot, which is the intended outcome.
   * Safe to call on every app start — it's a no-op when all exercises already have a source.
   */
  static async backfillExerciseSources(appExerciseCount: number = 183): Promise<void> {
    const unsourced = await database
      .get<Exercise>('exercises')
      .query(
        Q.or(Q.where('source', Q.eq(null)), Q.where('source', Q.eq(''))),
        Q.sortBy('created_at', Q.asc)
      )
      .fetch();

    if (unsourced.length === 0) {
      return;
    }

    await database.write(async () => {
      for (let i = 0; i < unsourced.length; i++) {
        const exercise = unsourced[i];
        const source: ExerciseSource = i < appExerciseCount ? 'app' : 'user';
        await exercise.update((e) => {
          e.source = source;
        });
      }
    });

    console.log(`Backfilled source for ${unsourced.length} exercise(s)`);
  }

  /**
   * Reconciles catalogue exercises already in the DB with the bundled catalogue, so that a
   * refined `loadMultiplier`, a corrected muscle group or a new image reaches users who
   * were seeded by an earlier version. Without it the app could only ever *add* exercises.
   *
   * Keyed on the exercise id, which carries the free-exercise-db slug — a name lookup is
   * both locale-dependent and defeated by `updateExercise`, which lets a user rename a
   * catalogue exercise.
   *
   * Deliberately does NOT touch `name` or `description`: those are the two fields a user
   * can meaningfully edit on a catalogue exercise, and overwriting them every boot would
   * silently undo their edit. Structural facts are ours; wording is theirs.
   *
   * Safe to call repeatedly — only changed fields are written.
   */
  static async syncAppExerciseFields(): Promise<number> {
    const bySlug = new Map(exercisesJson.map((ex, index) => [ex.freeExerciseDbId, { ex, index }]));

    const appExercises = await database
      .get<Exercise>('exercises')
      .query(Q.where('source', 'app'), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    const toUpdate: { changes: Partial<Exercise>; exercise: Exercise }[] = [];

    for (const exercise of appExercises) {
      const slug = exerciseSlugFromId(exercise.id);
      const entry = slug ? bySlug.get(slug) : undefined;
      if (!entry) {
        continue;
      }

      const { ex, index } = entry;
      const changes: Partial<Exercise> = {};
      const loadMultiplier = ex.loadMultiplier ?? 1.0;
      const equipmentType = this.inferEquipmentFromName(ex.name, ex.equipmentType);
      const imageUrl = buildExerciseCloudUrl(ex.freeExerciseDbId);

      if (Math.abs((exercise.loadMultiplier ?? 0) - loadMultiplier) > 0.001) {
        changes.loadMultiplier = loadMultiplier;
      }
      if (exercise.muscleGroup !== ex.muscleGroup) {
        changes.muscleGroup = ex.muscleGroup as MuscleGroup;
      }
      if (exercise.equipmentType !== equipmentType) {
        changes.equipmentType = equipmentType as EquipmentType;
      }
      if (exercise.mechanicType !== ex.mechanicType) {
        changes.mechanicType = ex.mechanicType;
      }
      if (exercise.orderIndex !== index) {
        changes.orderIndex = index;
      }
      if (exercise.imageUrl !== imageUrl) {
        changes.imageUrl = imageUrl;
      }

      if (Object.keys(changes).length > 0) {
        toUpdate.push({ changes, exercise });
      }
    }

    if (toUpdate.length === 0) {
      return 0;
    }

    await database.write(async () => {
      await database.batch(
        ...toUpdate.map(({ changes, exercise }) =>
          exercise.prepareUpdate((e) => {
            Object.assign(e, changes);
            e.updatedAt = Date.now();
          })
        )
      );
    });

    console.log(`[syncAppExerciseFields] Updated ${toUpdate.length} exercise(s)`);
    return toUpdate.length;
  }

  /**
   * Returns the catalogue exercises that are missing from `existingExercises`, deduped by
   * the fixed id `fx-<freeExerciseDbId>`.
   *
   * The id check is the whole invariant. Skipping by id prevents re-inserting an existing
   * primary key, which throws `UNIQUE constraint failed: exercises.id` (sqlite error 1555)
   * — the crash that shipped in builds 270/272. `existingIds` intentionally includes rows
   * of every source and soft-deleted rows, because those still occupy their id in SQLite.
   *
   * There is deliberately NO name-based dedupe. It existed when ids were assigned by
   * creation order and could not be relied on, but it is locale-dependent, it never
   * covered user-created rows (it only ever looked at `source='app'`), and it is now
   * actively harmful: 54 names are shared with the retired pre-free-exercise-db catalogue,
   * so during the one boot where retired rows and the new catalogue coexist (seeding runs
   * before `migrateLegacyAppExercises`), a name check would skip those 54 entries.
   */
  private static computeMissingAppExercises(existingExercises: Exercise[]): ExerciseJsonData[] {
    const existingIds = new Set(existingExercises.map((exercise) => exercise.id));

    return exercisesJson.filter((data) => !existingIds.has(appExerciseId(data.freeExerciseDbId)));
  }

  /**
   * Compares the bundled catalogue against the exercises in the DB that have
   * source='app', and creates any entries that are missing. This is the ONE seeding
   * path — it runs on every app boot so that new exercises added to the catalogue in a
   * future update are seeded for existing users, and the production seeder calls it for
   * a fresh install rather than keeping a second, divergent code path.
   *
   * Safe to call repeatedly — exits immediately when nothing is missing.
   * Returns the number of exercises created (0 on a no-op boot).
   */
  static async syncAppExercises(seededMuscleNameToId?: Map<string, string>): Promise<number> {
    // Fast path: skip all work — and avoid opening a writer — when nothing is
    // missing. This read is only an optimization; the authoritative check runs
    // inside the writer below, so a stale result here can never cause a bad write.
    const preCheck = await database.get<Exercise>('exercises').query().fetch();
    if (this.computeMissingAppExercises(preCheck).length === 0) {
      return 0;
    }

    const now = Date.now();

    // Ensure muscles are seeded and get the name→id map for junction records.
    // Done before the write block below because seedMuscles() opens its own
    // writer, and nesting database.write() calls deadlocks (see AGENTS.md).
    const muscleNameToId = seededMuscleNameToId ?? (await MuscleService.seedMuscles());

    let createdCount = 0;

    // The existence check and the insert MUST happen inside a single writer.
    // WatermelonDB serialises write blocks, so re-reading the existing rows here
    // (instead of reusing the pre-check above) closes the TOCTOU window: a second
    // concurrent syncAppExercises() run cannot read a stale "missing" set — before
    // this run's rows are committed — and then re-insert a fixed id we already
    // wrote, which would throw `sqlite error 1555 (UNIQUE constraint failed:
    // exercises.id)`. Never read-then-write across a writer boundary here.
    await database.write(async () => {
      const existingExercises = await database.get<Exercise>('exercises').query().fetch();
      const missing = this.computeMissingAppExercises(existingExercises);

      if (missing.length === 0) {
        return;
      }

      // prepareCreate assigns IDs synchronously
      const prepared = missing.map((data) => {
        const jsonIndex = exercisesJson.indexOf(data);
        const mechanicType = data.mechanicType;
        const equipmentType = this.inferEquipmentFromName(data.name, data.equipmentType);

        return database.get<Exercise>('exercises').prepareCreate((exercise) => {
          exercise._raw.id = appExerciseId(data.freeExerciseDbId);
          exercise.name = data.name;
          exercise.description = data.description;
          exercise.muscleGroup = data.muscleGroup as MuscleGroup;
          exercise.equipmentType = equipmentType as EquipmentType;
          exercise.mechanicType = mechanicType as MechanicType;
          exercise.source = 'app';
          exercise.loadMultiplier = data.loadMultiplier ?? 1.0;
          exercise.orderIndex = jsonIndex;
          exercise.imageUrl = buildExerciseCloudUrl(data.freeExerciseDbId);
          exercise.createdAt = now;
          exercise.updatedAt = now;
          exercise.deletedAt = undefined;
        });
      });

      const junctionRecords = missing.flatMap((data, i) =>
        (data.targetMuscles ?? []).flatMap((muscleName) => {
          const muscleId = muscleNameToId.get(muscleName);
          if (!muscleId) {
            return [];
          }
          return [
            database.get<ExerciseMuscle>('exercise_muscles').prepareCreate((link) => {
              link.exerciseId = prepared[i].id;
              link.muscleId = muscleId;
              link.role = 'primary';
              link.createdAt = now;
              link.updatedAt = now;
              link.deletedAt = undefined;
            }),
          ];
        })
      );

      // Chunked: a full catalogue seed is 873 exercises + ~2600 junction rows, and
      // WatermelonDB's native batch has a known failure mode on Android for very large
      // batches (temp-store IO error). Still one writer, so the TOCTOU guarantee above
      // holds; fixed ids make a partially-committed chunk sequence resumable next boot.
      for (const chunk of chunked([...prepared, ...junctionRecords], MAX_BATCH_OPERATIONS)) {
        await database.batch(...chunk);
      }
      createdCount = prepared.length;
    });

    if (createdCount > 0) {
      console.log(`[syncAppExercises] Created ${createdCount} new app exercise(s)`);
    }

    return createdCount;
  }

  /**
   * Retires the pre-free-exercise-db catalogue from a database that still carries it.
   *
   * Until v2.12 the bundled catalogue was 256 AI-illustrated exercises seeded as
   * `source='app'` rows with ids `"1".."256"` (or, on web, WatermelonDB UUIDs — the v18
   * SQL renumbering never ran there). Those rows are not in the new catalogue, but users
   * have workouts, logs and goals pointing at them, so they cannot simply be deleted.
   *
   * Each retired exercise that something references is copied to a `source='user'`
   * exercise the user owns — and can now edit or delete, which a `source='app'` row
   * forbids — and every reference is repointed at the copy. Retired rows that nothing
   * references are dropped outright.
   *
   * The step is idempotent by data, deliberately NOT by a `runOnce` AsyncStorage flag:
   * restoring a backup rewrites AsyncStorage, so a "done" flag can arrive from a device
   * whose data is already migrated and permanently suppress this on data that is not.
   * The predicate below is true exactly when there is work to do.
   */
  static async migrateLegacyAppExercises(): Promise<LegacyCatalogueMigrationReport | null> {
    // Optimization only — the authoritative read happens inside the writer.
    const preCheck = await database.get<Exercise>('exercises').query().fetch();

    if (!preCheck.some(isRetiredCatalogueExercise)) {
      return null;
    }

    // `runBootMigration` reports and swallows a seeding failure before advancing to this
    // step. Never retire the old catalogue unless the new one is complete; otherwise a
    // failed/partial seed could turn a recoverable boot into an empty exercise library.
    if (this.computeMissingAppExercises(preCheck).length > 0) {
      return null;
    }

    const report: LegacyCatalogueMigrationReport = {
      cloned: 0,
      destroyed: 0,
      repointed: 0,
      skippedStillReferenced: 0,
    };
    let migrated = false;

    await database.write(async () => {
      const allExercises = await database.get<Exercise>('exercises').query().fetch();
      const retired = allExercises.filter(isRetiredCatalogueExercise);

      if (retired.length === 0 || this.computeMissingAppExercises(allExercises).length > 0) {
        return;
      }
      migrated = true;

      const retiredIds = retired.map((exercise) => exercise.id);

      // Tables that make an exercise worth keeping. `exercise_muscles` is deliberately
      // NOT one of them: it is a derived link table that `backfillExerciseMuscles`
      // populates for EVERY exercise, so counting it would clone all 256 into the user's
      // own catalogue instead of just the handful they actually train.
      const [templateExercises, logExercises, goals] = await Promise.all([
        fetchByExerciseIds<WorkoutTemplateExercise>('workout_template_exercises', retiredIds),
        fetchByExerciseIds<WorkoutLogExercise>('workout_log_exercises', retiredIds),
        fetchByExerciseIds<ExerciseGoal>('exercise_goals', retiredIds),
      ]);
      const muscleLinks = await fetchByExerciseIds<ExerciseMuscle>('exercise_muscles', retiredIds);

      // Soft-deleted references count: they still ship in every export and would restore
      // with a dangling exercise_id. One extra cloned row is cheaper than that.
      const referencedIds = new Set<string>([
        ...templateExercises.map((row) => row.exerciseId),
        ...logExercises.map((row) => row.exerciseId),
        ...goals.flatMap((row) => (row.exerciseId ? [row.exerciseId] : [])),
      ]);

      // Deterministic clone ids make the whole step resumable. On web a batch is not a
      // transaction, so a run interrupted midway can leave clones without their repoints;
      // the next run finds the clone by id and repoints onto it rather than duplicating.
      const existingById = new Map(allExercises.map((exercise) => [exercise.id, exercise]));

      const now = Date.now();
      const cloneIdFor = (legacyId: string) => `${RETIRED_EXERCISE_CLONE_ID_PREFIX}${legacyId}`;
      const creates: Exercise[] = [];

      for (const exercise of retired) {
        if (!referencedIds.has(exercise.id)) {
          continue;
        }

        const cloneId = cloneIdFor(exercise.id);
        if (existingById.has(cloneId)) {
          continue;
        }

        creates.push(
          database.get<Exercise>('exercises').prepareCreate((clone) => {
            clone._raw.id = cloneId;
            clone.name = exercise.name;
            clone.description = exercise.description;
            clone.muscleGroup = exercise.muscleGroup;
            clone.equipmentType = exercise.equipmentType;
            clone.mechanicType = exercise.mechanicType;
            clone.source = 'user';
            clone.loadMultiplier = exercise.loadMultiplier;
            // order_index is catalogue ordering; a user row must not sort into the
            // catalogue block that `getAllExercises` orders by source then order_index.
            clone.orderIndex = undefined;
            clone.imageUrl = retiredExerciseImageUrl(exercise);
            clone.createdAt = exercise.createdAt;
            clone.updatedAt = now;
            clone.deletedAt = exercise.deletedAt;
          })
        );
        report.cloned += 1;
      }

      const repoint = <T extends RepointableRow>(rows: T[]) =>
        rows.flatMap((row) => {
          if (!row.exerciseId || !referencedIds.has(row.exerciseId)) {
            return [];
          }
          const cloneId = cloneIdFor(row.exerciseId);
          report.repointed += 1;
          return [
            row.prepareUpdate((r) => {
              r.exerciseId = cloneId;
              r.updatedAt = now;
            }),
          ];
        });

      // Partition before prepareUpdate mutates `exerciseId` synchronously. Filtering the
      // same array afterwards would mistake every freshly repointed link for an orphan and
      // schedule it for destruction in the same batch.
      const survivingMuscleLinks = muscleLinks.filter((link) => referencedIds.has(link.exerciseId));
      const retiredMuscleLinks = muscleLinks.filter((link) => !referencedIds.has(link.exerciseId));

      const updates = [
        ...repoint(templateExercises),
        ...repoint(logExercises),
        ...repoint(goals),
        // A muscle link follows its exercise when the exercise survives as a clone…
        ...repoint(survivingMuscleLinks),
      ];

      // …and is destroyed with it otherwise. All retired exercise rows are removed after
      // every surviving reference has been repointed. Leaving referenced rows behind would
      // keep the migration armed and require a second launch to finish the cutover.
      const destroys = [
        ...retiredMuscleLinks.map((link) => link.prepareDestroyPermanently()),
        // prepareDestroyPermanently bypasses Exercise.markAsDeleted, which throws for
        // source='app'. That guard is still correct and is deliberately left alone.
        // Permanent, not soft: a soft-deleted row keeps its id, still ships in every
        // export, and restores forever. Nothing a user typed is lost — these rows are
        // bundled data, and everything referencing them has just been repointed.
        ...retired.map((exercise) => {
          report.destroyed += 1;
          return exercise.prepareDestroyPermanently();
        }),
      ];

      report.skippedStillReferenced = 0;

      for (const chunk of chunked([...creates, ...updates, ...destroys], MAX_BATCH_OPERATIONS)) {
        await database.batch(...chunk);
      }
    });

    if (!migrated) {
      return null;
    }

    // The retired rows' photos are the only thing left in the on-device image cache that
    // can never be requested again, and the cache has no eviction of its own.
    purgeRetiredExerciseImageCache();

    console.log(
      `[migrateLegacyAppExercises] cloned ${report.cloned}, repointed ${report.repointed}, destroyed ${report.destroyed}`
    );

    return report;
  }
}
