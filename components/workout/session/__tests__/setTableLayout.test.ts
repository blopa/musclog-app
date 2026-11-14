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

  it('keeps the check at the end of the entry line when compact; only "previous" moves down', () => {
    expect(entryLineColumns(true)).toEqual(['set', 'spacer', 'weight', 'reps', 'check']);
    expect(entryLineColumns(true)).not.toContain('previous');
  });

  it('ends on the check column in both layouts, so the header lines up with the inputs', () => {
    expect(entryLineColumns(true).at(-1)).toBe('check');
    expect(entryLineColumns(false).at(-1)).toBe('check');
    expect(SET_TABLE_COLUMNS.check).toBeGreaterThan(0);
  });
});
