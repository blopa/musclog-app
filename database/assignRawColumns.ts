/**
 * A WatermelonDB model being populated from snake_case export/share columns.
 *
 * `Model` has no index signature, so the dynamic `record[camel] = value` below cannot be expressed
 * against it — this is the one shape that says "assigning arbitrary setters on this is intended".
 * Exported so callers cast to a named contract at the boundary instead of typing the whole
 * `prepareCreate` callback `any`, which erases `_raw` and every other model member with it.
 */
export type RawColumnTarget = Record<string, unknown> & { _raw: Record<string, unknown> };

function isReadOnlyProperty(record: RawColumnTarget, property: string): boolean {
  let owner: object | null = record;

  while (owner) {
    const descriptor = Object.getOwnPropertyDescriptor(owner, property);
    if (descriptor) {
      return 'value' in descriptor ? descriptor.writable === false : descriptor.set == null;
    }

    owner = Object.getPrototypeOf(owner) as object | null;
  }

  return false;
}

/**
 * Assigns snake_case export/share columns through WatermelonDB model setters.
 *
 * A model may expose a computed getter whose camelCase name collides with a differently named
 * decorated field (for example the `is_skipped` column and `WorkoutLogSet.isSkipped`). When that
 * happens, the validated physical column is written to its existing raw slot instead of assigning
 * to the read-only getter.
 */
export function assignRawColumns(record: RawColumnTarget, raw: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'id' || key === '_decrypted' || value === undefined) {
      continue;
    }

    let assignValue = value;
    if (key.endsWith('_json')) {
      // @json properties may omit the suffix (micros_json → micros), so setter lookup misses them.
      // WatermelonDB's raw value must be a JSON string even when a web export already parsed it.
      if (typeof value === 'string' && value) {
        try {
          JSON.parse(value);
          assignValue = value;
        } catch {
          assignValue = null;
        }
      } else if (value !== null && typeof value === 'object') {
        assignValue = JSON.stringify(value);
      } else {
        assignValue = null;
      }

      record._raw[key] = assignValue;
      continue;
    }

    const camel = key.replace(/_([a-z0-9])/g, (_, character: string) => character.toUpperCase());
    if (Object.hasOwn(record._raw, key) && isReadOnlyProperty(record, camel)) {
      record._raw[key] = assignValue;
      continue;
    }

    record[camel] = assignValue;
  }
}
