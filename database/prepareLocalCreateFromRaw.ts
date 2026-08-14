import type { Model } from '@nozbe/watermelondb';
import type Collection from '@nozbe/watermelondb/Collection';

/**
 * Prepares a validated/allowlisted raw row as a fresh local WatermelonDB create.
 * The caller owns required values such as timestamps; WatermelonDB owns schema sanitization.
 */
export function prepareLocalCreateFromRaw<TModel extends Model>(
  collection: Collection<TModel>,
  raw: Record<string, unknown>
): TModel {
  return collection.prepareCreateFromDirtyRaw({
    ...raw,
    // A restore/import is a new local create, not a continuation of the sender's sync state.
    _status: 'created',
    _changed: '',
  });
}
