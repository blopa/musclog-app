# Exercise catalogue cutover

Musclog replaced its production 256-exercise catalogue with the 873 exercises and 1,746 photos from [free-exercise-db](https://github.com/yuhonas/free-exercise-db), a public-domain project released under CC0. The current structural catalogue is `data/exercisesData.json`; `data/exercisesEnUS.json`, `data/exercisesEsEs.json`, `data/exercisesNlNl.json`, `data/exercisesPtBr.json`, and `data/exercisesRuRu.json` contain localized names and descriptions joined through stable `exerciseSlug` values.

`npm run generate-exercises-data -- [path-to-free-exercise-db]` regenerates the structural and English files from the upstream checkout. Its entry point delegates structural mapping and multiplier policy to focused modules under `scripts/`. Run `npm run generate-exercise-locales` immediately afterwards to regenerate every translated copy before committing a catalogue update; `npm run generate-lang` then discovers those files and rebuilds `EXERCISES_JSON` in `lang/lang.ts`.

## Stable identity and images

Catalogue rows use `fx-<free-exercise-db slug>` primary keys. `exerciseIndex` is display order only; localized copy and bundled workout programs both use `exerciseSlug`, so adding or reordering upstream exercises cannot silently redirect text or a program to a different movement.

Each catalogue slug has start/end WebP frames at `public/images/exercises/<slug>/0.webp` and `1.webp`. `utils/exerciseImage.ts` owns both the relative asset path and hosted URL conventions. Website renderers apply `EXPO_BASE_URL` to the relative path, so local development and subpath exports load their own assets instead of hard-coding the production origin. The on-device cache includes the slug in its flattened filename because the basename alone is `0.webp` for every exercise.

The old catalogue is frozen in `data/legacyExercisesData.json`. Historical schema migration v18 and the Game Boy generator must continue reading that file: old database ids and Game Boy save indexes depend on its original ordering.

## Production upgrade

The boot coordinator first runs `AppExerciseCatalogueService.sync`, then `LegacyExerciseCatalogueMigration.run`. The reconciler repairs missing rows, every generated structural field, and the exact active target-muscle link set in bounded batches. Before retiring anything, the cutover independently verifies all of those rows and links, then creates a full portable database backup through `createPreExerciseCatalogueBackup`. The backup appears in Settings → Local Backups and is retained under the same three-file policy as schema-migration and pre-restore backups. Backup failure aborts retirement, so every legacy row remains available for a retry on the next boot. An interrupted or partial reconciliation likewise leaves the old catalogue intact. Both steps are data-idempotent rather than guarded by AsyncStorage, so restoring an old backup safely arms them again.

Within one serialized writer it:

1. Finds `source='app'` exercises outside the `fx-` namespace, including soft-deleted rows.
2. Finds references from templates, workout logs, goals, and muscle links in bounded query chunks.
3. Creates deterministic `lx-<old id>` user-owned clones for legacy exercises referenced by templates, logs, or goals. Their old illustrations move to `public/images/exercises/legacy/exercise<N>.webp`.
4. Repoints every reference and surviving muscle link to the clone.
5. Permanently destroys all retired app rows and unneeded muscle links after the repoints have been prepared.

Operations are applied in bounded batches ordered as creates, updates, then destroys. That avoids oversized native WatermelonDB batches while remaining resumable on web: a retry finds an existing deterministic clone, finishes any remaining repoints, and only then removes the old row.

Muscle links alone do not justify a clone because they are derived catalogue data. A referenced exercise keeps its links; an unreferenced legacy exercise and its links are removed.

## Curated program substitutions

Most of the 66 legacy movements used by bundled programs have direct free-exercise-db matches. Six BodyCraft-specific movements use the closest available substitute:

| Legacy movement              | Current slug                       |
| ---------------------------- | ---------------------------------- |
| Cable Belt Squat             | `Hack_Squat`                       |
| Cable Reverse Lunge          | `Dumbbell_Rear_Lunge`              |
| Cable Standing Leg Curl      | `Standing_Leg_Curl`                |
| Cable Standing Leg Extension | `Single-Leg_Leg_Extension`         |
| Cable Pull Up                | `Pullups`                          |
| Cable Bench One Arm Row      | `Seated_One-arm_Cable_Pulley_Rows` |

`data/__tests__/workoutTemplatesData.test.ts` verifies that every slug in all bundled programs resolves against the current catalogue.
