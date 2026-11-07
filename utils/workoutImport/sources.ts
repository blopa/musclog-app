/**
 * Header recognition and column lookup. Columns are found by normalised name,
 * never by position, and every lookup goes through a Map so a header such as
 * `__proto__` is just a key.
 */
import { distanceUnitFactor } from './parseNumber';
import type { WorkoutImportSource } from './types';

export type ColumnMap = Map<string, number>;

export function normalizeHeaderCell(cell: string): string {
  return cell
    .replace(/\uFEFF/g, '')
    .replace(/#/g, ' no ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function buildColumnMap(header: readonly string[]): ColumnMap {
  const map: ColumnMap = new Map();
  header.forEach((cell, index) => {
    const key = normalizeHeaderCell(cell);
    if (key !== '' && !map.has(key)) {
      map.set(key, index);
    }
  });
  return map;
}

/** The cell under a named column, or '' when the row is shorter or the column is absent. */
export function cellAt(row: readonly string[], map: ColumnMap, key: string): string {
  return cellAtIndex(row, map.get(key) ?? null);
}

export function cellAtIndex(row: readonly string[], index: number | null): string {
  if (index === null || index < 0 || index >= row.length) {
    return '';
  }

  return row[index];
}

/** The first of several accepted column names that the header has. */
export function colOf(map: ColumnMap, names: readonly string[]): number | null {
  for (const name of names) {
    const index = map.get(name);
    if (index !== undefined) {
      return index;
    }
  }

  return null;
}

const WEIGHT_VALUE_COLUMNS = ['weight', 'weight kg', 'weight kgs', 'weight lbs', 'weight lb'];

export function detectSource(header: readonly string[]): WorkoutImportSource | null {
  const map = buildColumnMap(header);
  const has = (key: string): boolean => map.has(key);

  if (has('exercise name') && has('set order')) {
    return 'strong';
  }

  if (has('exercise title') && has('start time')) {
    return 'hevy';
  }

  if (has('exercise') && has('kind')) {
    return 'fitnotes2';
  }

  if (
    has('exercise') &&
    has('category') &&
    (has('weight unit') || colOf(map, WEIGHT_VALUE_COLUMNS) !== null)
  ) {
    return 'fitnotes';
  }

  return null;
}

export interface WeightColumns {
  /** A column whose header names kilograms. */
  kg: number | null;
  /** A column whose header names pounds. */
  lbs: number | null;
  /** A bare `Weight` column; its unit comes from `unit`, or the caller's assumption. */
  bare: number | null;
  /** A `Weight Unit` column that applies to the bare column. */
  unit: number | null;
}

export function resolveWeightColumns(map: ColumnMap): WeightColumns {
  return {
    kg: colOf(map, ['weight kg', 'weight kgs', 'weight kilograms']),
    lbs: colOf(map, ['weight lbs', 'weight lb', 'weight pounds']),
    bare: colOf(map, ['weight']),
    unit: colOf(map, ['weight unit', 'weight units']),
  };
}

export interface DistanceColumn {
  index: number;
  /** Metres per unit taken from the header (`Distance (miles)`), null for bare `Distance`. */
  factor: number | null;
}

/** `Distance`, `Distance (km)`, `distance_miles` and friends. */
export function resolveDistanceColumn(map: ColumnMap): DistanceColumn | null {
  const bare = map.get('distance');
  if (bare !== undefined) {
    return { index: bare, factor: null };
  }

  for (const [key, index] of map) {
    if (key.startsWith('distance ')) {
      const factor = distanceUnitFactor(key.slice('distance '.length));
      if (factor !== null) {
        return { index, factor };
      }
    }
  }

  return null;
}
