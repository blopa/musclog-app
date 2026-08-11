import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import Exercise, {
  type EquipmentType,
  type ExerciseSource,
  type MechanicType,
  type MuscleGroup,
} from '@/database/models/Exercise';

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
    } catch {
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
   * Ordered by catalogue position, then user name, with id as a stable page tiebreaker.
   * Supports filter by muscle group and/or search by name.
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
      Q.sortBy('name', Q.asc),
      Q.sortBy('id', Q.asc)
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
   * Backfills the `source` field for exercises that predate the column addition.
   * Exercises with no source are ordered by creation date (oldest first); the first
   * `appExerciseCount` are assumed to be app-seeded and get `'app'`, the rest get `'user'`.
   * The default count is a frozen historical heuristic, not the current catalogue size.
   * Anything it identifies as an old app exercise is retired by
   * `LegacyExerciseCatalogueMigration` later in the same boot, which is the intended outcome.
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
}
