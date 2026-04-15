/**
 * Generates Zod schemas from WatermelonDB table schemas.
 * This ensures validation schemas stay in sync with the database schema.
 */

import { z } from 'zod';

import { schema as watermelonSchema } from './schema';

// Mapping from WatermelonDB column types to Zod types
const typeMapping: Record<string, () => z.ZodTypeAny> = {
  string: () => z.string(),
  number: () => z.number(),
  // SQLite has no native boolean type — WatermelonDB stores booleans as 0/1 integers on native.
  // Coerce 0→false and 1→true so exports from mobile validate and import correctly on web.
  boolean: () => z.preprocess((v) => (v === 0 ? false : v === 1 ? true : v), z.boolean()),
};

/**
 * Columns that are stored as encrypted strings but exported as numbers.
 * These need to accept both string and number types during validation.
 */
const ENCRYPTED_NUMBER_FIELDS: Record<string, string[]> = {
  user_metrics: ['value'],
  nutrition_logs: [
    'logged_calories',
    'logged_protein',
    'logged_carbs',
    'logged_fat',
    'logged_fiber',
  ],
};

/**
 * Converts a WatermelonDB column type to a Zod type.
 * Handles special cases for encrypted fields that may be exported as different types.
 */
function columnToZodType(
  tableName: string,
  column: {
    name: string;
    type: string;
    isOptional?: boolean;
  }
): z.ZodTypeAny {
  // Check if this is an encrypted field that might be exported as a number
  const encryptedFields = ENCRYPTED_NUMBER_FIELDS[tableName] || [];
  if (encryptedFields.includes(column.name)) {
    // Accept both string and number, coerce to appropriate type
    let zodType: z.ZodTypeAny = z.union([z.string(), z.number()]);

    if (column.isOptional) {
      zodType = zodType.optional().nullable();
    }

    return zodType;
  }

  const typeFn = typeMapping[column.type];
  if (!typeFn) {
    console.warn(`Unknown column type: ${column.type}, defaulting to string`);
    return z.string();
  }

  let zodType = typeFn();

  // Handle optional fields - make them nullable but DON'T set defaults
  // Setting defaults causes data loss when snake_case keys don't match camelCase schema
  if (column.isOptional) {
    zodType = zodType.optional().nullable();
  }

  return zodType;
}

/**
 * Generates a Zod schema for a single table from its WatermelonDB definition.
 * Uses snake_case column names to match the raw database export format.
 */
function generateTableSchema(
  tableName: string,
  columns: { name: string; type: string; isOptional?: boolean }[]
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  // Add id field (required for all records)
  shape.id = z.string().min(1).max(100);

  for (const column of columns) {
    // Skip internal fields that are handled by WatermelonDB
    if (column.name === 'id') {
      continue;
    }

    // Use column name as-is (snake_case) to match the export format
    // WatermelonDB schema uses snake_case column names which match the raw DB export
    shape[column.name] = columnToZodType(tableName, column);
  }

  // Use passthrough() to allow unknown properties (snake_case keys in export)
  return z.object(shape).passthrough();
}

/**
 * Extracts columns from a table definition.
 * WatermelonDB stores columns as both a map (columns) and array (columnArray).
 * We use columnArray since it's easier to work with.
 */
function getColumnsFromTable(table: any): { name: string; type: string; isOptional?: boolean }[] {
  if (!table) {
    return [];
  }

  // WatermelonDB provides columnArray as the array version of columns
  if (Array.isArray(table.columnArray)) {
    return table.columnArray.map((col: any) => ({
      name: col.name,
      type: col.type,
      isOptional: col.isOptional,
    }));
  }

  // Fallback: try columns directly (might be an object map)
  if (table.columns && typeof table.columns === 'object') {
    return Object.values(table.columns).map((col: any) => ({
      name: col.name,
      type: col.type,
      isOptional: col.isOptional,
    }));
  }

  return [];
}

/**
 * Extracts tables from the WatermelonDB schema.
 * The schema.tables is a TableMap (object), not an array.
 */
function getTablesFromSchema(): {
  name: string;
  columns: { name: string; type: string; isOptional?: boolean }[];
}[] {
  // Access the tables map from the schema
  const tablesMap = (watermelonSchema as any).tables || {};

  return Object.entries(tablesMap).map(([name, table]: [string, any]) => ({
    name,
    columns: getColumnsFromTable(table),
  }));
}

/**
 * Generates Zod schemas for all tables in the database.
 * This is generated at runtime from the WatermelonDB schema.
 */
export function generateExportValidationSchema(): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const tableSchemas: Record<string, z.ZodTypeAny> = {};
  const tables = getTablesFromSchema();

  for (const table of tables) {
    const tableName = table.name;
    tableSchemas[tableName] = z.array(generateTableSchema(tableName, table.columns)).optional();
  }

  // Add metadata fields
  // Use passthrough to allow unknown table data that might not match schema exactly
  return z
    .object({
      _exportVersion: z.number().int().min(1).max(100),
      ...tableSchemas,
      _async_storage_: z.record(z.string(), z.string().nullable().optional()).optional(),
    })
    .passthrough();
}

// Pre-computed schema for use in the app
export const ExportDumpSchema = generateExportValidationSchema();

// Type exports
export type ValidatedExportDump = z.infer<typeof ExportDumpSchema>;

export type ValidationResult =
  | { success: true; data: ValidatedExportDump }
  | { success: false; error: string; details: string[] };

/**
 * Validates export data against the dynamically generated schema.
 * This ensures validation always matches the current database schema.
 */
export function validateExportDump(data: unknown): ValidationResult {
  const result = ExportDumpSchema.safeParse(data);

  if (!result.success) {
    const issues = (result.error as any).issues || (result.error as any).errors || [];
    const errors = issues.map((err: { path: (string | number)[]; message: string }) => {
      const path = err.path.join('.');
      return `${path}: ${err.message}`;
    });

    return {
      success: false,
      error: `Export validation failed with ${errors.length} error(s)`,
      details: errors,
    };
  }

  return { success: true, data: result.data };
}
