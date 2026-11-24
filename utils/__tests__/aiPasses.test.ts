import { AiCancelledError } from '../aiErrors';
import { reviewAndRevise, runSamples, sameValue } from '../aiPasses';

describe('runSamples', () => {
  it('returns every answer in order and leaves out empty ones and failures', async () => {
    const answers = await runSamples({ provider: 'openai' }, 4, async (index) => {
      if (index === 1) {
        return null;
      }

      if (index === 2) {
        throw new Error('flaky');
      }

      return `answer ${index}`;
    });

    expect(answers).toEqual(['answer 0', 'answer 3']);
  });

  it('runs cloud samples together', async () => {
    let running = 0;
    let most = 0;
    await runSamples({ provider: 'hosted' }, 3, async () => {
      running++;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return 1;
    });

    expect(most).toBe(3);
  });

  it.each(['on-device', 'local'])('runs %s samples one after another', async (provider) => {
    let running = 0;
    let most = 0;
    const answers = await runSamples({ provider }, 3, async (index) => {
      running++;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return index;
    });

    expect(most).toBe(1);
    expect(answers).toEqual([0, 1, 2]);
  });

  it('rethrows the first failure when no sample answers', async () => {
    const first = new Error('invalid key');
    await expect(
      runSamples({ provider: 'claude' }, 2, async (index) => {
        throw index === 0 ? first : new Error('second');
      })
    ).rejects.toBe(first);
  });

  it('hands every failure it swallows to onDroppedFailure, so a lost sample is not silent', async () => {
    const dropped: unknown[] = [];
    const flaky = new Error('flaky');
    const answers = await runSamples(
      { provider: 'openai' },
      3,
      async (index) => {
        if (index === 1) {
          throw flaky;
        }

        return index;
      },
      { onDroppedFailure: (error) => dropped.push(error) }
    );

    expect(answers).toEqual([0, 2]);
    expect(dropped).toEqual([flaky]);
  });

  it('reports nothing through onDroppedFailure when every sample failed (the rethrow is the report)', async () => {
    const dropped: unknown[] = [];
    const first = new Error('first');
    await expect(
      runSamples(
        { provider: 'local' },
        2,
        async (index) => {
          throw index === 0 ? first : new Error('second');
        },
        { onDroppedFailure: (error) => dropped.push(error) }
      )
    ).rejects.toBe(first);
    expect(dropped).toEqual([]);
  });

  it('never hands a cancel to onDroppedFailure', async () => {
    const dropped: unknown[] = [];
    await expect(
      runSamples(
        { provider: 'gemini' },
        2,
        async (index) => {
          if (index === 0) {
            throw new AiCancelledError();
          }

          return index;
        },
        { onDroppedFailure: (error) => dropped.push(error) }
      )
    ).rejects.toBeInstanceOf(AiCancelledError);
    expect(dropped).toEqual([]);
  });

  it('answers an empty list when every sample answered nothing', async () => {
    await expect(runSamples({ provider: 'gemini' }, 3, async () => null)).resolves.toEqual([]);
  });

  it.each(['openai', 'on-device'])('propagates a cancel (%s)', async (provider) => {
    const run = jest.fn(async (index: number) => {
      if (index === 0) {
        throw new AiCancelledError();
      }

      return index;
    });

    await expect(runSamples({ provider }, 3, run)).rejects.toBeInstanceOf(AiCancelledError);
    if (provider === 'on-device') {
      expect(run).toHaveBeenCalledTimes(1);
    }
  });

  it('runs at least once', async () => {
    const run = jest.fn(async () => 'one');
    await expect(runSamples({ provider: 'openai' }, 0, run)).resolves.toEqual(['one']);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('reviewAndRevise', () => {
  const fewerProblems = (current: number, revised: number) => revised < current;

  it('keeps each accepted revision, up to the rounds asked for', async () => {
    const critique = jest.fn(async (current: number) => current - 1);
    await expect(
      reviewAndRevise({ draft: 5, rounds: 2, critique, accept: fewerProblems })
    ).resolves.toBe(3);
    expect(critique).toHaveBeenCalledTimes(2);
  });

  it('makes no request with no rounds', async () => {
    const critique = jest.fn(async () => 0);
    await expect(
      reviewAndRevise({ draft: 5, rounds: 0, critique, accept: fewerProblems })
    ).resolves.toBe(5);
    expect(critique).not.toHaveBeenCalled();
  });

  it('stops at a refused or empty revision and keeps what it had', async () => {
    const worse = jest.fn(async (current: number) => current + 1);
    await expect(
      reviewAndRevise({ draft: 5, rounds: 2, critique: worse, accept: fewerProblems })
    ).resolves.toBe(5);
    expect(worse).toHaveBeenCalledTimes(1);

    const empty = jest.fn(async () => null);
    await expect(
      reviewAndRevise({ draft: 5, rounds: 2, critique: empty, accept: fewerProblems })
    ).resolves.toBe(5);
    expect(empty).toHaveBeenCalledTimes(1);
  });

  it('keeps the answer when a round fails, and says so', async () => {
    const failure = new Error('rate limited');
    const onError = jest.fn();
    await expect(
      reviewAndRevise({
        draft: 5,
        rounds: 2,
        critique: async (current, round) => {
          if (round === 1) {
            throw failure;
          }

          return current - 1;
        },
        accept: fewerProblems,
        onError,
      })
    ).resolves.toBe(4);
    expect(onError).toHaveBeenCalledWith(failure);
  });

  it('propagates a cancel', async () => {
    await expect(
      reviewAndRevise({
        draft: 5,
        rounds: 1,
        critique: async () => {
          throw new AiCancelledError();
        },
        accept: fewerProblems,
      })
    ).rejects.toBeInstanceOf(AiCancelledError);
  });

  describe('with isUnchanged', () => {
    type Answer = { kcal: number };
    const draft: Answer = { kcal: 5 };
    const acceptAll = () => true;

    it('stops at an identical revision and returns the answer it had', async () => {
      const critique = jest.fn(async (current: Answer) => ({ ...current }));
      const result = await reviewAndRevise({
        draft,
        rounds: 3,
        critique,
        accept: acceptAll,
        isUnchanged: sameValue,
      });
      expect(critique).toHaveBeenCalledTimes(1);
      expect(result).toBe(draft);
    });

    it('continues past a changed revision to the next round', async () => {
      const critique = jest.fn(async (current: Answer) => ({ kcal: current.kcal - 1 }));
      const result = await reviewAndRevise({
        draft,
        rounds: 3,
        critique,
        accept: acceptAll,
        isUnchanged: sameValue,
      });
      expect(critique).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ kcal: 2 });
    });

    it('without isUnchanged runs every round even when the revision is equal', async () => {
      const critique = jest.fn(async (current: Answer) => ({ ...current }));
      await reviewAndRevise({ draft, rounds: 3, critique, accept: acceptAll });
      expect(critique).toHaveBeenCalledTimes(3);
    });

    it('still stops at a refused revision', async () => {
      const critique = jest.fn(async (current: Answer) => ({ kcal: current.kcal + 1 }));
      const result = await reviewAndRevise({
        draft,
        rounds: 3,
        critique,
        accept: (current, revised) => revised.kcal < current.kcal,
        isUnchanged: sameValue,
      });
      expect(critique).toHaveBeenCalledTimes(1);
      expect(result).toBe(draft);
    });
  });
});

describe('sameValue', () => {
  it('treats structurally equal objects and arrays as the same', () => {
    expect(sameValue({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] })).toBe(true);
    expect(sameValue([1, 'x'], [1, 'x'])).toBe(true);
    expect(sameValue({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameValue([1, 2], [2, 1])).toBe(false);
  });

  it('compares strings and primitives by value and the same reference as equal', () => {
    expect(sameValue('meal', 'meal')).toBe(true);
    expect(sameValue('meal', 'Meal')).toBe(false);
    expect(sameValue(3, 3)).toBe(true);
    expect(sameValue(3, '3')).toBe(false);
    const object = { a: 1 };
    expect(sameValue(object, object)).toBe(true);
  });
});
