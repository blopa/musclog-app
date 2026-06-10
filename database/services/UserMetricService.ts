import { Q } from '@nozbe/watermelondb';
import convert from 'convert';
import { Platform } from 'react-native';

import { database } from '@/database/database-instance';
import { dayRangeClauses } from '@/database/dayKeyQuery';
import { encryptUserMetricFields } from '@/database/encryptionHelpers';
import UserMetric, { type UserMetricType } from '@/database/models/UserMetric';
import { writeUserMetricToHealthConnect } from '@/services/healthConnectFitness';
import {
  dayKeyRange,
  MS_PER_SOLAR_DAY,
  TIMEZONE_QUERY_BUFFER_MS,
  utcNormalizedDayKey,
} from '@/utils/calendarDate';
import { handleError } from '@/utils/handleError';
import { ianaZoneToTimezoneAt, isTimezoneOffset } from '@/utils/timezone';

import { REPAIR_DESCRIPTORS, retryAfterRepair } from './DatabaseRepairService';

// A record's UTC-normalized day key K relates to its stored instant `date` by
// K ∈ (date − MAX_KEY_BELOW_DATE_MS, date + TIMEZONE_QUERY_BUFFER_MS] for offsets in
// UTC−14…UTC+14: the key sits at most 14 h above the instant, and less than 24 h + 14 h
// below it.
const MAX_KEY_BELOW_DATE_MS = MS_PER_SOLAR_DAY + TIMEZONE_QUERY_BUFFER_MS;

