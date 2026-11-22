import {
  classifyMemory,
  formatMemoriesForPrompt,
  memoryWords,
  normalizeMemoryText,
} from '@/utils/coachMemories';

describe('coachMemories', () => {
  describe('normalizeMemoryText', () => {
    it('lowercases, strips diacritics, and collapses punctuation and spaces', () => {
      expect(normalizeMemoryText('  Café-Au  LAIT!!  ')).toBe('cafe au lait');
      expect(normalizeMemoryText('Está lesionado, rodilla')).toBe('esta lesionado rodilla');
    });
  });

  describe('memoryWords', () => {
    it('keeps words of three letters or more', () => {
      expect(memoryWords('I am on a low carb diet')).toEqual(new Set(['low', 'carb', 'diet']));
    });
  });

  describe('classifyMemory', () => {
    it('reports a duplicate when normalised texts are equal', () => {
      expect(classifyMemory('Bad LEFT knee!', ['other thing here', 'bad left knee'])).toEqual({
        kind: 'duplicate',
        index: 1,
      });
    });

    it('reports supersedes when word overlap reaches the Jaccard threshold', () => {
      // words: {has, bad, left, knee} vs {has, bad, right, knee}: 3 / 5 = 0.6
      expect(classifyMemory('has bad right knee', ['has bad left knee'])).toEqual({
        kind: 'supersedes',
        index: 0,
      });
    });

    it('treats overlap below the threshold as new', () => {
      // words: {likes, morning, runs, daily} vs {likes, evening, runs, weekly}: 2 / 6
      expect(classifyMemory('likes morning runs daily', ['likes evening runs weekly'])).toEqual({
        kind: 'new',
      });
    });

    it('does not supersede when either side has fewer than three words', () => {
      expect(classifyMemory('knee pain', ['knee pain now'])).toEqual({ kind: 'new' });
    });

    it('matches diacritics as equal text', () => {
      expect(classifyMemory('Prefiere café', ['prefiere cafe'])).toEqual({
        kind: 'duplicate',
        index: 0,
      });
    });

    it('returns the first (newest) superseded entry', () => {
      expect(
        classifyMemory('vegan diet since May', ['vegan diet since April', 'vegan diet since March'])
      ).toEqual({ kind: 'supersedes', index: 0 });
    });
  });

  describe('formatMemoriesForPrompt', () => {
    it('returns an empty string for no memories', () => {
      expect(formatMemoriesForPrompt([])).toBe('');
    });

    it('lists memories newest first with their local calendar date', () => {
      const older = new Date(2026, 0, 5, 9, 0).getTime();
      const newer = new Date(2026, 2, 14, 23, 30).getTime();
      const text = formatMemoriesForPrompt([
        { content: 'older fact', createdAt: older },
        { content: 'newer fact', createdAt: newer },
      ]);

      expect(text).toBe(
        [
          'Things you remember about this user (newest first; if two conflict, the newer one is right):',
          '- (2026-03-14) newer fact',
          '- (2026-01-05) older fact',
        ].join('\n')
      );
    });
  });
});
