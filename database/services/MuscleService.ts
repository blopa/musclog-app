import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import Exercise from '@/database/models/Exercise';
import ExerciseMuscle from '@/database/models/ExerciseMuscle';
import Muscle from '@/database/models/Muscle';
import i18n, { EXERCISES_JSON } from '@/lang/lang';

interface ExerciseJsonData {
  name: string;
  muscleGroup: string;
  targetMuscles?: string[];
}

// Canonical muscle catalogue — single source of truth for seeding
export const MUSCLE_SEED_DATA: { name: string; muscleGroup: string; displayNameKey: string }[] = [
  // Chest
  { name: 'pectoralis_major', muscleGroup: 'chest', displayNameKey: 'muscles.pectoralis_major' },
  { name: 'pectineus', muscleGroup: 'chest', displayNameKey: 'muscles.pectineus' },
  { name: 'serratus_anterior', muscleGroup: 'chest', displayNameKey: 'muscles.serratus_anterior' },
  // Back
  { name: 'lats', muscleGroup: 'back', displayNameKey: 'muscles.lats' },
  { name: 'rhomboids', muscleGroup: 'back', displayNameKey: 'muscles.rhomboids' },
  { name: 'traps', muscleGroup: 'back', displayNameKey: 'muscles.traps' },
  { name: 'upper_traps', muscleGroup: 'back', displayNameKey: 'muscles.upper_traps' },
  { name: 'lower_traps', muscleGroup: 'back', displayNameKey: 'muscles.lower_traps' },
  { name: 'erector_spinae', muscleGroup: 'back', displayNameKey: 'muscles.erector_spinae' },
  { name: 'teres_major', muscleGroup: 'back', displayNameKey: 'muscles.teres_major' },
  { name: 'quadratus_lumborum', muscleGroup: 'back', displayNameKey: 'muscles.quadratus_lumborum' },
  // Shoulders
  {
    name: 'anterior_deltoid',
    muscleGroup: 'shoulders',
    displayNameKey: 'muscles.anterior_deltoid',
  },
  { name: 'lateral_deltoid', muscleGroup: 'shoulders', displayNameKey: 'muscles.lateral_deltoid' },
  {
    name: 'posterior_deltoid',
    muscleGroup: 'shoulders',
    displayNameKey: 'muscles.posterior_deltoid',
  },
  { name: 'shoulders', muscleGroup: 'shoulders', displayNameKey: 'muscles.shoulders' },
  // Arms
  { name: 'biceps', muscleGroup: 'arms', displayNameKey: 'muscles.biceps' },
  { name: 'brachialis', muscleGroup: 'arms', displayNameKey: 'muscles.brachialis' },
  { name: 'triceps', muscleGroup: 'arms', displayNameKey: 'muscles.triceps' },
  { name: 'forearms', muscleGroup: 'arms', displayNameKey: 'muscles.forearms' },
  // Core
  { name: 'rectus_abdominis', muscleGroup: 'core', displayNameKey: 'muscles.rectus_abdominis' },
  {
    name: 'transverse_abdominis',
    muscleGroup: 'core',
    displayNameKey: 'muscles.transverse_abdominis',
  },
  { name: 'external_obliques', muscleGroup: 'core', displayNameKey: 'muscles.external_obliques' },
  { name: 'internal_obliques', muscleGroup: 'core', displayNameKey: 'muscles.internal_obliques' },
  // Legs
  { name: 'quadriceps', muscleGroup: 'legs', displayNameKey: 'muscles.quadriceps' },
  { name: 'hamstrings', muscleGroup: 'legs', displayNameKey: 'muscles.hamstrings' },
  { name: 'glutes', muscleGroup: 'legs', displayNameKey: 'muscles.glutes' },
  { name: 'gluteus_medius', muscleGroup: 'legs', displayNameKey: 'muscles.gluteus_medius' },
  { name: 'gluteus_minimus', muscleGroup: 'legs', displayNameKey: 'muscles.gluteus_minimus' },
  { name: 'calves', muscleGroup: 'legs', displayNameKey: 'muscles.calves' },
  { name: 'adductors', muscleGroup: 'legs', displayNameKey: 'muscles.adductors' },
  { name: 'abductors', muscleGroup: 'legs', displayNameKey: 'muscles.abductors' },
  { name: 'hip_flexors', muscleGroup: 'legs', displayNameKey: 'muscles.hip_flexors' },
];

