/**
 * Column widths shared by the Inline table's header and every row, so they always line up. The
 * inputs are kept just wide enough for "102.5" / "12" so "Last time" — the column lifters read
 * before every set — is not truncated on a 390pt phone.
 */
export const SET_TABLE_COLUMNS = { set: 32, weight: 66, reps: 50, check: 48 } as const;

/** Below this many points (window width over the OS text scale) the table goes compact. */
export const COMPACT_SET_TABLE_WIDTH = 400;

export type SetTableColumn = 'set' | 'previous' | 'spacer' | 'weight' | 'reps' | 'check';

export function isCompactSetTable(width: number, fontScale: number): boolean {
  return width / fontScale < COMPACT_SET_TABLE_WIDTH;
}

/**
 * The columns of the entry line, in order. The header and the rows both render from this one
 * list: a compact layout moves only last time's numbers to the line under the fields, so the
 * entry line has a spacer in place of "previous". The check stays at the end of the entry line:
 * the fixed columns (set, weight, reps, check and their gaps) need about 240pt, which fits even
 * the narrowest phone, and a check dropped to the second line looked like it had no room.
 */
export function entryLineColumns(compact: boolean): SetTableColumn[] {
  return compact
    ? ['set', 'spacer', 'weight', 'reps', 'check']
    : ['set', 'previous', 'weight', 'reps', 'check'];
}
