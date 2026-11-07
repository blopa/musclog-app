import { yearReviewSeason } from '@/utils/yearInReview/season';

describe('yearReviewSeason', () => {
  it('is inactive on 30 November and points at the year that just ended', () => {
    expect(yearReviewSeason(new Date(2026, 10, 30, 12))).toEqual({ active: false, year: 2025 });
  });

  it('opens on 1 December and reviews the current year', () => {
    expect(yearReviewSeason(new Date(2026, 11, 1, 0, 0))).toEqual({ active: true, year: 2026 });
  });

  it('stays active through 31 January and reviews the year that just ended', () => {
    expect(yearReviewSeason(new Date(2027, 0, 31, 23, 59))).toEqual({ active: true, year: 2026 });
  });

  it('closes on 1 February and keeps the previous year for the Settings replay', () => {
    expect(yearReviewSeason(new Date(2027, 1, 1, 0, 0))).toEqual({ active: false, year: 2026 });
  });

  it('is inactive in mid-year and reviews the last completed year', () => {
    expect(yearReviewSeason(new Date(2026, 6, 15, 9))).toEqual({ active: false, year: 2025 });
  });
});
