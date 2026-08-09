type RawRecord = Record<string, unknown> & { _raw: Record<string, unknown> };

/** Assigns snake_case export/share columns through WatermelonDB model setters. */
export function assignRawColumns(record: RawRecord, raw: Record<string, unknown>): void {
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
    record[camel] = assignValue;
  }
}
