import {
  COMPACT_SET_TABLE_WIDTH,
  entryLineColumns,
  isCompactSetTable,
  SET_TABLE_COLUMNS,
} from '../setTableLayout';

describe('isCompactSetTable', () => {
  it('goes compact below the threshold, measured in text-scaled points', () => {
    expect(isCompactSetTable(COMPACT_SET_TABLE_WIDTH, 1)).toBe(false);
    expect(isCompactSetTable(COMPACT_SET_TABLE_WIDTH - 1, 1)).toBe(true);
    // 411pt at 1.3x text is a 316pt layout.
    expect(isCompactSetTable(411, 1.3)).toBe(true);
  });
});

describe('entryLineColumns', () => {
  it('keeps weight and reps as the last two columns before the check when it is inline', () => {
    expect(entryLineColumns(false)).toEqual(['set', 'previous', 'weight', 'reps', 'check']);
  });

  it('has no check column when compact, where it moves under the fields', () => {
    // A header that still reserved the check column sat 56pt left of its inputs.
    expect(entryLineColumns(true)).toEqual(['set', 'spacer', 'weight', 'reps']);
    expect(entryLineColumns(true)).not.toContain('check');
  });

  it('ends on the reps column when compact, so the inputs reach the row edge', () => {
    expect(entryLineColumns(true).at(-1)).toBe('reps');
    expect(SET_TABLE_COLUMNS.check).toBeGreaterThan(0);
  });
});
