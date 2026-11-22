import {
  describePromptBlocks,
  clearLlmUsage,
  extractLlmUsage,
  getRecentLlmUsage,
  mergeLlmUsage,
  recordLlmUsage,
  summarizeLlmUsage,
} from '@/utils/llmUsage';

describe('extractLlmUsage', () => {
  it('reads the OpenAI-compatible shape with cached tokens', () => {
    expect(
      extractLlmUsage({
        usage: {
          prompt_tokens: 1200,
          completion_tokens: 80,
          prompt_tokens_details: { cached_tokens: 1024 },
        },
      })
    ).toEqual({ inputTokens: 1200, cachedInputTokens: 1024, outputTokens: 80 });
  });

  it('defaults OpenAI cached tokens to 0 when details are missing', () => {
    expect(extractLlmUsage({ usage: { prompt_tokens: 10, completion_tokens: 2 } })).toEqual({
      inputTokens: 10,
      cachedInputTokens: 0,
      outputTokens: 2,
    });
  });

  it('sums Claude input, cache reads and cache writes', () => {
    expect(
      extractLlmUsage({
        usage: {
          input_tokens: 100,
          output_tokens: 40,
          cache_read_input_tokens: 900,
          cache_creation_input_tokens: 50,
        },
      })
    ).toEqual({ inputTokens: 1050, cachedInputTokens: 900, outputTokens: 40 });
  });

  it('treats missing Claude cache fields as 0', () => {
    expect(extractLlmUsage({ usage: { input_tokens: 7, output_tokens: 3 } })).toEqual({
      inputTokens: 7,
      cachedInputTokens: 0,
      outputTokens: 3,
    });
  });

  it('reads Gemini usageMetadata and adds thinking tokens to output', () => {
    expect(
      extractLlmUsage({
        usageMetadata: {
          promptTokenCount: 500,
          candidatesTokenCount: 30,
          thoughtsTokenCount: 12,
          cachedContentTokenCount: 400,
        },
      })
    ).toEqual({ inputTokens: 500, cachedInputTokens: 400, outputTokens: 42 });
  });

  it('defaults Gemini optional counts to 0', () => {
    expect(
      extractLlmUsage({ usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 1 } })
    ).toEqual({
      inputTokens: 5,
      cachedInputTokens: 0,
      outputTokens: 1,
    });
  });

  it('returns null for junk, undefined and strings', () => {
    expect(extractLlmUsage(undefined)).toBeNull();
    expect(extractLlmUsage(null)).toBeNull();
    expect(extractLlmUsage('usage')).toBeNull();
    expect(extractLlmUsage(42)).toBeNull();
    expect(extractLlmUsage({})).toBeNull();
    expect(extractLlmUsage({ usage: 'x' })).toBeNull();
  });

  it('ignores non-numeric token counts', () => {
    expect(extractLlmUsage({ usage: { prompt_tokens: '12', completion_tokens: 3 } })).toBeNull();
    expect(extractLlmUsage({ usageMetadata: { promptTokenCount: NaN } })).toBeNull();
    expect(extractLlmUsage({ usage: { input_tokens: null } })).toBeNull();
  });
});

describe('mergeLlmUsage', () => {
  const first = { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 };
  const last = { inputTokens: 9, cachedInputTokens: 4, outputTokens: 7 };

  it('returns the later non-null usage (streams carry totals on the last chunk)', () => {
    expect(mergeLlmUsage(first, last)).toBe(last);
  });

  it('keeps the earlier usage when the later one is null', () => {
    expect(mergeLlmUsage(first, null)).toBe(first);
  });

  it('returns the later usage when the earlier one is null', () => {
    expect(mergeLlmUsage(null, last)).toBe(last);
  });

  it('returns null when both are null', () => {
    expect(mergeLlmUsage(null, null)).toBeNull();
  });
});

describe('usage log', () => {
  beforeEach(() => {
    clearLlmUsage();
  });

  it('keeps only the last 50 entries, dropping the oldest', () => {
    for (let i = 0; i < 55; i += 1) {
      recordLlmUsage({
        operation: `op-${i}`,
        provider: 'openai',
        usage: { inputTokens: i, cachedInputTokens: 0, outputTokens: 0 },
        at: i,
      });
    }

    const recent = getRecentLlmUsage();

    expect(recent).toHaveLength(50);
    expect(recent[0].operation).toBe('op-5');
    expect(recent[49].operation).toBe('op-54');
  });

  it('returns a copy that cannot change the log', () => {
    recordLlmUsage({
      operation: 'chat',
      provider: 'claude',
      usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
      at: 1,
    });

    const copy = getRecentLlmUsage() as { operation: string }[];
    copy[0].operation = 'changed';

    expect(getRecentLlmUsage()[0].operation).toBe('chat');
  });

  it('clears the log', () => {
    recordLlmUsage({
      operation: 'chat',
      provider: 'gemini',
      usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
    });

    clearLlmUsage();

    expect(getRecentLlmUsage()).toEqual([]);
  });

  it('summarizes calls, totals and cache hit share', () => {
    const list = [
      {
        operation: 'a',
        provider: 'openai',
        usage: { inputTokens: 100, cachedInputTokens: 50, outputTokens: 10 },
        at: 1,
      },
      {
        operation: 'b',
        provider: 'claude',
        usage: { inputTokens: 200, cachedInputTokens: 100, outputTokens: 20 },
        at: 2,
      },
    ];

    expect(summarizeLlmUsage(list)).toEqual({
      calls: 2,
      inputTokens: 300,
      cachedInputTokens: 150,
      outputTokens: 30,
      cacheHitShare: 0.5,
    });
  });

  it('reports a zero cache hit share when there is no input', () => {
    expect(summarizeLlmUsage([])).toEqual({
      calls: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      cacheHitShare: 0,
    });
  });

  it('rounds the cache hit share to two decimals', () => {
    const list = [
      {
        operation: 'a',
        provider: 'gemini',
        usage: { inputTokens: 3, cachedInputTokens: 1, outputTokens: 0 },
        at: 1,
      },
    ];

    expect(summarizeLlmUsage(list).cacheHitShare).toBe(0.33);
  });
});

describe('describePromptBlocks', () => {
  it('lists blocks biggest first with a total and a token estimate, skipping empty ones', () => {
    const line = describePromptBlocks([
      { name: 'rules', text: 'a'.repeat(400) },
      { name: 'empty', text: '' },
      { name: 'snapshot', text: 'b'.repeat(800) },
    ]);

    expect(line).toBe('snapshot 800, rules 400 | total 1200 chars (~300 tokens)');
  });
});
