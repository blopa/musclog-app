import { Q } from '@nozbe/watermelondb';

import { database } from '../index';
import UserMetric, { type UserMetricType } from '../models/UserMetric';

export class UserMetricService {
  /**
   * Get latest metric value for a specific type
   */
  static async getLatest(type: UserMetricType | string): Promise<UserMetric | null> {
    const metrics = await database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', type),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('date', Q.desc),
        Q.take(1)
      )
      .fetch();
    return metrics.length > 0 ? metrics[0] : null;
  }

  /**
   * Get metrics history with pagination support
   */
  static async getMetricsHistory(
    type?: UserMetricType | string, // Optional filter by metric type
    dateRange?: { startDate: number; endDate: number }, // Optional date range
    limit?: number,
    offset?: number
  ): Promise<UserMetric[]> {
    let query = database.get<UserMetric>('user_metrics').query(
      Q.where('deleted_at', Q.eq(null)),
      Q.sortBy('date', Q.desc) // Most recent first
    );

    if (type) {
      query = query.extend(Q.where('type', type));
    }

    if (dateRange) {
      query = query.extend(
        Q.where('date', Q.gte(dateRange.startDate)),
        Q.where('date', Q.lte(dateRange.endDate))
      );
    }

    // Apply pagination (same pattern as WorkoutService.getWorkoutHistory)
    if (limit) {
      if (offset !== undefined && offset !== null && offset > 0) {
        // Apply both skip and take together - skip must come before take
        query = query.extend(Q.skip(offset), Q.take(limit));
      } else {
        query = query.extend(Q.take(limit));
      }
    }

    return await query.fetch();
  }

  /**
   * Update user metric
   */
  static async updateMetric(
    id: string,
    updates: {
      value?: number;
      date?: number;
      type?: UserMetricType | string;
    }
  ): Promise<UserMetric> {
    return await database.write(async () => {
      const metric = await database.get<UserMetric>('user_metrics').find(id);

      if (metric.deletedAt) {
        throw new Error('Cannot update deleted metric');
      }

      await metric.update((record) => {
        if (updates.value !== undefined) record.value = updates.value;
        if (updates.date !== undefined) record.date = updates.date;
        if (updates.type !== undefined) record.type = updates.type as UserMetricType;
        record.updatedAt = Date.now();
      });

      return metric;
    });
  }

  /**
   * Delete user metric (soft delete)
   */
  static async deleteMetric(id: string): Promise<void> {
    const metric = await database.get<UserMetric>('user_metrics').find(id);
    // markAsDeleted is a @writer method, so it already manages its own write transaction
    await metric.markAsDeleted();
  }
}
