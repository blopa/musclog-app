import { Q } from '@nozbe/watermelondb';

import { getExerciseText } from '@/data/exerciseCatalogue';
import { getFoundationFoodText } from '@/data/foundationFoodCatalogue';
import { commitPrepared } from '@/database/commitPrepared';
import { database } from '@/database/database-instance';
import { computeExerciseSearchText } from '@/database/exerciseSearchText';
import type Exercise from '@/database/models/Exercise';
import type ExerciseAlias from '@/database/models/ExerciseAlias';
import type Food from '@/database/models/Food';
import { type BundledText, isUntouched, type StoredBundledText } from '@/utils/bundledText';
import { exerciseSlugFromId } from '@/utils/exerciseImage';

function changed(stored: StoredBundledText, next: BundledText): boolean {
  return stored.name !== next.name || stored.description !== next.description;
}

/**
 * Renames the built-in foods or exercises into another language, only when the person asks
 * (Settings → Profile and units). Nothing calls it on a language change.
 *
 * Both methods return how many rows changed. Only bundled words are replaced: custom rows are not
 * read, and a name or description the person rewrote is kept. An untouched row keeps `updatedAt`
 * equal to `createdAt`, so it still reads as bundled text after a later translation fix. Each runs
 * in one batch: a half-translated catalogue is never saved.
 */
export class CatalogueTranslationService {
  static async translateFoods(locale: string): Promise<number> {
    return database.write(async () => {
      const foods = await database
        .get<Food>('foods')
        .query(Q.where('source', 'foundation'), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      const changes = foods
        .map((food) => ({ food, text: getFoundationFoodText(food, locale) }))
        .filter(({ food, text }) => changed(food, text));

      const now = Date.now();
      await commitPrepared(
        database,
        changes.map(({ food }) => food),
        () =>
          changes.map(({ food, text }) => {
            const untouched = isUntouched(food);

            return food.prepareUpdate((record) => {
              record.name = text.name;
              record.description = text.description;
              // `prepareUpdate` stamps `updated_at` itself, so an untouched row has to be put back.
              record.updatedAt = untouched ? record.createdAt : now;
            });
          })
      );

      return changes.length;
    });
  }

  static async translateExercises(locale: string): Promise<number> {
    return database.write(async () => {
      const [exercises, aliases] = await Promise.all([
        database
          .get<Exercise>('exercises')
          .query(Q.where('source', 'app'), Q.where('deleted_at', Q.eq(null)))
          .fetch(),
        database
          .get<ExerciseAlias>('exercise_aliases')
          .query(Q.where('deleted_at', Q.eq(null)))
          .fetch(),
      ]);

      const changes = exercises.flatMap((exercise) => {
        const slug = exerciseSlugFromId(exercise.id);
        if (!slug) {
          return [];
        }

        const text = getExerciseText(slug, exercise, locale);

        return changed(exercise, text) ? [{ exercise, text }] : [];
      });

      const now = Date.now();
      await commitPrepared(
        database,
        changes.map(({ exercise }) => exercise),
        () =>
          changes.map(({ exercise, text }) => {
            const untouched = isUntouched(exercise);
            const aliasTexts = aliases
              .filter((alias) => alias.exerciseId === exercise.id)
              .map((alias) => alias.alias);

            return exercise.prepareUpdate((record) => {
              record.name = text.name;
              record.description = text.description ?? '';
              record.searchText = computeExerciseSearchText(
                { id: exercise.id, name: text.name },
                aliasTexts
              );
              // `prepareUpdate` stamps `updated_at` itself, so an untouched row has to be put back.
              record.updatedAt = untouched ? record.createdAt : now;
            });
          })
      );

      return changes.length;
    });
  }
}
