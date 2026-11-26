import { alignEstimates, normalizeFoodName } from '../foodName';

describe('normalizeFoodName', () => {
  it('ignores case, accents and extra spaces', () => {
    expect(normalizeFoodName('  Crème  Fraîche ')).toBe('creme fraiche');
    expect(normalizeFoodName('CAFÉ')).toBe(normalizeFoodName('cafe'));
  });
});

describe('alignEstimates', () => {
  const est = (name: string, kcal = 1) => ({ name, kcal });

  it('answers each target with the estimate of its own name, whatever the order', () => {
    const [rice, egg] = alignEstimates(
      [{ name: 'Rice' }, { name: 'Egg' }],
      [est('egg', 2), est('rice', 3)]
    );

    expect(rice?.kcal).toBe(3);
    expect(egg?.kcal).toBe(2);
  });

  it('never gives one estimate to two targets (the late, misspelled one pairs with what is left)', () => {
    // "A" has no estimate under its own name; "B" has. Positional pairing must not hand B's to A.
    const answers = alignEstimates(
      [{ name: 'A' }, { name: 'B' }],
      [est('B', 2), est('A prime', 1)]
    );

    expect(answers.map((answer) => answer?.kcal)).toEqual([1, 2]);
  });

  it('pairs leftovers by position when the counts match and no name does', () => {
    const answers = alignEstimates(
      [{ name: 'rice' }, { name: 'egg' }],
      [est('arroz', 1), est('huevo', 2)]
    );

    expect(answers.map((answer) => answer?.kcal)).toEqual([1, 2]);
  });

  it('leaves a target unanswered when the leftovers do not line up', () => {
    const answers = alignEstimates(
      [{ name: 'rice' }, { name: 'egg' }, { name: 'oil' }],
      [est('rice', 1)]
    );

    expect(answers).toEqual([est('rice', 1), undefined, undefined]);
  });

  it('gives two targets with the same name two estimates, in order', () => {
    const answers = alignEstimates(
      [{ name: 'oil' }, { name: 'Oil' }],
      [est('oil', 1), est('oil', 2)]
    );

    expect(answers.map((answer) => answer?.kcal)).toEqual([1, 2]);
  });

  it('matches names without accents or case', () => {
    const [answer] = alignEstimates([{ name: 'Crème fraîche' }], [est('creme fraiche', 7)]);

    expect(answer?.kcal).toBe(7);
  });
});
