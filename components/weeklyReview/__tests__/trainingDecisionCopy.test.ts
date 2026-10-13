import {
  CONSISTENCY_STATUS_KEYS,
  DECISION_COPY,
  historyLabelKeys,
  isGoodStatus,
  ONE_RM_STATUS_KEYS,
  REASON_KEYS,
} from '../trainingDecisionCopy';

describe('trainingDecisionCopy', () => {
  it('names every key in the shape the locale files use, so none is built up at a call site', () => {
    const keys = [
      ...Object.values(DECISION_COPY).flatMap((copy) => Object.values(copy)),
      ...Object.values(REASON_KEYS),
      ...Object.values(CONSISTENCY_STATUS_KEYS),
      ...Object.values(ONE_RM_STATUS_KEYS),
    ];
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys) {
      expect(key).toMatch(/^weeklyReview\.(trainingDecision|reasons|goals)\./);
    }
  });

  it('tints good news and not bad news', () => {
    for (const good of ['met', 'exceeded', 'reached', 'onPace'] as const) {
      expect(isGoodStatus(good)).toBe(true);
    }
    for (const bad of ['missed', 'behind', 'stalling', 'declining', 'notEnoughData'] as const) {
      expect(isGoodStatus(bad)).toBe(false);
    }
  });

  describe('historyLabelKeys', () => {
    it('lists both halves in order', () => {
      expect(historyLabelKeys({ trainingDecision: 'lighter', nutritionDecision: 'apply' })).toEqual(
        [DECISION_COPY.lighter.title, 'weeklyReview.applied']
      );
    });

    it('lists a lone training decision, or a lone nutrition one', () => {
      expect(historyLabelKeys({ trainingDecision: 'repeat' })).toEqual([
        DECISION_COPY.repeat.title,
      ]);
      expect(historyLabelKeys({ nutritionDecision: 'keep' })).toEqual(['weeklyReview.kept']);
    });

    it('keeps the legacy wording for a row that only acknowledged training', () => {
      expect(historyLabelKeys({})).toEqual(['weeklyReview.trainingOnly']);
      expect(historyLabelKeys({ trainingDecision: null, nutritionDecision: null })).toEqual([
        'weeklyReview.trainingOnly',
      ]);
    });
  });
});
