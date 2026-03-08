import { Q } from '@nozbe/watermelondb';

import exercisesData from '../../data/exercisesEnUS.json';
import {
  getBundledExerciseImageSourceByIndex,
  getExerciseImageFilenameByIndex,
} from '../../utils/exerciseImage';
import { copyBundledExerciseImageToDocument } from '../../utils/file';
import { database } from '../index';
import Exercise, {
  type EquipmentType,
  type MechanicType,
  type MuscleGroup,
} from '../models/Exercise';

interface ExerciseJsonData {
  name: string;
  muscleGroup: string;
  type: 'compound' | 'isolation' | 'machine' | 'bodyweight' | 'cardio' | 'plyometric';
  description: string;
  targetMuscles?: string[];
  loadMultiplier?: number;
}

export class ExerciseService {
  /**
   * Get all exercises (non-deleted)
   */
  static async getAllExercises(): Promise<Exercise[]> {
    return await database
      .get<Exercise>('exercises')
      .query(Q.where('deleted_at', Q.eq(null)))
      .fetch();
  }

  /**
   * Get exercises by muscle group
   */
  static async getExercisesByMuscleGroup(muscleGroup: MuscleGroup | string): Promise<Exercise[]> {
    return await database
      .get<Exercise>('exercises')
      .query(Q.where('deleted_at', Q.eq(null)), Q.where('muscle_group', muscleGroup))
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
      .query(Q.where('deleted_at', Q.eq(null)), Q.where('equipment_type', equipmentType))
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
      .query(Q.where('deleted_at', Q.eq(null)), Q.where('mechanic_type', mechanicType))
      .fetch();
  }

  /**
   * Search exercises by name
   */
  static async searchExercises(searchTerm: string): Promise<Exercise[]> {
    return await database
      .get<Exercise>('exercises')
      .query(Q.where('deleted_at', Q.eq(null)), Q.where('name', Q.like(`%${searchTerm}%`)))
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
    imageUrl?: string
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

    query = query.extend(Q.sortBy('name', Q.asc));
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
    // For now, we'll return exercises ordered by creation date (most recent first)
    return await database
      .get<Exercise>('exercises')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc), Q.take(limit))
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
   * Copies bundled images (by JSON array index) to document storage and sets exercise.imageUrl.
   * Returns array of created exercises.
   */
  static async createCommonExercises(): Promise<Exercise[]> {
    const exercises: Exercise[] = [];
    const exercisesJson = exercisesData as ExerciseJsonData[];
    const now = Date.now();

    const created = await database.write(async () => {
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
            exercise.loadMultiplier = exerciseData.loadMultiplier ?? 1.0; // Default to 1.0 if not specified
            exercise.imageUrl = undefined; // No image URLs in JSON
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

      return exercises;
    });

    // Copy bundled images (by JSON index) to document dir and set imageUrl
    const updates: { exercise: Exercise; fileUri: string }[] = [];
    for (const exercise of created) {
      const jsonIndex = exercisesJson.findIndex(
        (j) => j.name.toLowerCase() === (exercise.name ?? '').toLowerCase()
      );

      if (jsonIndex < 0) {
        continue;
      }

      try {
        const assetSource = getBundledExerciseImageSourceByIndex(jsonIndex);
        const filename = getExerciseImageFilenameByIndex(jsonIndex);
        const fileUri = await copyBundledExerciseImageToDocument(assetSource, filename);
        updates.push({ exercise, fileUri });
      } catch (err) {
        console.warn('Failed to copy exercise image for', exercise.name, err);
      }
    }

    if (updates.length > 0) {
      await database.write(async () => {
        for (const { exercise, fileUri } of updates) {
          await exercise.update((e) => {
            e.imageUrl = fileUri;
          });
        }
      });
    }

    return created;
  }
}
