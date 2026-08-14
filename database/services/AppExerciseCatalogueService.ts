import { type Model, Q } from '@nozbe/watermelondb';

import { type ExerciseCatalogueEntry, getExerciseCatalogue } from '@/data/exerciseCatalogue';
import { database } from '@/database/database-instance';
import Exercise, {
  type EquipmentType,
  type MechanicType,
  type MuscleGroup,
} from '@/database/models/Exercise';
import ExerciseMuscle from '@/database/models/ExerciseMuscle';
import Muscle from '@/database/models/Muscle';
import { appExerciseId, buildExerciseCloudUrl } from '@/utils/exerciseImage';

import { MuscleService } from './MuscleService';

const MAX_BATCH_OPERATIONS = 500;
const MAX_QUERY_IDS = 300;

/**
 * The fields the catalogue owns on an exercise row — the single definition of the
 * catalogue-entry-to-database projection, used to create a row, to detect drift on an
 * existing one, and to repair it. Adding a catalogue-owned column is one edit here.
 */
interface CatalogueExerciseFields {
  muscleGroup: MuscleGroup;
  equipmentType: EquipmentType;
  mechanicType: MechanicType;
  loadMultiplier: number;
  orderIndex: number;
  imageUrl: string;
}

type CatalogueExerciseChanges = Partial<CatalogueExerciseFields>;

function catalogueExerciseFields(entry: ExerciseCatalogueEntry): CatalogueExerciseFields {
  return {
    muscleGroup: entry.muscleGroup,
    equipmentType: entry.equipmentType,
    mechanicType: entry.mechanicType,
    loadMultiplier: entry.loadMultiplier,
    orderIndex: entry.exerciseIndex - 1,
    imageUrl: buildExerciseCloudUrl(entry.exerciseSlug),
  };
}

export interface AppExerciseCatalogueSyncReport {
  exercisesCreated: number;
  exercisesUpdated: number;
  linksCreated: number;
  linksUpdated: number;
  linksDestroyed: number;
  conflicts: string[];
}

function chunked<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function fetchExerciseMuscles(exerciseIds: string[]): Promise<ExerciseMuscle[]> {
  const links: ExerciseMuscle[] = [];
  for (const ids of chunked(exerciseIds, MAX_QUERY_IDS)) {
    links.push(
      ...(await database
        .get<ExerciseMuscle>('exercise_muscles')
        .query(Q.where('exercise_id', Q.oneOf(ids)))
        .fetch())
    );
  }

  return links;
}

function desiredLinkIds(
  entry: ExerciseCatalogueEntry,
  muscleNameToId: ReadonlyMap<string, string>
): Set<string> | null {
  const ids = new Set<string>();
  for (const muscleName of entry.targetMuscles) {
    const muscleId = muscleNameToId.get(muscleName);
    if (!muscleId) {
      return null;
    }

    ids.add(muscleId);
  }

  return ids;
}

/**
 * `loadMultiplier` is the one field a strict comparison gets wrong: it round-trips through
 * SQLite as a float, so an exact check would rewrite every catalogue row on every boot.
 */
function fieldMatches<TKey extends keyof CatalogueExerciseFields>(
  key: TKey,
  stored: CatalogueExerciseFields[TKey] | undefined,
  desired: CatalogueExerciseFields[TKey]
): boolean {
  if (key === 'loadMultiplier') {
    return Math.abs((stored as number) - (desired as number)) <= 0.001;
  }
  return stored === desired;
}

function exerciseChanges(
  exercise: Exercise,
  entry: ExerciseCatalogueEntry
): CatalogueExerciseChanges {
  const desired = catalogueExerciseFields(entry);
  const changes: CatalogueExerciseChanges = {};

  for (const key of Object.keys(desired) as (keyof CatalogueExerciseFields)[]) {
    if (!fieldMatches(key, exercise[key], desired[key])) {
      Object.assign(changes, { [key]: desired[key] });
    }
  }

  return changes;
}

function exerciseMatchesCatalogue(exercise: Exercise, entry: ExerciseCatalogueEntry): boolean {
  return (
    exercise.source === 'app' &&
    !exercise.deletedAt &&
    Object.keys(exerciseChanges(exercise, entry)).length === 0
  );
}

function operationBatches(groups: Model[][]): Model[][] {
  const batches: Model[][] = [];
  let batch: Model[] = [];

  for (const group of groups) {
    if (group.length > MAX_BATCH_OPERATIONS) {
      throw new Error(`Exercise catalogue operation group exceeds ${MAX_BATCH_OPERATIONS} rows`);
    }

    if (batch.length > 0 && batch.length + group.length > MAX_BATCH_OPERATIONS) {
      batches.push(batch);
      batch = [];
    }

    batch.push(...group);
  }

  if (batch.length > 0) {
    batches.push(batch);
  }
  return batches;
}

interface CatalogueDatabaseState {
  exerciseById: Map<string, Exercise>;
  linksByExerciseId: Map<string, ExerciseMuscle[]>;
}

/**
 * Loads every row `sync` and `isComplete` reason about. Both need the same two independent
 * queries, so they run together; callers filter soft-deleted links themselves, because
 * `sync` has to see them (to destroy them) and `isComplete` must not count them.
 */
async function loadCatalogueDatabaseState(catalogueIds: string[]): Promise<CatalogueDatabaseState> {
  const [allExercises, links] = await Promise.all([
    database.get<Exercise>('exercises').query().fetch(),
    fetchExerciseMuscles(catalogueIds),
  ]);

  const linksByExerciseId = new Map<string, ExerciseMuscle[]>();
  for (const link of links) {
    const exerciseLinks = linksByExerciseId.get(link.exerciseId) ?? [];
    exerciseLinks.push(link);
    linksByExerciseId.set(link.exerciseId, exerciseLinks);
  }

  return {
    exerciseById: new Map(allExercises.map((exercise) => [exercise.id, exercise])),
    linksByExerciseId,
  };
}

