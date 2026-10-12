import { exerciseSearchCondition } from '@/database/exerciseSearchCondition';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: (field: string, condition: unknown) => ({ kind: 'where', field, condition }),
    like: (pattern: string) => ({ kind: 'like', pattern }),
    eq: (value: unknown) => ({ kind: 'eq', value }),
    and: (...conditions: unknown[]) => ({ kind: 'and', conditions }),
    or: (...conditions: unknown[]) => ({ kind: 'or', conditions }),
  },
}));

type Node = { kind: string; [key: string]: any };

const likePatterns = (node: unknown): string[] => {
  if (!node || typeof node !== 'object') return [];
  const { kind, pattern, conditions, condition } = node as Node;
  if (kind === 'like') return [pattern];
  if (kind === 'where') return likePatterns(condition);
  return (conditions ?? []).flatMap(likePatterns);
};

const containsWord = (word: string) => ({
  kind: 'where',
  field: 'search_text',
  condition: { kind: 'like', pattern: `%${word}%` },
});

const unindexed = (normalizedQuery: string) => ({
  kind: 'and',
  conditions: [
    { kind: 'where', field: 'search_text', condition: { kind: 'eq', value: null } },
    { kind: 'where', field: 'name', condition: { kind: 'like', pattern: `%${normalizedQuery}%` } },
  ],
});

describe('exerciseSearchCondition', () => {
  it('adds no condition when the text has no searchable words', () => {
    expect(exerciseSearchCondition('')).toBeNull();
    expect(exerciseSearchCondition('   ')).toBeNull();
    expect(exerciseSearchCondition('%_')).toBeNull();
  });

  it('matches every stemmed word against search_text, or falls back to name for unindexed rows', () => {
    expect(exerciseSearchCondition('Dumbbell Flys')).toEqual({
      kind: 'or',
      conditions: [
        { kind: 'and', conditions: [containsWord('dumbbell'), containsWord('fly')] },
        unindexed('dumbbell flys'),
      ],
    });
  });

  it('lets an abbreviation match itself or any of its expansions', () => {
    const [indexed] = (exerciseSearchCondition('rdl') as Node).conditions;
    expect(indexed).toEqual({
      kind: 'and',
      conditions: [
        {
          kind: 'or',
          conditions: [
            // Wrapped in spaces: the stored text is padded, so this only matches the whole word.
            containsWord(' rdl '),
            { kind: 'and', conditions: [containsWord('romanian'), containsWord('deadlift')] },
          ],
        },
      ],
    });
  });

  it('only ever builds LIKE patterns from letters and digits', () => {
    const condition = exerciseSearchCondition('100%_cu\\rl; DROP TABLE-- Жим');
    const patterns = likePatterns(condition);

    expect(patterns.length).toBeGreaterThan(0);
    for (const pattern of patterns) {
      // The only % are the two delimiters; nothing the user typed survives as a wildcard.
      expect(pattern).toMatch(/^%[^%_\\']*%$/);
    }
  });

  it('keeps non-ASCII letters intact instead of turning them into single-character wildcards', () => {
    expect(likePatterns(exerciseSearchCondition('Жим'))).toContain('%жим%');
  });
});
