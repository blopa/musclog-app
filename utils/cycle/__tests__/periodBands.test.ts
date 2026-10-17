import { periodBandAt } from '../periodBands';

const day = (n: number) => new Date(2024, 5, n).getTime();

describe('periodBandAt', () => {
  const periods = [
    { startDate: day(10), endDate: day(14), endKind: 'logged' as const },
    { startDate: day(28), endDate: null, endKind: 'unknown' as const },
  ];

  it('labels a logged period, the days before the next one, and everything else', () => {
    expect(periodBandAt(periods, day(12))).toBe('period');
    expect(periodBandAt(periods, day(24))).toBe('before');
    expect(periodBandAt(periods, day(20))).toBe('other');
  });

  it('lets an unknown end occupy only its start day', () => {
    expect(periodBandAt(periods, day(28))).toBe('period');
    expect(periodBandAt(periods, day(30))).toBe('other');
  });
});
