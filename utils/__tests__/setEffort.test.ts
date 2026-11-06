import { repsInReserveFromRpe, RPE_AT_FAILURE, writeSetEffort } from '../setEffort';

describe('writeSetEffort', () => {
  it('rates a set with a number, including an explicit 0 (failure)', () => {
    const set = { repsInReserve: 0, rirRecorded: false };
    writeSetEffort(set, 2);
    expect(set).toEqual({ repsInReserve: 2, rirRecorded: true });
    writeSetEffort(set, 0);
    expect(set).toEqual({ repsInReserve: 0, rirRecorded: true });
  });

  it('stores an unrated set as a 0 placeholder that is flagged unrated, never as failure', () => {
    const set = { repsInReserve: 3, rirRecorded: true };
    writeSetEffort(set, null);
    expect(set).toEqual({ repsInReserve: 0, rirRecorded: false });
    writeSetEffort(set, undefined);
    expect(set).toEqual({ repsInReserve: 0, rirRecorded: false });
    writeSetEffort(set, Number.NaN);
    expect(set).toEqual({ repsInReserve: 0, rirRecorded: false });
  });
});

describe('repsInReserveFromRpe', () => {
  it('reads RPE and reps in reserve as one scale', () => {
    expect(repsInReserveFromRpe(8)).toBe(2);
    expect(repsInReserveFromRpe(RPE_AT_FAILURE)).toBe(0);
  });

  it('keeps the result in 0..9, and an unrated set unrated rather than failure', () => {
    expect(repsInReserveFromRpe(1)).toBe(9);
    expect(repsInReserveFromRpe(11)).toBe(0);
    expect(repsInReserveFromRpe(null)).toBeNull();
  });
});