export class MuscleService {
  /**
   * Get all muscles (non-deleted), sorted by muscle_group then name.
   */
  static async getAllMuscles(): Promise<Muscle[]> {
    return database
      .get<Muscle>('muscles')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('muscle_group', Q.asc),
        Q.sortBy('name', Q.asc)
      )
      .fetch();
  }

  /**
   * Get all muscles for a given exercise, via exercise_muscles junction.
   */
  static async getMusclesForExercise(exerciseId: string): Promise<Muscle[]> {
    const links = await database
      .get<ExerciseMuscle>('exercise_muscles')
      .query(Q.where('exercise_id', exerciseId), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    if (links.length === 0) {
      return [];
    }

    const muscleIds = links.map((l) => l.muscleId);
    return database
      .get<Muscle>('muscles')
      .query(Q.where('id', Q.oneOf(muscleIds)), Q.where('deleted_at', Q.eq(null)))
      .fetch();
  }

  /**
   * Get muscles for multiple exercises at once.
   * Returns a map of exerciseId -> Muscle[].
   */
  static async getMusclesForExercises(exerciseIds: string[]): Promise<Map<string, Muscle[]>> {
    if (exerciseIds.length === 0) {
      return new Map();
    }

    const links = await database
      .get<ExerciseMuscle>('exercise_muscles')
      .query(Q.where('exercise_id', Q.oneOf(exerciseIds)), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    if (links.length === 0) {
      return new Map();
    }

    const muscleIds = [...new Set(links.map((l) => l.muscleId))];
    const muscles = await database
      .get<Muscle>('muscles')
      .query(Q.where('id', Q.oneOf(muscleIds)), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    const muscleById = new Map(muscles.map((m) => [m.id, m]));
    const result = new Map<string, Muscle[]>();

    for (const link of links) {
      const muscle = muscleById.get(link.muscleId);
      if (!muscle) {
        continue;
      }
      const list = result.get(link.exerciseId) ?? [];
      list.push(muscle);
      result.set(link.exerciseId, list);
    }

    return result;
  }

  /**
   * Get all exercises targeting a specific muscle (by muscle name).
   * Returns exercise IDs.
   */
  static async getExerciseIdsForMuscle(muscleName: string): Promise<string[]> {
    const muscles = await database
      .get<Muscle>('muscles')
      .query(Q.where('name', muscleName), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    if (muscles.length === 0) {
      return [];
    }

    const links = await database
      .get<ExerciseMuscle>('exercise_muscles')
      .query(
        Q.where('muscle_id', Q.oneOf(muscles.map((m) => m.id))),
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();

    return [...new Set(links.map((l) => l.exerciseId))];
  }

  /**
   * Replace the full set of muscles linked to an exercise.
   * Soft-deletes existing links then creates new ones — must be called
   * inside an existing database.write() block.
   */
  static async setMusclesForExerciseInWrite(
    exerciseId: string,
    muscleIds: string[],
    now: number
  ): Promise<void> {
    const existing = await database
      .get<ExerciseMuscle>('exercise_muscles')
      .query(Q.where('exercise_id', exerciseId), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    const existingMuscleIds = new Set(existing.map((l) => l.muscleId));
    const newMuscleIds = new Set(muscleIds);

    // Soft-delete links that are no longer wanted
    for (const link of existing) {
      if (!newMuscleIds.has(link.muscleId)) {
        await link.update((l) => {
          l.deletedAt = now;
          l.updatedAt = now;
        });
      }
    }

    // Create links that don't exist yet
    for (const muscleId of muscleIds) {
      if (!existingMuscleIds.has(muscleId)) {
        await database.get<ExerciseMuscle>('exercise_muscles').create((l) => {
          l.exerciseId = exerciseId;
          l.muscleId = muscleId;
          l.createdAt = now;
          l.updatedAt = now;
        });
      }
    }
  }

  /**
   * Seed the muscles table from MUSCLE_SEED_DATA.
   * Returns a name→id map for all muscles (existing + newly created).
   * Safe to call repeatedly — skips muscles that already exist.
   */
  static async seedMuscles(): Promise<Map<string, string>> {
    const existing = await database
      .get<Muscle>('muscles')
      .query(Q.where('deleted_at', Q.eq(null)))
      .fetch();

    const existingByName = new Map(existing.map((m) => [m.name, m.id]));

    const missing = MUSCLE_SEED_DATA.filter((d) => !existingByName.has(d.name));

    if (missing.length > 0) {
      const now = Date.now();
      await database.write(async () => {
        for (const data of missing) {
          const displayName = i18n.exists(data.displayNameKey)
            ? i18n.t(data.displayNameKey)
            : data.name
                .split('_')
                .map((w) => w[0].toUpperCase() + w.slice(1))
                .join(' ');

          const record = await database.get<Muscle>('muscles').create((m) => {
            m.name = data.name;
            m.muscleGroup = data.muscleGroup;
            m.displayName = displayName;
            m.createdAt = now;
            m.updatedAt = now;
          });

          existingByName.set(data.name, record.id);
        }
      });
    }

    return existingByName;
  }

  /**
   * Backfills exercise_muscles for all app exercises that currently have no
   * muscle links. Reads targetMuscles from the bundled JSON (all languages).
   * Safe to call repeatedly — exercises that already have links are skipped.
   */
  static async backfillExerciseMuscles(): Promise<void> {
    // Build name->targetMuscles map from all language JSONs
    const nameToTargetMuscles = new Map<string, string[]>();
    for (const lang of Object.keys(EXERCISES_JSON) as (keyof typeof EXERCISES_JSON)[]) {
      for (const ex of EXERCISES_JSON[lang]) {
        const data = ex as ExerciseJsonData;
        if (data.targetMuscles?.length) {
          nameToTargetMuscles.set(data.name.toLowerCase(), data.targetMuscles);
        }
      }
    }

    // Ensure muscles are seeded
    const muscleNameToId = await MuscleService.seedMuscles();

    // Find app exercises that have no muscle links yet
    const appExercises = await database
      .get<Exercise>('exercises')
      .query(Q.where('source', 'app'), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    const linkedExerciseIds = new Set(
      (
        await database
          .get<ExerciseMuscle>('exercise_muscles')
          .query(Q.where('deleted_at', Q.eq(null)))
          .fetch()
      ).map((l) => l.exerciseId)
    );

    const toProcess = appExercises.filter((ex) => !linkedExerciseIds.has(ex.id));

    if (toProcess.length === 0) {
      return;
    }

    const now = Date.now();

    await database.write(async () => {
      for (const exercise of toProcess) {
        const muscles = nameToTargetMuscles.get((exercise.name ?? '').toLowerCase());
        if (!muscles?.length) {
          continue;
        }

        const muscleIds = muscles
          .map((name) => muscleNameToId.get(name))
          .filter((id): id is string => !!id);

        for (const muscleId of muscleIds) {
          await database.get<ExerciseMuscle>('exercise_muscles').create((l) => {
            l.exerciseId = exercise.id;
            l.muscleId = muscleId;
            l.createdAt = now;
            l.updatedAt = now;
          });
        }
      }
    });

    console.log(`[backfillExerciseMuscles] Linked muscles for ${toProcess.length} exercise(s)`);
  }
}
