import { Q, Query } from '@nozbe/watermelondb';
import { database } from '../database-instance';
import Schedule from '../models/Schedule';

/**
 * Repository for Schedule queries
 * This file contains static query methods that require the database instance.
 * This pattern avoids circular dependencies between models and the database instance.
 */
export class ScheduleRepository {
  static getForDay(dayOfWeek: string): Query<Schedule> {
    return database
      .get<Schedule>('schedules')
      .query(Q.where('day_of_week', dayOfWeek), Q.where('deleted_at', Q.eq(null)));
  }
}
