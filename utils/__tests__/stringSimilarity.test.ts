import { calculateSimilarity, levenshteinDistance } from '@/utils/stringSimilarity';

describe('stringSimilarity', () => {
  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
    });

    it('should return the length of the other string if one is empty', () => {
      expect(levenshteinDistance('hello', '')).toBe(5);
      expect(levenshteinDistance('', 'hello')).toBe(5);
    });

    it('should return the correct distance for substitutions', () => {
      expect(levenshteinDistance('kitten', 'sitten')).toBe(1);
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    });

    it('should return the correct distance for insertions', () => {
      expect(levenshteinDistance('hello', 'hellos')).toBe(1);
    });

    it('should return the correct distance for deletions', () => {
      expect(levenshteinDistance('hello', 'hell')).toBe(1);
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical strings (case-insensitive, trimmed)', () => {
      expect(calculateSimilarity(' Hello ', 'hello')).toBe(1);
    });

    it('should return 0 for completely different strings', () => {
      expect(calculateSimilarity('abc', 'def')).toBe(0);
    });

    it('should return a score between 0 and 1 for partially similar strings', () => {
      const similarity = calculateSimilarity('kitten', 'sitting');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
      // kitten -> sitting: k->s, e->i, add g = 3 changes. length 7. 1 - 3/7 = 4/7 approx 0.57
      expect(similarity).toBeCloseTo(0.57, 2);
    });

    it('should return 1 for both empty strings', () => {
      expect(calculateSimilarity('', '   ')).toBe(1);
    });
  });
});
