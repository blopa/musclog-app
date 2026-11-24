import { ungroundedFigures } from '../numberGrounding';

describe('ungroundedFigures', () => {
  const data = 'Average intake: 2150 kcal, protein 132.4 g, weight 72.5 kg, steps 10432';

  it('finds nothing to check when every figure is in the data', () => {
    expect(ungroundedFigures('You ate 2150 kcal and 132.4 g of protein.', data)).toEqual([]);
  });

  it('accepts roundings of a data figure', () => {
    expect(ungroundedFigures('About 132 g of protein, 72 kg, 10,400 steps.', data)).toEqual([]);
    expect(ungroundedFigures('Around 2,150 kcal.', data)).toEqual([]);
  });

  it('reads the figures of other locales', () => {
    expect(ungroundedFigures('Du hast 2.150 kcal gegessen, 72,5 kg.', data)).toEqual([]);
    expect(ungroundedFigures('Tu as mangé 2 150 kcal.', data)).toEqual([]);
    expect(ungroundedFigures('Вы съели 2 150 ккал.', data)).toEqual([]);
  });

  it('lists a figure the data does not hold, once, as written', () => {
    expect(ungroundedFigures('You ate 2400 kcal, yes 2400, and 95 g of protein.', data)).toEqual([
      '2400',
      '95',
    ]);
  });

  it('never lists small counts, years, dates or times', () => {
    expect(
      ungroundedFigures('3 workouts in 2026, on 2026-11-20 and 21/11/2026 at 18:30.', data)
    ).toEqual([]);
  });

  it('does not join figures separated by a plain space', () => {
    expect(ungroundedFigures('2 100 g portions', 'portion 100 g')).toEqual([]);
  });

  it('allows 1% on large figures', () => {
    expect(ungroundedFigures('10,500 steps', data)).toEqual([]);
    expect(ungroundedFigures('10,600 steps', data)).toEqual(['10,600']);
  });
});
