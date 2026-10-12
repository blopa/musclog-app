import { addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

// Version 27: forgiving exercise search.
//
// `exercises.search_text` is the precomputed, normalized word set every exercise is searched
// through (utils/exerciseSearch.ts), and `exercise_aliases` holds the user's own alternative names
// for an exercise. Both additions are purely additive, so no pre-migration snapshot is taken.
//
// No SQL backfill on purpose: the column is derived data, and filling it needs the same
// normalization/stemming code the queries use (plus every bundled language's exercise names),
// which SQL cannot run. LokiJS also ignores unsafe SQL, so a JS backfill is the only path that
// works on web. `AppExerciseCatalogueService.sync` fills catalogue rows on the next boot and
// `ExerciseService.backfillSearchText` fills user-created ones; until then the search falls back
// to matching `name`.
const migrationV27 = {
  toVersion: 27,
  steps: [
    addColumns({
      table: 'exercises',
      columns: [{ name: 'search_text', type: 'string', isOptional: true }],
    }),
    createTable({
      name: 'exercise_aliases',
      columns: [
        { name: 'exercise_id', type: 'string', isIndexed: true },
        { name: 'alias', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
  ],
};

export default migrationV27;
