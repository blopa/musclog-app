import { writeSetEffort } from '../setEffort';

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
