import { Q } from '@nozbe/watermelondb';

import { encryptUserMetricFields } from '../encryptionHelpers';
import { database } from '../index';
import UserMetric, { type UserMetricType } from '../models/UserMetric';

export class UserMetricService {
  /**
   * Get latest metric value for a specific type (by date, then by updated_at so
   * the most recently updated record wins when dates tie).
   */
  static async getLatest(type: UserMetricType | string): Promise<UserMetric | null> {
    const metrics = await database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', type),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('date', Q.desc),
        Q.sortBy('updated_at', Q.desc),
        Q.take(1)
      )
      .fetch();
    return metrics[0] ?? null;
  }

  /**
   * Get metrics history with pagination support.
   */
  static async getMetricsHistory(
    type?: UserMetricType | string,
    dateRange?: { startDate: number; endDate: number },
    limit?: number,
    offset?: number
  ): Promise<UserMetric[]> {
    let query = database
      .get<UserMetric>('user_metrics')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('date', Q.desc));

    if (type) {
      query = query.extend(Q.where('type', type));
    }

    if (dateRange) {
      query = query.extend(
        Q.where('date', Q.gte(dateRange.startDate)),
        Q.where('date', Q.lte(dateRange.endDate))
      );
    }

    if (limit !== undefined && limit > 0) {
      if (offset !== undefined && offset > 0) {
        query = query.extend(Q.skip(offset), Q.take(limit));
      } else {
        query = query.extend(Q.take(limit));
      }
    }
    return await query.fetch();
  }

  /**
   * Create user metric (encrypts value and unit; date stored plain).
   */
  static async createMetric(plain: {
    type: UserMetricType | string;
    value: number;
    unit?: string;
    date: number;
    timezone: string;
  }): Promise<UserMetric> {
    const encrypted = await encryptUserMetricFields({
      value: plain.value,
      unit: plain.unit,
      date: plain.date,
    });
    return await database.write(async () => {
      return await database.get<UserMetric>('user_metrics').create((metric) => {
        metric.type = plain.type as UserMetricType;
        metric.valueRaw = encrypted.value;
        metric.unitRaw = encrypted.unit;
        metric.date = plain.date;
        metric.timezone = plain.timezone;
        metric.createdAt = Date.now();
        metric.updatedAt = Date.now();
      });
    });
  }

  /**
   * Update user metric (encrypts value and unit when provided; date stored plain).
   */
  static async updateMetric(
    id: string,
    updates: {
      value?: number;
      unit?: string;
      date?: number;
      type?: UserMetricType | string;
    }
  ): Promise<UserMetric> {
    return await database.write(async () => {
      const metric = await database.get<UserMetric>('user_metrics').find(id);

      if (metric.deletedAt) {
        throw new Error('Cannot update deleted metric');
      }

      const encrypted =
        updates.value !== undefined || updates.unit !== undefined
          ? await encryptUserMetricFields({
              value: updates.value ?? (await metric.getDecrypted()).value,
              unit: updates.unit ?? (await metric.getDecrypted()).unit,
              date: updates.date ?? metric.date,
            })
          : null;

      await metric.update((record) => {
        if (encrypted) {
          record.valueRaw = encrypted.value;
          record.unitRaw = encrypted.unit;
        }
        if (updates.date !== undefined) {
          record.date = updates.date;
        }
        if (updates.type !== undefined) {
          record.type = updates.type as UserMetricType;
        }
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
