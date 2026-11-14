import {
  INITIAL_REVIEW_PROMPT_STATE,
  parseReviewPromptState,
  recordReviewMoment,
  REVIEW_COOLDOWN_MS,
  REVIEW_MAX_REQUESTS,
  type ReviewPromptState,
} from '@/utils/reviewPrompt';

const run = (state: ReviewPromptState, count: number, now: number) => {
  let current = state;
  let requested = false;
  for (let i = 0; i < count; i++) {
    const result = recordReviewMoment(current, now);
    current = result.next;
    requested = result.shouldRequest;
  }

  return { current, requested };
};

describe('parseReviewPromptState', () => {
  it('falls back to the initial state', () => {
    expect(parseReviewPromptState(null)).toEqual(INITIAL_REVIEW_PROMPT_STATE);
    expect(parseReviewPromptState('{nope')).toEqual(INITIAL_REVIEW_PROMPT_STATE);
    expect(parseReviewPromptState('42')).toEqual(INITIAL_REVIEW_PROMPT_STATE);
  });

  it('repairs fields one by one', () => {
    expect(parseReviewPromptState('{"moments":-1,"lastRequestedAt":"x","requestCount":2}')).toEqual(
      { moments: 0, lastRequestedAt: null, requestCount: 2 }
    );
  });

  it('reads a valid state', () => {
    const state = { moments: 2, lastRequestedAt: 10, requestCount: 1 };
    expect(parseReviewPromptState(JSON.stringify(state))).toEqual(state);
  });
});

describe('recordReviewMoment', () => {
  it('requests on the third moment and resets the counter', () => {
    const first = run(INITIAL_REVIEW_PROMPT_STATE, 2, 1000);
    expect(first.requested).toBe(false);
    const third = recordReviewMoment(first.current, 1000);
    expect(third.shouldRequest).toBe(true);
    expect(third.next).toEqual({ moments: 0, lastRequestedAt: 1000, requestCount: 1 });
  });

  it('waits for the cooldown and then for three new moments', () => {
    const { current } = run(INITIAL_REVIEW_PROMPT_STATE, 3, 1000);
    const early = run(current, 5, 1000 + REVIEW_COOLDOWN_MS - 1);
    expect(early.requested).toBe(false);
    expect(early.current.moments).toBe(5);
    const after = run({ ...current }, 2, 1000 + REVIEW_COOLDOWN_MS);
    expect(after.requested).toBe(false);
    expect(recordReviewMoment(after.current, 1000 + REVIEW_COOLDOWN_MS).shouldRequest).toBe(true);
  });

  it('stops after the maximum number of requests', () => {
    const state = { moments: 10, lastRequestedAt: 0, requestCount: REVIEW_MAX_REQUESTS };
    expect(recordReviewMoment(state, REVIEW_COOLDOWN_MS * 10).shouldRequest).toBe(false);
  });
});
