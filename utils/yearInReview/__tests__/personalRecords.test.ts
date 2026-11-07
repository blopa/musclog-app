import {
  countYearPersonalRecords,
  findPersonalRecords,
  type PersonalRecordSession,
} from '@/utils/yearInReview/personalRecords';

const at = (year: number, month: number, day: number) => new Date(year, month, day, 12).getTime();

const bench = (weightKg: number, reps = 5) => ({
  exerciseId: 'bench',
  equipmentType: 'barbell',
  weightKg,
  reps,
  repsInReserve: undefined,
});

describe('findPersonalRecords', () => {
  it('never counts the first session an exercise appears in', () => {
    const sessions: PersonalRecordSession[] = [{ achievedAt: at(2026, 0, 5), sets: [bench(100)] }];

    expect(findPersonalRecords(sessions)).toEqual([]);
  });

  it('counts a session whose best set beats every earlier session', () => {
    const sessions: PersonalRecordSession[] = [
      { achievedAt: at(2026, 0, 5), sets: [bench(100)] },
      { achievedAt: at(2026, 2, 5), sets: [bench(105)] },
    ];

    expect(findPersonalRecords(sessions)).toEqual([
      { exerciseId: 'bench', achievedAt: at(2026, 2, 5) },
    ]);
  });

  it('does not count a tie as a record', () => {
    const sessions: PersonalRecordSession[] = [
      { achievedAt: at(2026, 0, 5), sets: [bench(100)] },
      { achievedAt: at(2026, 1, 5), sets: [bench(100)] },
    ];

    expect(findPersonalRecords(sessions)).toEqual([]);
  });

  it('walks sessions in time order, whatever order they are given in', () => {
    const sessions: PersonalRecordSession[] = [
      { achievedAt: at(2026, 2, 5), sets: [bench(105)] },
      { achievedAt: at(2026, 0, 5), sets: [bench(100)] },
    ];

    expect(findPersonalRecords(sessions)).toHaveLength(1);
  });

  it('keeps each exercise’s best separately', () => {
    const sessions: PersonalRecordSession[] = [
      { achievedAt: at(2026, 0, 5), sets: [bench(100)] },
      {
        achievedAt: at(2026, 1, 5),
        sets: [
          {
            exerciseId: 'row',
            equipmentType: 'barbell',
            weightKg: 80,
            reps: 8,
            repsInReserve: undefined,
          },
        ],
      },
    ];

    expect(findPersonalRecords(sessions)).toEqual([]);
  });
});

describe('countYearPersonalRecords', () => {
  it('counts only records achieved in the year, against the whole history', () => {
    const sessions: PersonalRecordSession[] = [
      { achievedAt: at(2025, 10, 5), sets: [bench(100)] },
      // A record in December 2025 sets the baseline for 2026, but is not a 2026 record.
      { achievedAt: at(2025, 11, 31), sets: [bench(110)] },
      { achievedAt: at(2026, 0, 3), sets: [bench(115)] },
    ];

    expect(countYearPersonalRecords(sessions, 2025)).toBe(1);
    expect(countYearPersonalRecords(sessions, 2026)).toBe(1);
  });

  it('returns zero for a year without records', () => {
    expect(countYearPersonalRecords([], 2026)).toBe(0);
  });
});
