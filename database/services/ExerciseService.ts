import { Q } from '@nozbe/watermelondb';

import exercisesEnUS from '@/data/exercisesEnUS.json';
import exercisesPtBr from '@/data/exercisesPtBr.json';
import { database } from '@/database';
import Exercise, {
  type EquipmentType,
  type ExerciseSource,
  type MechanicType,
  type MuscleGroup,
} from '@/database/models/Exercise';
import i18n, { PT_BR } from '@/lang/lang';
import { buildExerciseCloudUrl } from '@/utils/exerciseImage';

interface ExerciseJsonData {
  name: string;
  muscleGroup: string;
  type: 'compound' | 'isolation' | 'machine' | 'bodyweight' | 'cardio' | 'plyometric';
  description: string;
  targetMuscles?: string[];
  loadMultiplier?: number;
}

function getExercisesData(): ExerciseJsonData[] {
  return (i18n.language === PT_BR ? exercisesPtBr : exercisesEnUS) as ExerciseJsonData[];
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
   * Maps JSON exercise type to Exercise model fields
   */
  private static mapExerciseType(type: ExerciseJsonData['type']): {
    mechanicType: MechanicType;
    equipmentType: EquipmentType;
  } {
    let mechanicType: MechanicType = 'compound';
    let equipmentType: EquipmentType;

    switch (type) {
      case 'compound':
        mechanicType = 'compound';
        // Try to infer equipment from name (will default to barbell)
        equipmentType = 'barbell';
        break;
      case 'isolation':
        mechanicType = 'isolation';
        // Try to infer equipment from name (will default to dumbbell for isolation)
        equipmentType = 'dumbbell';
        break;
      case 'machine':
        mechanicType = 'compound'; // Machine exercises can be compound or isolation, default to compound
        equipmentType = 'machine';
        break;
      case 'bodyweight':
        mechanicType = 'compound'; // Bodyweight exercises can be compound or isolation, default to compound
        equipmentType = 'bodyweight';
        break;
      case 'cardio':
        mechanicType = 'compound';
        equipmentType = 'other'; // Cardio exercises don't have specific equipment type
        break;
      case 'plyometric':
        mechanicType = 'compound';
        equipmentType = 'other';
        break;
      default:
        mechanicType = 'compound';
        equipmentType = 'barbell';
    }

    return { mechanicType, equipmentType };
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
      return 'machine' as EquipmentType;
    }

    return defaultEquipment;
  }

  /**
   * Create common exercises from the exercises JSON data.
   * Sets exercise.imageUrl to the GitHub raw-content cloud URL for the corresponding image.
   * Returns array of created exercises.
   */
  static async createCommonExercises(): Promise<Exercise[]> {
    const exercises: Exercise[] = [];
    const exercisesJson = getExercisesData();
    const now = Date.now();

    await database.write(async () => {
      // Get all existing exercises to check for duplicates
      const existingExercises = await database.get<Exercise>('exercises').query().fetch();
      const existingNames = new Set(
        existingExercises.map((ex: Exercise) => (ex.name ?? '').toLowerCase())
      );

      // Prepare all new exercises
      const exercisesToCreate = exercisesJson
        .filter((exerciseData) => {
          // Skip if exercise already exists
          return !existingNames.has(exerciseData.name.toLowerCase());
        })
        .map((exerciseData) => {
          const jsonIndex = exercisesJson.indexOf(exerciseData);
          const { mechanicType, equipmentType: defaultEquipment } = this.mapExerciseType(
            exerciseData.type
          );
          const equipmentType = this.inferEquipmentFromName(exerciseData.name, defaultEquipment);

          return database.get<Exercise>('exercises').prepareCreate((exercise) => {
            exercise.name = exerciseData.name;
            exercise.description = exerciseData.description;
            exercise.muscleGroup = exerciseData.muscleGroup as MuscleGroup;
            exercise.equipmentType = equipmentType as EquipmentType;
            exercise.mechanicType = mechanicType as MechanicType;
            exercise.source = 'app';
            exercise.loadMultiplier = exerciseData.loadMultiplier ?? 1.0;
            exercise.imageUrl = buildExerciseCloudUrl(jsonIndex + 1);
            exercise.createdAt = now;
            exercise.updatedAt = now;
            exercise.deletedAt = undefined;
          });
        });

      // Batch create all new exercises (same approach as dev.ts)
      if (exercisesToCreate.length > 0) {
        await database.batch(...exercisesToCreate);

        // Fetch the newly created exercises to return them
        const newlyCreatedNames = new Set(
          exercisesJson
            .filter((exerciseData) => !existingNames.has(exerciseData.name.toLowerCase()))
            .map((exerciseData) => exerciseData.name.toLowerCase())
        );

        const allExercisesAfter = await database.get<Exercise>('exercises').query().fetch();
        const newExercises = allExercisesAfter.filter((ex) =>
          newlyCreatedNames.has((ex.name ?? '').toLowerCase())
        );

        exercises.push(...newExercises);
      }
    });

    return exercises;
  }

  /**
   * Backfills the `source` field for exercises that predate the column addition.
   * Exercises with no source are ordered by creation date (oldest first); the first
   * `appExerciseCount` are assumed to be app-seeded and get `'app'`, the rest get `'user'`.
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
   * Backfills order_index for app exercises based on their position in the JSON file.
   * This ensures app exercises appear in the same order as the JSON file.
   * Searches both enUS and ptBR JSON files since we don't know which language was used during seeding.
   * order_index starts at 0 (but exercise images use index + 1).
   * Safe to call repeatedly — already-correct exercises are left untouched.
   */
  static async backfillExerciseOrderIndex(): Promise<void> {
    // Build name-to-index maps for both JSON files
    const enUsNameToIndex = new Map(
      exercisesEnUS.map((ex, index) => [(ex as ExerciseJsonData).name.toLowerCase(), index])
    );

    const ptBrNameToIndex = new Map(
      exercisesPtBr.map((ex, index) => [(ex as ExerciseJsonData).name.toLowerCase(), index])
    );

    // Find app exercises without order_index (null/undefined)
    const appExercises = await database
      .get<Exercise>('exercises')
      .query(Q.where('source', 'app'), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    const toUpdate: { exercise: Exercise; jsonIndex: number }[] = [];

    for (const exercise of appExercises) {
      // Skip if already has order_index set (not null/undefined)
      if (exercise.orderIndex !== null && exercise.orderIndex !== undefined) {
        continue;
      }

      const exerciseName = (exercise.name ?? '').toLowerCase();
      // Try enUS first, then ptBR
      let jsonIndex = enUsNameToIndex.get(exerciseName);
      if (jsonIndex === undefined) {
        jsonIndex = ptBrNameToIndex.get(exerciseName);
      }

      if (jsonIndex !== undefined) {
        toUpdate.push({ exercise, jsonIndex });
      }
    }

    if (toUpdate.length === 0) {
      return;
    }

    await database.write(async () => {
      for (const { exercise, jsonIndex } of toUpdate) {
        await exercise.update((e) => {
          e.orderIndex = jsonIndex;
        });
      }
    });

    console.log(
      `[backfillExerciseOrderIndex] Backfilled order_index for ${toUpdate.length} exercise(s)`
    );
  }

  /**
   * Repairs app exercises that are missing an imageUrl by setting the cloud URL.
   * Safe to call on every app start — it's a no-op when all images are already present.
   */
  static async repairMissingExerciseImages(): Promise<void> {
    const exercisesJson = getExercisesData();
    const allExercises = await database.get<Exercise>('exercises').query().fetch();
    const broken = allExercises.filter(
      (ex) => !ex.imageUrl && !ex.deletedAt && ex.source === 'app'
    );

    if (broken.length === 0) {
      return;
    }

    await database.write(async () => {
      for (const exercise of broken) {
        const jsonIndex = exercisesJson.findIndex(
          (j) => j.name.toLowerCase() === (exercise.name ?? '').toLowerCase()
        );

        if (jsonIndex < 0) {
          continue;
        }

        await exercise.update((e) => {
          e.imageUrl = buildExerciseCloudUrl(jsonIndex + 1);
        });
      }
    });

    console.log(`Repaired ${broken.length} exercise image(s)`);
  }

  /**
   * JS equivalent of the v7 SQL migration for the LokiJS (web) adapter, which
   * silently ignores unsafeExecuteSql. Replaces file:// exercise image URIs with
   * cloud URLs for all app-seeded exercises. Safe to call repeatedly — exits
   * immediately when there is nothing to migrate.
   */
  static async migrateExerciseImageUrlsToCloud(): Promise<void> {
    const exercisesJson = getExercisesData();
    const allExercises = await database
      .get<Exercise>('exercises')
      .query(Q.where('source', 'app'))
      .fetch();

    const toMigrate = allExercises.filter(
      (ex) => ex.imageUrl?.startsWith('file://') && ex.imageUrl.includes('/exercises/')
    );

    if (toMigrate.length === 0) {
      return;
    }

    await database.write(async () => {
      for (const exercise of toMigrate) {
        const imageUrl = exercise.imageUrl ?? '';
        const filename = imageUrl.split('/exercises/').pop() ?? '';

        if (filename === 'fallback.png') {
          await exercise.update((e) => {
            e.imageUrl = undefined;
          });
          continue;
        }

        // Derive exercise number from filename (e.g. "1.png" → 1)
        const exerciseNumber = parseInt(filename.replace('.png', ''), 10);
        if (!Number.isNaN(exerciseNumber)) {
          await exercise.update((e) => {
            e.imageUrl = buildExerciseCloudUrl(exerciseNumber);
          });
          continue;
        }

        // Filename doesn't match expected pattern — fall back to JSON lookup
        const jsonIndex = exercisesJson.findIndex(
          (j) => j.name.toLowerCase() === (exercise.name ?? '').toLowerCase()
        );
        if (jsonIndex >= 0) {
          await exercise.update((e) => {
            e.imageUrl = buildExerciseCloudUrl(jsonIndex + 1);
          });
        }
      }
    });

    console.log(`[migrateExerciseImageUrlsToCloud] Migrated ${toMigrate.length} exercise(s)`);
  }

  /**
   * Compares the bundled exercisesEnUS.json against the exercises in the DB that
   * have source='app', and creates any entries that are missing. Intended to run
   * on every app boot so that new exercises added to the JSON in a future update
   * are automatically seeded for existing users.
   *
   * Safe to call repeatedly — exits immediately when nothing is missing.
   * Returns the number of exercises created (0 on a no-op boot).
   */
  static async syncAppExercises(): Promise<number> {
    const exercisesJson = getExercisesData();

    // Collect names of non-deleted app exercises already in the DB
    const existing = await database
      .get<Exercise>('exercises')
      .query(Q.where('source', 'app'), Q.where('deleted_at', Q.eq(null)))
      .fetch();
    const existingNames = new Set(existing.map((ex) => (ex.name ?? '').toLowerCase()));

    // Determine which JSON entries are missing from the DB
    const missing = exercisesJson.filter((data) => !existingNames.has(data.name.toLowerCase()));

    if (missing.length === 0) {
      return 0;
    }

    const now = Date.now();

    // Prepare records — prepareCreate assigns IDs and is usable after batch()
    const prepared = missing.map((data) => {
      const jsonIndex = exercisesJson.indexOf(data);
      const { mechanicType, equipmentType: defaultEquipment } = this.mapExerciseType(data.type);
      const equipmentType = this.inferEquipmentFromName(data.name, defaultEquipment);

      return database.get<Exercise>('exercises').prepareCreate((exercise) => {
        exercise.name = data.name;
        exercise.description = data.description;
        exercise.muscleGroup = data.muscleGroup as MuscleGroup;
        exercise.equipmentType = equipmentType as EquipmentType;
        exercise.mechanicType = mechanicType as MechanicType;
        exercise.source = 'app';
        exercise.loadMultiplier = data.loadMultiplier ?? 1.0;
        exercise.orderIndex = jsonIndex;
        exercise.imageUrl = buildExerciseCloudUrl(jsonIndex + 1);
        exercise.createdAt = now;
        exercise.updatedAt = now;
        exercise.deletedAt = undefined;
      });
    });

    await database.write(async () => {
      await database.batch(...prepared);
    });

    console.log(`[syncAppExercises] Created ${prepared.length} new app exercise(s)`);
    return prepared.length;
  }
}
