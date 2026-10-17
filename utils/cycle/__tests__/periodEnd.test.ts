import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

import { endChoiceOf, resolveEnd } from '../periodEnd';

const start = new Date(2024, 5, 1).getTime();

describe('resolveEnd', () => {
  it('stores no end for an ongoing period or one the person does not remember', () => {
    expect(resolveEnd({ kind: 'open', date: null }, start, 5)).toEqual({
      endDate: null,
      endKind: 'open',
    });
    expect(resolveEnd({ kind: 'unknown', date: null }, start, 5)).toEqual({
      endDate: null,
      endKind: 'unknown',
    });
  });

  it('derives an end from the usual length only when that was chosen, and labels it estimated', () => {
    expect(resolveEnd({ kind: 'estimated', date: null }, start, 5)).toEqual({
      endDate: start + 4 * MS_PER_SOLAR_DAY,
      endKind: 'estimated',
    });
  });

  it('keeps a logged date, never before the start', () => {
    const date = start + 3 * MS_PER_SOLAR_DAY;
    expect(resolveEnd({ kind: 'logged', date }, start, 5)).toEqual({
      endDate: date,
      endKind: 'logged',
    });
    expect(resolveEnd({ kind: 'logged', date: start - MS_PER_SOLAR_DAY }, start, 5).endDate).toBe(
      start
    );
  });
});

describe('endChoiceOf', () => {
  it('reads a stored period back as the choice that made it', () => {
    expect(endChoiceOf({ endDate: null, endKind: 'unknown' })).toEqual({
      kind: 'unknown',
      date: null,
    });
    expect(endChoiceOf({ endDate: start, endKind: 'estimated' }).kind).toBe('estimated');
    expect(endChoiceOf({ endDate: null })).toEqual({ kind: 'open', date: null });
  });
});
