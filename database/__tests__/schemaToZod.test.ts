import {
  ExportDumpSchema,
  generateExportValidationSchema,
  validateExportDump,
} from '@/database/schemaToZod';

const minimalDump = () => ({ _exportVersion: 1 });

const { schema: watermelonSchema } = jest.requireActual('@/database/schema');

type SchemaColumn = { name: string; type: string; isOptional?: boolean };

const columnsOf = (tableName: string): SchemaColumn[] =>
  (watermelonSchema.tables[tableName]?.columnArray ?? []) as SchemaColumn[];

/** A row carrying a valid value for every required column, so a test can vary one field. */
const makeRow = (tableName: string, overrides: Record<string, unknown> = {}) => {
  const row: Record<string, unknown> = { id: `${tableName}-row` };

  for (const column of columnsOf(tableName)) {
    if (column.name === 'id' || column.isOptional) {
      continue;
    }

    row[column.name] = column.type === 'number' ? 0 : column.type === 'boolean' ? false : 'value';
  }

  return { ...row, ...overrides };
};

/** First required boolean column in the schema — used to pin the SQLite 0/1 coercion. */
const requiredBooleanColumn = Object.keys(watermelonSchema.tables)
  .flatMap((tableName) =>
    columnsOf(tableName)
      .filter((column) => column.type === 'boolean' && !column.isOptional)
      .map((column) => ({ tableName, columnName: column.name }))
  )
  .at(0);

describe('generateExportValidationSchema', () => {
  it('derives a table entry for every table in the WatermelonDB schema', () => {
    // The whole point of generating this is that adding a table to `schema.ts` cannot
    // leave the export validator behind.
    const shape = generateExportValidationSchema().shape;

    for (const tableName of Object.keys(watermelonSchema.tables)) {
      expect(shape[tableName]).toBeDefined();
    }
  });

  it('makes every table optional, so a partial export still validates', () => {
    expect(validateExportDump(minimalDump()).success).toBe(true);
  });

  it('rebuilds an equivalent schema on each call', () => {
    const fresh = generateExportValidationSchema();

    expect(Object.keys(fresh.shape).sort()).toEqual(Object.keys(ExportDumpSchema.shape).sort());
  });
});

describe('validateExportDump — metadata', () => {
  it('requires an export version', () => {
    const result = validateExportDump({});

    expect(result.success).toBe(false);
    expect(result.success === false && result.details.join(' ')).toContain('_exportVersion');
  });

  it('rejects a non-integer or out-of-range export version', () => {
    expect(validateExportDump({ _exportVersion: 1.5 }).success).toBe(false);
    expect(validateExportDump({ _exportVersion: 0 }).success).toBe(false);
    expect(validateExportDump({ _exportVersion: 101 }).success).toBe(false);
  });

  it('accepts each known export platform and rejects an unknown one', () => {
    for (const platform of ['android', 'ios', 'web']) {
      expect(validateExportDump({ ...minimalDump(), _exportPlatform: platform }).success).toBe(
        true
      );
    }

    expect(validateExportDump({ ...minimalDump(), _exportPlatform: 'symbian' }).success).toBe(
      false
    );
  });

  it('treats the platform as optional — older dumps predate the field', () => {
    expect(validateExportDump(minimalDump()).success).toBe(true);
  });

  it('accepts the AsyncStorage sidecar as a string map with nullable values', () => {
    const result = validateExportDump({
      ...minimalDump(),
      _async_storage_: { someKey: 'value', clearedKey: null },
    });

    expect(result.success).toBe(true);
  });

  it('rejects a non-string AsyncStorage value', () => {
    expect(validateExportDump({ ...minimalDump(), _async_storage_: { someKey: 42 } }).success).toBe(
      false
    );
  });
});

