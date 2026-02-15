import { Q, Query } from '@nozbe/watermelondb';

import { database } from '../database-instance';
import WorkoutTemplate from '../models/WorkoutTemplate';

/**
 * Repository for WorkoutTemplate queries
 * This file contains static query methods that require the database instance.
 * This pattern avoids circular dependencies between models and the database instance.
 */
export class WorkoutTemplateRepository {
  static getActive(): Query<WorkoutTemplate> {
    return database
      .get<WorkoutTemplate>('workout_templates')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('is_archived', Q.eq(false)),
        Q.sortBy('created_at', Q.desc)
      );
  }

  static getAll(): Query<WorkoutTemplate> {
    return database
      .get<WorkoutTemplate>('workout_templates')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc));
  }

  static getArchived(): Query<WorkoutTemplate> {
    return database
      .get<WorkoutTemplate>('workout_templates')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('is_archived', Q.eq(true)),
        Q.sortBy('created_at', Q.desc)
      );
  }
}
