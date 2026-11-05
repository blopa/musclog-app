import { bestEstimated1RmKg } from '@/utils/strengthLevel';
import { findPersonalRecords } from '@/utils/yearInReview/personalRecords';

const plankId = 'fx-Plank';

/** Imported timed sets (reps 0) must not be read as records by any of the rules that rank sets. */
describe('a zero-rep set in record and strength rules', () => {
  it('gives strength levels and year-review records nothing', () => {
    expect(
      bestEstimated1RmKg([
        { weightKg: 20, reps: 0, repsInReserve: 0, rirRecorded: false, isWorkingSet: true },
      ])
    ).toBeNull();
    expect(
      findPersonalRecords([
        {
          achievedAt: 1,
          sets: [
            {
              exerciseId: plankId,
              equipmentType: 'bodyweight',
              weightKg: 20,
              reps: 0,
              repsInReserve: undefined,
            },
          ],
        },
        {
          achievedAt: 2,
          sets: [
            {
              exerciseId: plankId,
              equipmentType: 'bodyweight',
              weightKg: 30,
              reps: 0,
              repsInReserve: undefined,
            },
          ],
        },
      ])
    ).toEqual([]);
  });
});