describe('validateExportDump — rows', () => {
  it('requires a non-empty id on every row', () => {
    expect(validateExportDump({ ...minimalDump(), notes: [makeRow('notes')] }).success).toBe(true);

    expect(
      validateExportDump({ ...minimalDump(), notes: [makeRow('notes', { id: '' })] }).success
    ).toBe(false);

    const { id: _id, ...withoutId } = makeRow('notes');
    expect(validateExportDump({ ...minimalDump(), notes: [withoutId] }).success).toBe(false);
  });

  it('passes unknown columns through instead of dropping them', () => {
    // `.passthrough()` matters: a dump written by a newer app version must not silently
    // lose columns this build has not heard of.
    const result = validateExportDump({
      ...minimalDump(),
      notes: [makeRow('notes', { a_future_column: 'keep me' })],
    });

    expect(result.success).toBe(true);
    expect(result.success && (result.data as any).notes[0].a_future_column).toBe('keep me');
  });

  it('rejects a row whose column has the wrong primitive type', () => {
    const result = validateExportDump({
      ...minimalDump(),
      notes: [makeRow('notes', { body: 42 })],
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.details.join(' ')).toContain('notes');
  });

  it('accepts an empty table array', () => {
    expect(validateExportDump({ ...minimalDump(), notes: [] }).success).toBe(true);
  });
});

describe('validateExportDump — SQLite booleans', () => {
  const parseBoolean = (stored: unknown) => {
    const { tableName, columnName } = requiredBooleanColumn!;
    const result = validateExportDump({
      ...minimalDump(),
      [tableName]: [makeRow(tableName, { [columnName]: stored })],
    });

    return {
      success: result.success,
      value: result.success ? (result.data as any)[tableName][0][columnName] : undefined,
    };
  };

  it('has at least one required boolean column to exercise', () => {
    expect(requiredBooleanColumn).toBeDefined();
  });

  it('coerces the 0/1 integers native SQLite stores into real booleans', () => {
    // Native writes booleans as 0/1; the web (LokiJS) import path needs true/false.
    expect(parseBoolean(1)).toEqual({ success: true, value: true });
    expect(parseBoolean(0)).toEqual({ success: true, value: false });
  });

  it('leaves an already-boolean value alone', () => {
    expect(parseBoolean(true)).toEqual({ success: true, value: true });
    expect(parseBoolean(false)).toEqual({ success: true, value: false });
  });

  it('still rejects a value that is neither a boolean nor 0/1', () => {
    expect(parseBoolean(7).success).toBe(false);
    expect(parseBoolean('true').success).toBe(false);
  });
});

describe('validateExportDump — encrypted numeric columns', () => {
  // These are stored encrypted (as strings) but may be exported as raw numbers,
  // so both shapes have to validate or a legitimate backup fails to import.
  it.each([
    ['user_metrics', 'value'],
    ['nutrition_logs', 'logged_calories'],
    ['nutrition_logs', 'logged_protein'],
    ['saved_for_later_items', 'logged_calories'],
  ])('accepts %s.%s as either a string or a number', (table, column) => {
    expect(
      validateExportDump({
        ...minimalDump(),
        [table]: [makeRow(table, { [column]: 'encrypted-blob' })],
      }).success
    ).toBe(true);

    expect(
      validateExportDump({ ...minimalDump(), [table]: [makeRow(table, { [column]: 1234.5 })] })
        .success
    ).toBe(true);
  });

  it('still rejects a shape that is neither string nor number', () => {
    expect(
      validateExportDump({
        ...minimalDump(),
        user_metrics: [makeRow('user_metrics', { value: { nope: true } })],
      }).success
    ).toBe(false);
  });
});

describe('validateExportDump — failure reporting', () => {
  it('reports the dotted path of every failing field', () => {
    const result = validateExportDump({
      _exportVersion: 'nope',
      notes: [makeRow('notes', { id: '' })],
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.details.length).toBeGreaterThan(0);
    expect(result.error).toContain(`${result.details.length} error(s)`);
    expect(result.details.some((detail) => detail.startsWith('_exportVersion:'))).toBe(true);
    expect(result.details.some((detail) => detail.startsWith('notes.0.id:'))).toBe(true);
  });

  it('rejects a non-object dump instead of throwing', () => {
    for (const bad of [null, undefined, 'a string', 42, []]) {
      expect(() => validateExportDump(bad)).not.toThrow();
      expect(validateExportDump(bad).success).toBe(false);
    }
  });

  it('returns the parsed data on success', () => {
    const dump = { ...minimalDump(), _exportPlatform: 'android' as const };

    const result = validateExportDump(dump);

    expect(result.success).toBe(true);
    expect(result.success && result.data._exportVersion).toBe(1);
  });
});
