import { monthGridDays, weekdayDates } from '../monthGrid';

describe('monthGridDays', () => {
  it('returns whole weeks and flags days outside the month', () => {
    const days = monthGridDays(new Date(2024, 1, 15)); // Feb 2024 starts on a Thursday
    expect(days.length % 7).toBe(0);
    expect(days[0].date.getDay()).toBe(0);
    expect(days.filter((d) => d.inMonth)).toHaveLength(29);
    expect(days[0].inMonth).toBe(false);
  });

  it('can start weeks on Monday', () => {
    expect(monthGridDays(new Date(2024, 1, 15), 1)[0].date.getDay()).toBe(1);
  });
});

describe('weekdayDates', () => {
  it('lists seven consecutive days from the start of the week', () => {
    const days = weekdayDates(new Date(2024, 1, 15));
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(0);
  });
});