async function activeMuscleIdsByName(): Promise<Map<string, string>> {
  const muscles = await database
    .get<Muscle>('muscles')
    .query(Q.where('deleted_at', Q.eq(null)))
    .fetch();
  return new Map(muscles.map((muscle) => [muscle.name, muscle.id]));
}

/** Owns the exact database projection of the bundled exercise catalogue. */
export class AppExerciseCatalogueService {
  static async sync(
    seededMuscleNameToId?: Map<string, string>
  ): Promise<AppExerciseCatalogueSyncReport> {
    const catalogue = getExerciseCatalogue();
    const muscleNameToId = seededMuscleNameToId ?? (await MuscleService.seedMuscles());
    const report: AppExerciseCatalogueSyncReport = {
      exercisesCreated: 0,
      exercisesUpdated: 0,
      linksCreated: 0,
      linksUpdated: 0,
      linksDestroyed: 0,
      conflicts: [],
    };

    await database.write(async () => {
      const catalogueIds = catalogue.map(({ exerciseSlug }) => appExerciseId(exerciseSlug));
      const { exerciseById, linksByExerciseId } = await loadCatalogueDatabaseState(catalogueIds);

      const now = Date.now();
      const groups: Model[][] = [];

      for (const entry of catalogue) {
        const exerciseId = appExerciseId(entry.exerciseSlug);
        const existing = exerciseById.get(exerciseId);
        const desiredMuscleIds = desiredLinkIds(entry, muscleNameToId);
        if (!desiredMuscleIds) {
          report.conflicts.push(`${exerciseId}: target muscle is not seeded`);
          continue;
        }

        if (existing && (existing.source !== 'app' || existing.deletedAt)) {
          report.conflicts.push(`${exerciseId}: id is occupied by a non-catalogue exercise`);
          continue;
        }

        const operations: Model[] = [];
        if (!existing) {
          operations.push(
            database.get<Exercise>('exercises').prepareCreate((exercise) => {
              exercise._raw.id = exerciseId;
              exercise.name = entry.name;
              exercise.description = entry.description;
              exercise.source = 'app';
              Object.assign(exercise, catalogueExerciseFields(entry));
              exercise.createdAt = now;
              exercise.updatedAt = now;
              exercise.deletedAt = undefined;
            })
          );
          report.exercisesCreated += 1;
        } else {
          const changes = exerciseChanges(existing, entry);
          if (Object.keys(changes).length > 0) {
            operations.push(
              existing.prepareUpdate((exercise) => {
                Object.assign(exercise, changes);
                exercise.updatedAt = now;
              })
            );
            report.exercisesUpdated += 1;
          }
        }

        const retainedMuscleIds = new Set<string>();
        for (const link of linksByExerciseId.get(exerciseId) ?? []) {
          const shouldRetain =
            !link.deletedAt &&
            desiredMuscleIds.has(link.muscleId) &&
            !retainedMuscleIds.has(link.muscleId);
          if (!shouldRetain) {
            operations.push(link.prepareDestroyPermanently());
            report.linksDestroyed += 1;
            continue;
          }

          retainedMuscleIds.add(link.muscleId);
          if (link.role !== 'primary') {
            operations.push(
              link.prepareUpdate((record) => {
                record.role = 'primary';
                record.updatedAt = now;
              })
            );
            report.linksUpdated += 1;
          }
        }

        for (const muscleId of desiredMuscleIds) {
          if (retainedMuscleIds.has(muscleId)) {
            continue;
          }
          operations.push(
            database.get<ExerciseMuscle>('exercise_muscles').prepareCreate((link) => {
              link.exerciseId = exerciseId;
              link.muscleId = muscleId;
              link.role = 'primary';
              link.createdAt = now;
              link.updatedAt = now;
              link.deletedAt = undefined;
            })
          );
          report.linksCreated += 1;
        }

        if (operations.length > 0) {
          groups.push(operations);
        }
      }

      for (const batch of operationBatches(groups)) {
        await database.batch(...batch);
      }
    });

    if (report.conflicts.length > 0) {
      throw new Error(`Exercise catalogue conflicts: ${report.conflicts.join('; ')}`);
    }

    return report;
  }

  /** May be called inside an existing writer; it never opens a write action itself. */
  static async isComplete(): Promise<boolean> {
    const catalogue = getExerciseCatalogue();
    const catalogueIds = catalogue.map(({ exerciseSlug }) => appExerciseId(exerciseSlug));
    const [muscleNameToId, { exerciseById, linksByExerciseId }] = await Promise.all([
      activeMuscleIdsByName(),
      loadCatalogueDatabaseState(catalogueIds),
    ]);

    return catalogue.every((entry) => {
      const exerciseId = appExerciseId(entry.exerciseSlug);
      const exercise = exerciseById.get(exerciseId);
      const expectedMuscleIds = desiredLinkIds(entry, muscleNameToId);
      if (!exercise || !expectedMuscleIds || !exerciseMatchesCatalogue(exercise, entry)) {
        return false;
      }

      const exerciseLinks = (linksByExerciseId.get(exerciseId) ?? []).filter(
        (link) => !link.deletedAt
      );
      return (
        exerciseLinks.length === expectedMuscleIds.size &&
        exerciseLinks.every(
          (link) => link.role === 'primary' && expectedMuscleIds.has(link.muscleId)
        )
      );
    });
  }
}
