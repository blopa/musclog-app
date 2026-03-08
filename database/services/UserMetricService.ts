import { Q } from '@nozbe/watermelondb';
import { Platform } from 'react-native';

import { writeUserMetricToHealthConnect } from '../../services/healthConnectFitness';
import { encryptUserMetricFields } from '../encryptionHelpers';
import { database } from '../index';
import UserMetric, { type UserMetricType } from '../models/UserMetric';

export class UserMetricService {
  /**
   * Get a metric by id. Returns null if not found or deleted.
   */
  static async getMetricById(id: string): Promise<UserMetric | null> {
    try {
      const metric = await database.get<UserMetric>('user_metrics').find(id);
      return metric.deletedAt != null ? null : metric;
    } catch {
      return null;
    }
  }

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
   * Create user metric (encrypts value, unit, and note; date stored plain).
   */
  static async createMetric(plain: {
    type: UserMetricType | string;
    value: number;
    unit?: string;
    note?: string;
    date: number;
    timezone: string;
    externalId?: string;
  }): Promise<UserMetric> {
    const encrypted = await encryptUserMetricFields({
      value: plain.value,
      unit: plain.unit,
      note: plain.note,
      date: plain.date,
    });

    const metric = await database.write(async () => {
      return await database.get<UserMetric>('user_metrics').create((record) => {
        record.type = plain.type as UserMetricType;
        record.externalId = plain.externalId;
        record.valueRaw = encrypted.value;
        record.unitRaw = encrypted.unit;
        record.noteRaw = encrypted.note;
        record.date = plain.date;
        record.timezone = plain.timezone;
        record.createdAt = Date.now();
        record.updatedAt = Date.now();
      });
    });

    // Write to Health Connect (Android only, user-entered records only — HC-sourced records
    // already have externalId set and must not be written back to avoid an echo loop).
    if (Platform.OS === 'android' && !plain.externalId) {
      const hcId = await writeUserMetricToHealthConnect({
        metricId: metric.id,
        type: plain.type,
        value: plain.value,
        date: plain.date,
        timezone: plain.timezone,
      }).catch(() => undefined);

      if (hcId) {
        await database.write(async () => {
          await metric.update((record) => {
            record.externalId = hcId;
          });
        });
      }
    }

    return metric;
  }

  /**
   * Update user metric (encrypts value, unit, and note when provided; date stored plain).
   */
  static async updateMetric(
    id: string,
    updates: {
      value?: number;
      unit?: string;
      note?: string;
      date?: number;
      type?: UserMetricType | string;
    }
  ): Promise<UserMetric> {
    return await database.write(async () => {
      const metric = await database.get<UserMetric>('user_metrics').find(id);

      if (metric.deletedAt) {
        throw new Error('Cannot update deleted metric');
      }

      const decrypted = await metric.getDecrypted();
      const valueToWrite = updates.value ?? decrypted.value;
      const encrypted =
        updates.value !== undefined || updates.unit !== undefined || updates.note !== undefined
          ? await encryptUserMetricFields({
              value: valueToWrite,
              unit: updates.unit ?? decrypted.unit,
              note: updates.note ?? decrypted.note,
              date: updates.date ?? metric.date,
            })
          : null;

      await metric.update((record) => {
        if (encrypted) {
          record.valueRaw = encrypted.value;
          record.unitRaw = encrypted.unit;
          record.noteRaw = encrypted.note;
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