export class UserMetricService {
  /**
   * Latest user body weight in kg for volume (bodyweight exercises). Returns 0 if unknown.
   */
  static async getUserBodyWeightKgForVolume(): Promise<number> {
    const weightMetric = await UserMetricService.getLatest('weight');
    if (!weightMetric) {
      return 0;
    }

    const decrypted = await weightMetric.getDecrypted();
    let kg = decrypted.value;
    if (decrypted.unit === 'lbs') {
      kg = convert(decrypted.value, 'lb').to('kg') as number;
    }

    return kg;
  }

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
    return this.getLatestInternal(type);
  }

  private static async getLatestInternal(
    type: UserMetricType | string,
    repairAttempted = false
  ): Promise<UserMetric | null> {
    try {
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
    } catch (error) {
      if (!repairAttempted) {
        const repaired = await retryAfterRepair(error, REPAIR_DESCRIPTORS.userMetrics, () =>
          this.getLatestInternal(type, true)
        );

        if (repaired !== undefined) {
          return repaired;
        }
      }
      throw error;
    }
  }

  /**
   * Get the latest metric value for a specific type on or before a given day.
   * Uses metric date first, then updated_at to break ties on the same day.
   */
  static async getLatestOnOrBefore(
    type: UserMetricType | string,
    maxDate: number
  ): Promise<UserMetric | null> {
    const maxKey = utcNormalizedDayKey(maxDate, null);

    // From the K-vs-date relation (see MAX_KEY_BELOW_DATE_MS): rows with
    // date ≤ maxKey − 14 h always qualify (K ≤ maxKey), and rows with
    // date > maxKey + 38 h never do. The anchor is the newest row guaranteed to
    // qualify; only rows close enough to beat (or tie) it can be the true answer.
    const [anchor] = await database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', type),
        Q.where('deleted_at', Q.eq(null)),
        Q.where('date', Q.lte(maxKey - TIMEZONE_QUERY_BUFFER_MS)),
        Q.sortBy('date', Q.desc),
        Q.sortBy('updated_at', Q.desc),
        Q.take(1)
      )
      .fetch();

    // Candidates that can match or beat the anchor's normalized key. The fetch is
    // bounded without any row-count heuristic: between the anchor and maxKey − 14 h
    // there are no rows (the anchor is the newest one below that line), so this
    // reads at most ~2 days' worth of records around each end.
    const candidateClauses = [
      Q.where('type', type),
      Q.where('deleted_at', Q.eq(null)),
      Q.where('date', Q.lte(maxKey + MAX_KEY_BELOW_DATE_MS)),
    ];
    if (anchor) {
      candidateClauses.push(
        Q.where('date', Q.gt(anchor.date - MAX_KEY_BELOW_DATE_MS - TIMEZONE_QUERY_BUFFER_MS))
      );
    }

    const candidates = await database
      .get<UserMetric>('user_metrics')
      .query(...candidateClauses)
      .fetch();

    // Across mixed timezones a smaller raw `date` can normalize to a LATER calendar day, so the
    // DB's date order is not the normalized-key order. Pick the true latest by normalized
    // day key, breaking ties on updated_at (most recently written wins). The anchor itself is
    // inside the candidate window, so it competes here too.
    let best: UserMetric | null = null;
    let bestKey = -Infinity;
    for (const metric of candidates) {
      const key = utcNormalizedDayKey(metric.date, metric.timezone);
      if (key > maxKey) {
        continue;
      }

      if (
        key > bestKey ||
        (key === bestKey && best !== null && metric.updatedAt > best.updatedAt)
      ) {
        best = metric;
        bestKey = key;
      }
    }

    return best;
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
    return this.getMetricsHistoryInternal(type, dateRange, limit, offset);
  }

  private static async getMetricsHistoryInternal(
    type?: UserMetricType | string,
    dateRange?: { startDate: number; endDate: number },
    limit?: number,
    offset?: number,
    repairAttempted = false
  ): Promise<UserMetric[]> {
    try {
      let query = database
        .get<UserMetric>('user_metrics')
        .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('date', Q.desc));

      if (type) {
        query = query.extend(Q.where('type', type));
      }

      // Day-range queries are normalized to UTC day keys, then widened by ±14 h so records
      // stored in any timezone are captured and post-filtered back to the exact day bounds.
      const range = dateRange
        ? dayKeyRange(
            utcNormalizedDayKey(dateRange.startDate, null),
            utcNormalizedDayKey(dateRange.endDate, null)
          )
        : null;

      if (range) {
        query = query.extend(...dayRangeClauses(range));
      } else if (limit !== undefined && limit > 0) {
        // Pagination can only be pushed to the DB when there is no day-range post-filter.
        query =
          offset && offset > 0
            ? query.extend(Q.skip(offset), Q.take(limit))
            : query.extend(Q.take(limit));
      }

      const raw = await query.fetch();

      if (range) {
        const filtered = range.filterRecords(raw);

        if (limit !== undefined && limit > 0) {
          const start = offset && offset > 0 ? offset : 0;
          return filtered.slice(start, start + limit);
        }

        return filtered;
      }

      return raw;
    } catch (error) {
      if (!repairAttempted) {
        const repaired = await retryAfterRepair(error, REPAIR_DESCRIPTORS.userMetrics, () =>
          this.getMetricsHistoryInternal(type, dateRange, limit, offset, true)
        );

        if (repaired) {
          return repaired;
        }
      }
      throw error;
    }
  }

  /**
   * Create user metric (encrypts value and unit; note stored separately; date stored plain).
   */
  static async createMetric(plain: {
    type: UserMetricType | string;
    value: number;
    unit?: string;
    note?: string;
    date: number;
    timezone: string;
    externalId?: string;
    supplementId?: string;
  }): Promise<UserMetric> {
    return this.createMetricInternal(plain);
  }

  private static async createMetricInternal(
    plain: {
      type: UserMetricType | string;
      value: number;
      unit?: string;
      note?: string;
      date: number;
      timezone: string;
      externalId?: string;
      supplementId?: string;
    },
    repairAttempted = false
  ): Promise<UserMetric> {
    try {
      const encrypted = await encryptUserMetricFields({
        value: plain.value,
        unit: plain.unit,
        date: plain.date,
      });

      const metric = await database.write(async () => {
        const newMetric = await database.get<UserMetric>('user_metrics').create((record) => {
          record.type = plain.type as UserMetricType;
          record.externalId = plain.externalId;
          record.supplementId = plain.supplementId;
          record.valueRaw = encrypted.value;
          record.unitRaw = encrypted.unit;
          record.date = plain.date;
          record.timezone = plain.timezone;
          record.createdAt = Date.now();
          record.updatedAt = Date.now();
        });

        // Add note if provided - within the same transaction
        if (plain.note && plain.note.trim()) {
          await newMetric.setNote(plain.note.trim());
        }

        return newMetric;
      });

      // Health Connect / Apple Health (user-entered only — health-sourced records
      // already have externalId set and must not be written back to avoid an echo loop).
      if ((Platform.OS === 'android' || Platform.OS === 'ios') && !plain.externalId) {
        const hcId = await writeUserMetricToHealthConnect({
          metricId: metric.id,
          type: plain.type,
          value: plain.value,
          date: plain.date,
        }).catch((err) => {
          handleError(err, 'UserMetricService.saveUserMetric.healthConnect');
        });

        if (hcId) {
          await database.write(async () => {
            await metric.update((record) => {
              record.externalId = hcId;
            });
          });
        }
      }

      return metric;
    } catch (error) {
      if (!repairAttempted) {
        const repaired = await retryAfterRepair(error, REPAIR_DESCRIPTORS.userMetrics, () =>
          this.createMetricInternal(plain, true)
        );

        if (repaired) {
          return repaired;
        }
      }
      throw error;
    }
  }

  /**
   * Update user metric (encrypts value and unit when provided; note stored separately; date stored plain).
   */
  static async updateMetric(
    id: string,
    updates: {
      value?: number;
      unit?: string;
      note?: string;
      date?: number;
      timezone?: string;
      type?: UserMetricType | string;
    }
  ): Promise<UserMetric> {
    const metric = await database.get<UserMetric>('user_metrics').find(id);

    if (metric.deletedAt) {
      throw new Error('Cannot update deleted metric');
    }

    const decrypted = await metric.getDecrypted();
    const valueToWrite = updates.value ?? decrypted.value;
    const encrypted =
      updates.value !== undefined || updates.unit !== undefined
        ? await encryptUserMetricFields({
            value: valueToWrite,
            unit: updates.unit ?? decrypted.unit,
            date: updates.date ?? metric.date,
          })
        : null;

    await database.write(async () => {
      await metric.update((record) => {
        if (encrypted) {
          record.valueRaw = encrypted.value;
          record.unitRaw = encrypted.unit;
        }

        if (updates.date !== undefined) {
          record.date = updates.date;
        }

        if (updates.timezone !== undefined) {
          record.timezone = updates.timezone;
        }

        if (updates.type !== undefined) {
          record.type = updates.type as UserMetricType;
        }

        record.updatedAt = Date.now();
      });

      // Update note if provided - within the same transaction
      if (updates.note !== undefined) {
        await metric.setNote(updates.note);
      }
    });

    return metric;
  }

  /**
   * Delete user metric (soft delete)
   */
  static async deleteMetric(id: string): Promise<void> {
    const metric = await database.get<UserMetric>('user_metrics').find(id);
    // markAsDeleted is a @writer method, so it already manages its own write transaction
    await metric.markAsDeleted();
  }

  /**
   * One-time backfill: convert legacy `user_metrics.timezone` values stored as IANA zone
   * names (e.g. "America/New_York") to the app's "±HH:MM" offset format. The conversion is
   * DST-aware — each row is resolved at its own `date` — so it can't be done in SQL and runs
   * here as an idempotent boot-time backfill (rows already in offset form are skipped).
   * Pairs with the v20 migration; see database/migrations/2026/06/migration-v20.ts.
   */
  static async backfillTimezoneOffsets(): Promise<void> {
    // Legacy values are always either an IANA zone name (canonical IANA always contains a
    // "/", e.g. "America/New_York") or the "UTC"/"GMT" fallbacks. Filtering to those means
    // the query returns nothing once every row is in offset form, so re-runs stay cheap.
    const metrics = await database
      .get<UserMetric>('user_metrics')
      .query(
        Q.or(
          Q.where('timezone', Q.like('%/%')),
          Q.where('timezone', 'UTC'),
          Q.where('timezone', 'GMT')
        )
      )
      .fetch();

    const updates = metrics
      .map((metric) => {
        const current = metric.timezone;
        if (!current || isTimezoneOffset(current)) {
          return null;
        }
        const offset = ianaZoneToTimezoneAt(current, new Date(metric.date));
        return offset && offset !== current ? { metric, offset } : null;
      })
      .filter((update): update is { metric: UserMetric; offset: string } => update !== null);

    if (updates.length === 0) {
      return;
    }

    const now = Date.now();
    await database.write(async () => {
      await database.batch(
        ...updates.map(({ metric, offset }) =>
          metric.prepareUpdate((record) => {
            record.timezone = offset;
            record.updatedAt = now;
          })
        )
      );
    });
  }
}
