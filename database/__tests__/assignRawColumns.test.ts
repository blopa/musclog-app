import { assignRawColumns, type RawColumnTarget } from '@/database/assignRawColumns';

describe('assignRawColumns', () => {
  it('restores a schema column when its camelCase name is a read-only computed property', () => {
    const record = {
      _raw: { completion_status: null, is_skipped: null },
      set completionStatus(value: unknown) {
        this._raw.completion_status = value;
      },
      get isSkipped() {
        return this._raw.completion_status === 'skipped';
      },
    } as RawColumnTarget;

    expect(() =>
      assignRawColumns(record, {
        completion_status: 'skipped',
        is_skipped: true,
      })
    ).not.toThrow();

    expect(record._raw.is_skipped).toBe(true);
    expect(record.isSkipped).toBe(true);
  });
});
