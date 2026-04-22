import { Q } from '@nozbe/watermelondb';

import exercisesData from '@/data/exercisesData.json';
import { database } from '@/database/database-instance';
import Exercise from '@/database/models/Exercise';
import ExerciseMuscle, { type MuscleRole } from '@/database/models/ExerciseMuscle';
import Muscle from '@/database/models/Muscle';
import i18n, { EXERCISES_JSON } from '@/lang/lang';

interface ExerciseDataEntry {
  exerciseIndex: number;
  targetMuscles?: string[];
}

interface ExerciseLocaleEntry {
  exerciseIndex: number;
  name: string;
}

// Canonical muscle catalogue — single source of truth for seeding.
// displayNameKey must resolve via i18n.t(); all keys exist under exercises.muscleGroups.* in
// every locale so no separate muscles.json file is needed.
export const MUSCLE_SEED_DATA: { name: string; muscleGroup: string; displayNameKey: string }[] = [
  // Chest
  {
    name: 'pectoralis_major',
    muscleGroup: 'chest',
    displayNameKey: 'exercises.muscleGroups.pectoralis_major',
  },
  {
    name: 'serratus_anterior',
    muscleGroup: 'chest',
    displayNameKey: 'exercises.muscleGroups.serratus_anterior',
  },
  // Back
  { name: 'lats', muscleGroup: 'back', displayNameKey: 'exercises.muscleGroups.lats' },
  { name: 'rhomboids', muscleGroup: 'back', displayNameKey: 'exercises.muscleGroups.rhomboids' },
  { name: 'traps', muscleGroup: 'back', displayNameKey: 'exercises.muscleGroups.traps' },
  {
    name: 'upper_traps',
    muscleGroup: 'back',
    displayNameKey: 'exercises.muscleGroups.upper_traps',
  },
  {
    name: 'lower_traps',
    muscleGroup: 'back',
    displayNameKey: 'exercises.muscleGroups.lower_traps',
  },
  {
    name: 'erector_spinae',
    muscleGroup: 'back',
    displayNameKey: 'exercises.muscleGroups.erector_spinae',
  },
  {
    name: 'teres_major',
    muscleGroup: 'back',
    displayNameKey: 'exercises.muscleGroups.teres_major',
  },
  {
    name: 'quadratus_lumborum',
    muscleGroup: 'back',
    displayNameKey: 'exercises.muscleGroups.quadratus_lumborum',
  },
  // Shoulders
  {
    name: 'anterior_deltoid',
    muscleGroup: 'shoulders',
    displayNameKey: 'exercises.muscleGroups.anterior_deltoid',
  },
  {
    name: 'lateral_deltoid',
    muscleGroup: 'shoulders',
    displayNameKey: 'exercises.muscleGroups.lateral_deltoid',
  },
  {
    name: 'posterior_deltoid',
    muscleGroup: 'shoulders',
    displayNameKey: 'exercises.muscleGroups.posterior_deltoid',
  },
  {
    name: 'shoulders',
    muscleGroup: 'shoulders',
    displayNameKey: 'exercises.muscleGroups.shoulders',
  },
  // Arms
  { name: 'biceps', muscleGroup: 'arms', displayNameKey: 'exercises.muscleGroups.biceps' },
  {
    name: 'brachialis',
    muscleGroup: 'arms',
    displayNameKey: 'exercises.muscleGroups.brachialis',
  },
  { name: 'triceps', muscleGroup: 'arms', displayNameKey: 'exercises.muscleGroups.triceps' },
  { name: 'forearms', muscleGroup: 'arms', displayNameKey: 'exercises.muscleGroups.forearms' },
  // Core
  {
    name: 'rectus_abdominis',
    muscleGroup: 'core',
    displayNameKey: 'exercises.muscleGroups.rectus_abdominis',
  },
  {
    name: 'transverse_abdominis',
    muscleGroup: 'core',
    displayNameKey: 'exercises.muscleGroups.transverse_abdominis',
  },
  {
    name: 'external_obliques',
    muscleGroup: 'core',
    displayNameKey: 'exercises.muscleGroups.external_obliques',
  },
  {
    name: 'internal_obliques',
    muscleGroup: 'core',
    displayNameKey: 'exercises.muscleGroups.internal_obliques',
  },
  // Legs
  {
    name: 'quadriceps',
    muscleGroup: 'legs',
    displayNameKey: 'exercises.muscleGroups.quadriceps',
  },
  {
    name: 'hamstrings',
    muscleGroup: 'legs',
    displayNameKey: 'exercises.muscleGroups.hamstrings',
  },
  { name: 'glutes', muscleGroup: 'legs', displayNameKey: 'exercises.muscleGroups.glutes' },
  {
    name: 'gluteus_medius',
    muscleGroup: 'legs',
    displayNameKey: 'exercises.muscleGroups.gluteus_medius',
  },
  {
    name: 'gluteus_minimus',
    muscleGroup: 'legs',
    displayNameKey: 'exercises.muscleGroups.gluteus_minimus',
  },
  { name: 'calves', muscleGroup: 'legs', displayNameKey: 'exercises.muscleGroups.calves' },
  {
    name: 'adductors',
    muscleGroup: 'legs',
    displayNameKey: 'exercises.muscleGroups.adductors',
  },
  {
    name: 'abductors',
    muscleGroup: 'legs',
    displayNameKey: 'exercises.muscleGroups.abductors',
  },
  {
    name: 'hip_flexors',
    muscleGroup: 'legs',
    displayNameKey: 'exercises.muscleGroups.hip_flexors',
  },
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
   * Soft-deletes removed links and creates new ones in a single batch.
   * Safe to call from any context — manages its own write block.
   */
  static async setMusclesForExercise(
    exerciseId: string,
    muscleIds: string[],
    role: MuscleRole = 'primary'
  ): Promise<void> {
    const existing = await database
      .get<ExerciseMuscle>('exercise_muscles')
      .query(Q.where('exercise_id', exerciseId), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    const existingMuscleIds = new Set(existing.map((l) => l.muscleId));
    const newMuscleIds = new Set(muscleIds);
    const now = Date.now();

    const toDelete = existing.filter((l) => !newMuscleIds.has(l.muscleId));
    const toAdd = muscleIds.filter((id) => !existingMuscleIds.has(id));

    if (toDelete.length === 0 && toAdd.length === 0) {
      return;
    }

    await database.write(async () => {
      await database.batch(
        ...toDelete.map((l) =>
          l.prepareUpdate((link) => {
            link.deletedAt = now;
            link.updatedAt = now;
          })
        ),
        ...toAdd.map((muscleId) =>
          database.get<ExerciseMuscle>('exercise_muscles').prepareCreate((l) => {
            l.exerciseId = exerciseId;
            l.muscleId = muscleId;
            l.role = role;
            l.createdAt = now;
            l.updatedAt = now;
            l.deletedAt = undefined;
          })
        )
      );
    });
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

      // prepareCreate assigns IDs synchronously so we can populate the map before the batch runs
      const prepared = missing.map((data) => {
        const displayName = i18n.exists(data.displayNameKey)
          ? i18n.t(data.displayNameKey)
          : data.name
              .split('_')
              .map((w) => w[0].toUpperCase() + w.slice(1))
              .join(' ');

        const record = database.get<Muscle>('muscles').prepareCreate((m) => {
          m.name = data.name;
          m.muscleGroup = data.muscleGroup;
          m.displayName = displayName;
          m.createdAt = now;
          m.updatedAt = now;
          m.deletedAt = undefined;
        });

        existingByName.set(data.name, record.id);
        return record;
      });

      await database.write(async () => {
        await database.batch(...prepared);
      });
    }

    return existingByName;
  }

  /**
   * Backfills exercise_muscles for all app exercises that currently have no
   * muscle links. Reads targetMuscles from the bundled JSON (all languages).
   * Safe to call repeatedly — exercises that already have links are skipped.
   *
   * @param muscleNameToId Optional pre-fetched map from seedMuscles(). When
   *   provided, an extra seedMuscles() call is avoided (useful in the seeder
   *   where the map is already in hand).
   */
  static async backfillExerciseMuscles(muscleNameToId?: Map<string, string>): Promise<void> {
    // Build exerciseIndex->targetMuscles from the shared data file
    const indexToTargetMuscles = new Map<number, string[]>(
      (exercisesData as ExerciseDataEntry[])
        .filter((d) => d.targetMuscles?.length)
        .map((d) => [d.exerciseIndex, d.targetMuscles!])
    );

    // Build name->targetMuscles across all locales using locale names + data file muscles
    const nameToTargetMuscles = new Map<string, string[]>();
    for (const lang of Object.keys(EXERCISES_JSON) as (keyof typeof EXERCISES_JSON)[]) {
      for (const ex of EXERCISES_JSON[lang] as ExerciseLocaleEntry[]) {
        const muscles = indexToTargetMuscles.get(ex.exerciseIndex);
        if (muscles?.length) {
          nameToTargetMuscles.set(ex.name.toLowerCase(), muscles);
        }
      }
    }

    const nameToId = muscleNameToId ?? (await MuscleService.seedMuscles());

    const appExercises = await database
      .get<Exercise>('exercises')
      .query(Q.where('source', 'app'), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    if (appExercises.length === 0) {
      return;
    }

    // Scope the exercise_muscles scan to app exercise IDs only so we never
    // load links belonging to user-created exercises.
    const appExerciseIds = appExercises.map((ex) => ex.id);
    const linkedExerciseIds = new Set(
      (
        await database
          .get<ExerciseMuscle>('exercise_muscles')
          .query(Q.where('exercise_id', Q.oneOf(appExerciseIds)), Q.where('deleted_at', Q.eq(null)))
          .fetch()
      ).map((l) => l.exerciseId)
    );

    const toProcess = appExercises.filter((ex) => !linkedExerciseIds.has(ex.id));

    if (toProcess.length === 0) {
      return;
    }

    const now = Date.now();

    // Collect all junction records up front so the write block is a single batch
    const junctionRecords = toProcess.flatMap((exercise) => {
      const muscles = nameToTargetMuscles.get((exercise.name ?? '').toLowerCase());
      if (!muscles?.length) {
        return [];
      }

      return muscles
        .map((name) => nameToId.get(name))
        .filter((id): id is string => !!id)
        .map((muscleId) =>
          database.get<ExerciseMuscle>('exercise_muscles').prepareCreate((l) => {
            l.exerciseId = exercise.id;
            l.muscleId = muscleId;
            l.role = 'primary';
            l.createdAt = now;
            l.updatedAt = now;
            l.deletedAt = undefined;
          })
        );
    });

    if (junctionRecords.length > 0) {
      await database.write(async () => {
        await database.batch(...junctionRecords);
      });
    }

    console.log(`[backfillExerciseMuscles] Linked muscles for ${toProcess.length} exercise(s)`);
  }
}
