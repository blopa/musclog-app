import { mealTypeForHour } from '../mealTypeForHour';

describe('mealTypeForHour', () => {
  it('maps the clock to the diary meals', () => {
    expect(mealTypeForHour(8)).toBe('breakfast');
    expect(mealTypeForHour(12)).toBe('lunch');
    expect(mealTypeForHour(19)).toBe('dinner');
    expect(mealTypeForHour(23)).toBe('snack');
    expect(mealTypeForHour(3)).toBe('snack');
  });
});
