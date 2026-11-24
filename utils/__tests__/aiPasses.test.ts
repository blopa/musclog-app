import { AiCancelledError } from '../aiErrors';
import { reviewAndRevise, runSamples } from '../aiPasses';

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
});
