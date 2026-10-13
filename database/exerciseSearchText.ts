import { Q } from '@nozbe/watermelondb';

import { getAllLocaleExerciseNamesBySlug } from '@/data/exerciseCatalogue';
import { exerciseSlugFromId } from '@/utils/exerciseImage';
import { buildExerciseSearchText } from '@/utils/exerciseSearch';

/**
 * The one definition of what `exercises.search_text` holds for a given exercise. Everything that
 * writes the column — the catalogue sync, the user-exercise create/update paths, alias changes and
 * the boot backfill — goes through here, so they can never disagree about the same row.
 *
 * A catalogue exercise is searchable by its name in every bundled language; any other exercise by
 * its own name. Aliases apply to both.
 */
export function computeExerciseSearchText(
  exercise: { id: string; name: string },
  aliases: readonly string[]
): string {
  const slug = exerciseSlugFromId(exercise.id);
  const catalogueNames = slug ? getAllLocaleExerciseNamesBySlug().get(slug) : undefined;

  return buildExerciseSearchText({
    names: [exercise.name, ...(catalogueNames ?? [])],
    aliases,
  });
}

/**
 * Selects the exercises the boot backfill still has to fill. It must match a row the v27 migration
 * left empty on BOTH adapters: SQLite adds the column as NULL, and LokiJS (web) rewrites every
 * existing record with the column set to `null` — pinned by `exerciseSearchTextWebMigration.test.ts`.
 */
export const missingSearchTextClause = () => Q.where('search_text', Q.eq(null));
