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
 * list: a compact layout puts the check button (and last time's numbers) on the line under the
 * fields, so the entry line has a spacer in place of "previous" and no check column — a header
 * that kept reserving it sat 56pt to the left of its inputs.
 */
export function entryLineColumns(compact: boolean): SetTableColumn[] {
  return compact
    ? ['set', 'spacer', 'weight', 'reps']
    : ['set', 'previous', 'weight', 'reps', 'check'];
}
