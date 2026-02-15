import { Q } from '@nozbe/watermelondb';

import { database } from '../index';
import Exercise, {
  type EquipmentType,
  type MechanicType,
  type MuscleGroup,
} from '../models/Exercise';

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
        if (updates.name !== undefined) record.name = updates.name;
        if (updates.description !== undefined) record.description = updates.description;
        if (updates.imageUrl !== undefined) record.imageUrl = updates.imageUrl;
        if (updates.muscleGroup !== undefined)
          record.muscleGroup = updates.muscleGroup as MuscleGroup;
        if (updates.equipmentType !== undefined)
          record.equipmentType = updates.equipmentType as EquipmentType;
        if (updates.mechanicType !== undefined)
          record.mechanicType = updates.mechanicType as MechanicType;
        if (updates.loadMultiplier !== undefined) record.loadMultiplier = updates.loadMultiplier;
        record.updatedAt = Date.now();
      });

      return exercise;
    });
  }

  /**
   * Delete exercise (soft delete)
   */
  static async deleteExercise(id: string): Promise<void> {
    return await database.write(async () => {
      const exercise = await database.get<Exercise>('exercises').find(id);
      await exercise.markAsDeleted();
    });
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
   * Get frequently used exercises (based on workout logs)
   */
  static async getFrequentlyUsedExercises(limit: number = 10): Promise<Exercise[]> {
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
}
