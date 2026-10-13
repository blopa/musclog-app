import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import { computeExerciseSearchText } from '@/database/exerciseSearchText';
import type Exercise from '@/database/models/Exercise';
import type ExerciseAlias from '@/database/models/ExerciseAlias';
import { prepareSoftDelete } from '@/database/prepareSoftDelete';
import { normalizeExerciseText } from '@/utils/exerciseSearch';

export const MAX_EXERCISE_ALIASES = 10;
export const MAX_EXERCISE_ALIAS_LENGTH = 40;

export type AddAliasResult =
  | { ok: true; alias: ExerciseAlias }
  | { ok: false; reason: 'duplicate' | 'empty' | 'limit' | 'notFound' };

async function fetchLiveAliases(exerciseId: string): Promise<ExerciseAlias[]> {
  return await database
    .get<ExerciseAlias>('exercise_aliases')
    .query(
      Q.where('exercise_id', exerciseId),
      Q.where('deleted_at', Q.eq(null)),
      Q.sortBy('created_at', Q.asc)
    )
    .fetch();
}

/**
 * User-defined alternative names for an exercise.
 *
 * An alias is only searchable through `exercises.search_text`, so every change here rewrites that
 * column in the SAME batch as the alias row — a crash between the two would leave an alias that
 * the UI lists but the search never finds. Read-then-write happens inside one writer.
 */
export class ExerciseAliasService {
  static async getAliases(exerciseId: string): Promise<ExerciseAlias[]> {
    return await fetchLiveAliases(exerciseId);
  }

  static async addAlias(exerciseId: string, rawAlias: string): Promise<AddAliasResult> {
    const alias = rawAlias.trim().slice(0, MAX_EXERCISE_ALIAS_LENGTH);
    const normalized = normalizeExerciseText(alias);
    if (!normalized) {
      return { ok: false, reason: 'empty' };
    }

    return await database.write(async (): Promise<AddAliasResult> => {
      let exercise: Exercise;
      try {
        exercise = await database.get<Exercise>('exercises').find(exerciseId);
      } catch {
        return { ok: false, reason: 'notFound' };
      }

      if (exercise.deletedAt) {
        return { ok: false, reason: 'notFound' };
      }

      const existing = await fetchLiveAliases(exerciseId);
      if (existing.length >= MAX_EXERCISE_ALIASES) {
        return { ok: false, reason: 'limit' };
      }

      // "BP" and "bp" are the same alias, and so are "Push-up" and "push up".
      if (existing.some((row) => normalizeExerciseText(row.alias) === normalized)) {
        return { ok: false, reason: 'duplicate' };
      }

      const now = Date.now();
      const created = database.get<ExerciseAlias>('exercise_aliases').prepareCreate((record) => {
        record.exerciseId = exerciseId;
        record.alias = alias;
        record.createdAt = now;
        record.updatedAt = now;
        record.deletedAt = undefined;
      });
      // `updated_at` moves on purpose: list subscriptions use it as their change signal.
      const reindexed = exercise.prepareUpdate((record) => {
        record.searchText = computeExerciseSearchText(record, [
          ...existing.map((row) => row.alias),
          alias,
        ]);
        record.updatedAt = now;
      });

      await database.batch(created, reindexed);
      return { ok: true, alias: created };
    });
  }

  static async removeAlias(aliasId: string): Promise<void> {
    await database.write(async () => {
      let alias: ExerciseAlias;
      try {
        alias = await database.get<ExerciseAlias>('exercise_aliases').find(aliasId);
      } catch {
        return;
      }

      if (alias.deletedAt) {
        return;
      }

      const exercise = await database.get<Exercise>('exercises').find(alias.exerciseId);
      const remaining = (await fetchLiveAliases(alias.exerciseId)).filter(
        (row) => row.id !== aliasId
      );

      const now = Date.now();
      await database.batch(
        prepareSoftDelete(alias, now),
        exercise.prepareUpdate((record) => {
          record.searchText = computeExerciseSearchText(
            record,
            remaining.map((row) => row.alias)
          );
          record.updatedAt = now;
        })
      );
    });
  }
}
