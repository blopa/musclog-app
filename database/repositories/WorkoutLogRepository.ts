import { Q, Query } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import WorkoutLog from '@/database/models/WorkoutLog';

/**
 * Repository for WorkoutLog queries
 * This file contains static query methods that require the database instance.
 * This pattern avoids circular dependencies between models and the database instance.
 */
export class WorkoutLogRepository {
  static getActive(): Query<WorkoutLog> {
    return database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('completed_at', Q.eq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('started_at', Q.desc)
      );
  }

  static getCompleted(timeframe?: { startDate: number; endDate: number }): Query<WorkoutLog> {
    let query = database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('completed_at', Q.notEq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('started_at', Q.desc)
      );

    if (timeframe) {
      query = query.extend(
        Q.where('started_at', Q.gte(timeframe.startDate)),
        Q.where('started_at', Q.lte(timeframe.endDate))
      );
    }

    return query;
  }
}
