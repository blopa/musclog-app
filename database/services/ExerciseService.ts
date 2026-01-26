import { database } from '../index';
import Exercise from '../models/Exercise';
import { Q } from '@nozbe/watermelondb';

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
  static async getExercisesByMuscleGroup(muscleGroup: string): Promise<Exercise[]> {
    return await database
      .get<Exercise>('exercises')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('muscle_group', muscleGroup)
      )
      .fetch();
  }

  /**
   * Get exercises by equipment type
   */
  static async getExercisesByEquipmentType(equipmentType: string): Promise<Exercise[]> {
    return await database
      .get<Exercise>('exercises')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('equipment_type', equipmentType)
      )
      .fetch();
  }

  /**
   * Get exercises by mechanic type
   */
  static async getExercisesByMechanicType(mechanicType: string): Promise<Exercise[]> {
    return await database
      .get<Exercise>('exercises')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('mechanic_type', mechanicType)
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
        Q.where('name', Q.like(`%${searchTerm}%`))
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
    muscleGroup: string,
    equipmentType: string,
    mechanicType: string,
    imageUrl?: string
  ): Promise<Exercise> {
    return await database.write(async () => {
      const now = Date.now();
      
      return await database.get<Exercise>('exercises').create(exercise => {
        exercise.name = name;
        exercise.description = description;
        exercise.imageUrl = imageUrl;
        exercise.muscleGroup = muscleGroup;
        exercise.equipmentType = equipmentType;
        exercise.mechanicType = mechanicType;
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
      muscleGroup?: string;
      equipmentType?: string;
      mechanicType?: string;
    }
  ): Promise<Exercise> {
    return await database.write(async () => {
      const exercise = await database.get<Exercise>('exercises').find(id);
      
      if (exercise.deletedAt) {
        throw new Error('Cannot update deleted exercise');
      }
      
      await exercise.update(record => {
        if (updates.name !== undefined) record.name = updates.name;
        if (updates.description !== undefined) record.description = updates.description;
        if (updates.imageUrl !== undefined) record.imageUrl = updates.imageUrl;
        if (updates.muscleGroup !== undefined) record.muscleGroup = updates.muscleGroup;
        if (updates.equipmentType !== undefined) record.equipmentType = updates.equipmentType;
        if (updates.mechanicType !== undefined) record.mechanicType = updates.mechanicType;
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
      .query(
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();
    
    // Extract unique muscle groups
    const muscleGroups = [...new Set(exercises.map(ex => ex.muscleGroup))];
    return muscleGroups.sort();
  }

  /**
   * Get all equipment types
   */
  static async getEquipmentTypes(): Promise<string[]> {
    const exercises = await database
      .get<Exercise>('exercises')
      .query(
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();
    
    // Extract unique equipment types
    const equipmentTypes = [...new Set(exercises.map(ex => ex.equipmentType))];
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
      .query(
        Q.where('deleted_at', Q.eq(null)),
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
}
