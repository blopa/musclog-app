import type { Model } from '@nozbe/watermelondb';

/** The columns a soft delete stamps. Matches what every model's `markAsDeleted` override writes. */
interface SoftDeletable extends Model {
  deletedAt?: number;
  updatedAt: number;
}

/**
 * A soft delete prepared for `database.batch`, rather than executed.
 *
 * Models own their own `markAsDeleted` (see the `@writer` rule in `AGENTS.md`), and that is what
 * callers should use for a one-off delete. A `@writer` cannot be invoked from inside an already
 * open writer, though, so code that must retire rows in the SAME batch as whatever replaces them
 * has to prepare the update instead — this is that, in one place, so the stamp itself does not get
 * hand-written at each such site.
 *
 * `now` is passed in rather than read here so every row in one batch carries the same instant.
 */
export function prepareSoftDelete<TModel extends SoftDeletable>(record: TModel, now: number) {
  return record.prepareUpdate((draft: TModel) => {
    draft.deletedAt = now;
    draft.updatedAt = now;
  });
}
