import { type Model, Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';

/**
 * Maximum number of ids to put in a single `Q.oneOf(...)`.
 *
 * Every id becomes a bound parameter, and SQLite caps those per statement
 * (`SQLITE_MAX_VARIABLE_NUMBER`, historically 999). An unbounded `Q.oneOf` over a
 * caller-sized collection therefore throws once the collection grows — which is exactly
 * the case where batching mattered in the first place. Always go through
 * {@link fetchByIds} / {@link fetchMapByIds} rather than passing an array straight to
 * `Q.oneOf`.
 */
export const MAX_QUERY_IDS = 300;

/** Maximum number of prepared records to hand to a single `database.batch(...)` call. */
export const MAX_BATCH_OPERATIONS = 500;

export function chunked<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

/**
 * Fetch every row of `table` whose `column` is one of `ids`, in as few queries as the
 * bound-parameter limit allows. Duplicate ids are collapsed before querying.
 *
 * `extraClauses` are applied to each chunk, so `Q.where('deleted_at', Q.eq(null))` and
 * friends belong here rather than in a post-fetch filter.
 */
export async function fetchByIds<T extends Model>(
  table: string,
  column: string,
  ids: readonly string[],
  ...extraClauses: Q.Clause[]
): Promise<T[]> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) {
    return [];
  }

  const rows: T[] = [];
  for (const chunk of chunked(uniqueIds, MAX_QUERY_IDS)) {
    rows.push(
      ...(await database
        .get<T>(table)
        .query(Q.where(column, Q.oneOf(chunk)), ...extraClauses)
        .fetch())
    );
  }

  return rows;
}

/**
 * {@link fetchByIds} keyed by record id — the shape callers almost always want when they
 * are replacing a `find()` inside a loop.
 */
export async function fetchMapByIds<T extends Model>(
  table: string,
  column: string,
  ids: readonly string[],
  ...extraClauses: Q.Clause[]
): Promise<Map<string, T>> {
  const rows = await fetchByIds<T>(table, column, ids, ...extraClauses);

  return new Map(rows.map((row) => [row.id, row]));
}
