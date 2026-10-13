import { Q, type Query } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import type ExerciseRestriction from '@/database/models/ExerciseRestriction';
import { prepareSoftDelete } from '@/database/prepareSoftDelete';
import { MAX_QUERY_IDS } from '@/database/queryByIds';
import {
  type ActiveRestriction,
  isRestrictionActive,
  type RestrictionKind,
} from '@/utils/exerciseSubstitution';

/**
 * A restriction list that grows past this stops being a list of exercises someone wants to avoid.
 * It also keeps `excludeIds` inside SQLite's bound-parameter limit (see `ExerciseListFilters`).
 */
export const MAX_EXERCISE_RESTRICTIONS = MAX_QUERY_IDS;

export type SetRestrictionResult = { ok: true } | { ok: false; reason: 'limit' };

export function toActiveRestriction(row: ExerciseRestriction): ActiveRestriction {
  return { exerciseId: row.exerciseId, kind: row.kind, expiresAt: row.expiresAt ?? null };
}

/**
 * Exercises the user does not want suggested. There is at most one live row per exercise: `set`
 * replaces, so a row's `kind` is the answer rather than one of several votes.
 *
 * An expired injury stays in the table (the manager shows it as healed) but is no longer
 * "active" — `listActive` and every consumer go through `isRestrictionActive`.
 */
export class ExerciseRestrictionService {
  /** Live rows, newest first. Observe with `observeWithColumns` — it is sorted. */
  static restrictionsQuery(): Query<ExerciseRestriction> {
    return database
      .get<ExerciseRestriction>('exercise_restrictions')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc));
  }

  static async listAll(): Promise<ExerciseRestriction[]> {
    return await ExerciseRestrictionService.restrictionsQuery().fetch();
  }

  /** Restrictions in force right now: live rows whose expiry has not passed. */
  static async listActive(now: number = Date.now()): Promise<ActiveRestriction[]> {
    return (await ExerciseRestrictionService.listAll())
      .map(toActiveRestriction)
      .filter((restriction) => isRestrictionActive(restriction, now));
  }

  static async getFor(exerciseId: string): Promise<ExerciseRestriction | null> {
    const rows = await database
      .get<ExerciseRestriction>('exercise_restrictions')
      .query(Q.where('exercise_id', exerciseId), Q.where('deleted_at', Q.eq(null)))
      .fetch();
    return rows[0] ?? null;
  }

  static async set(
    exerciseId: string,
    kind: RestrictionKind,
    options: { note?: string; expiresAt?: number | null } = {}
  ): Promise<SetRestrictionResult> {
    return await database.write(async (): Promise<SetRestrictionResult> => {
      const collection = database.get<ExerciseRestriction>('exercise_restrictions');
      const live = await collection.query(Q.where('deleted_at', Q.eq(null))).fetch();
      const existing = live.filter((row) => row.exerciseId === exerciseId);
      const now = Date.now();
      const note = options.note?.trim() || undefined;
      // Only an injury heals; a "never" or a dislike has no end date to carry.
      const expiresAt = kind === 'injury' ? (options.expiresAt ?? undefined) : undefined;

      if (existing.length === 0 && live.length >= MAX_EXERCISE_RESTRICTIONS) {
        return { ok: false, reason: 'limit' };
      }

      const [keep, ...duplicates] = existing;
      const operations = [
        ...(keep
          ? [
              keep.prepareUpdate((row) => {
                row.kind = kind;
                row.note = note;
                row.expiresAt = expiresAt;
                row.updatedAt = now;
              }),
            ]
          : [
              collection.prepareCreate((row) => {
                row.exerciseId = exerciseId;
                row.kind = kind;
                row.note = note;
                row.expiresAt = expiresAt;
                row.createdAt = now;
                row.updatedAt = now;
                row.deletedAt = undefined;
              }),
            ]),
        // A restored backup or an older build could have left two live rows; keep one.
        ...duplicates.map((row) => prepareSoftDelete(row, now)),
      ];

      await database.batch(...operations);
      return { ok: true };
    });
  }

  static async clear(exerciseId: string): Promise<void> {
    await database.write(async () => {
      const rows = await database
        .get<ExerciseRestriction>('exercise_restrictions')
        .query(Q.where('exercise_id', exerciseId), Q.where('deleted_at', Q.eq(null)))
        .fetch();
      if (rows.length === 0) {
        return;
      }

      const now = Date.now();
      await database.batch(...rows.map((row) => prepareSoftDelete(row, now)));
    });
  }
}
