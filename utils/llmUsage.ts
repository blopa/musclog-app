/**
 * Token usage read from the three providers' responses.
 *
 * Pure: no React Native or Expo imports. `inputTokens` is the TOTAL prompt
 * tokens (cache hits included); `cachedInputTokens` is the part served from
 * the provider's cache.
 */

export type LlmUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

export type LlmUsageEntry = {
  operation: string;
  provider: string;
  usage: LlmUsage;
  at: number;
};

export type LlmUsageSummary = {
  calls: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  cacheHitShare: number;
};

const MAX_ENTRIES = 50;

const entries: LlmUsageEntry[] = [];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

const countOr0 = (value: unknown): number => readCount(value) ?? 0;

/**
 * The usage of a llama.rn completion: `tokens_evaluated` is the whole prompt, of which
 * `timings.cache_n` came from the engine's cache. Null when the engine counted nothing.
 */
export function extractLocalUsage(result: unknown): LlmUsage | null {
  if (!isRecord(result) || readCount(result.tokens_evaluated) === null) {
    return null;
  }

  const timings = isRecord(result.timings) ? result.timings : null;

  return {
    inputTokens: countOr0(result.tokens_evaluated),
    cachedInputTokens: countOr0(timings?.cache_n),
    outputTokens: countOr0(result.tokens_predicted),
  };
}

/**
 * Reads usage from a raw provider response or stream chunk. Returns null when
 * the shape is unknown or carries no numeric token counts.
 *
 * - OpenAI-compatible (OpenAI, OpenRouter): `usage.prompt_tokens`.
 * - Claude: `usage.input_tokens` EXCLUDES cache reads and writes, so the total
 *   input is input + cache read + cache creation.
 * - Gemini: `usageMetadata.promptTokenCount`; output includes thinking tokens.
 */
export function extractLlmUsage(raw: unknown): LlmUsage | null {
  if (!isRecord(raw)) {
    return null;
  }

  try {
    const usage = isRecord(raw.usage) ? raw.usage : null;

    if (usage && readCount(usage.prompt_tokens) !== null) {
      const details = isRecord(usage.prompt_tokens_details) ? usage.prompt_tokens_details : null;

      return {
        inputTokens: countOr0(usage.prompt_tokens),
        cachedInputTokens: countOr0(details?.cached_tokens),
        outputTokens: countOr0(usage.completion_tokens),
      };
    }

    if (usage && readCount(usage.input_tokens) !== null) {
      const cacheRead = countOr0(usage.cache_read_input_tokens);
      const cacheCreation = countOr0(usage.cache_creation_input_tokens);

      return {
        inputTokens: countOr0(usage.input_tokens) + cacheRead + cacheCreation,
        cachedInputTokens: cacheRead,
        outputTokens: countOr0(usage.output_tokens),
      };
    }

    const meta = isRecord(raw.usageMetadata) ? raw.usageMetadata : null;

    if (meta && readCount(meta.promptTokenCount) !== null) {
      return {
        inputTokens: countOr0(meta.promptTokenCount),
        cachedInputTokens: countOr0(meta.cachedContentTokenCount),
        outputTokens: countOr0(meta.candidatesTokenCount) + countOr0(meta.thoughtsTokenCount),
      };
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Combines usage from one call's chunks. Streamed responses usually carry the
 * totals only on the LAST chunk that has usage, so the later value wins and
 * the earlier one is kept only when the later one is missing.
 */
export function mergeLlmUsage(a: LlmUsage | null, b: LlmUsage | null): LlmUsage | null {
  return b ?? a;
}

/** Records one call's usage in the bounded in-memory log (last 50 kept). */
export function recordLlmUsage(entry: {
  operation: string;
  provider: string;
  usage: LlmUsage;
  at?: number;
}): void {
  const recorded: LlmUsageEntry = {
    operation: entry.operation,
    provider: entry.provider,
    usage: { ...entry.usage },
    at: entry.at ?? Date.now(),
  };

  entries.push(recorded);

  while (entries.length > MAX_ENTRIES) {
    entries.shift();
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[llmUsage]', recorded.operation, recorded.provider, recorded.usage);
  }
}

/** Copy of the recorded entries, oldest first. */
export function getRecentLlmUsage(): readonly LlmUsageEntry[] {
  return entries.map((entry) => ({ ...entry, usage: { ...entry.usage } }));
}

export function clearLlmUsage(): void {
  entries.length = 0;
}

export function summarizeLlmUsage(list: readonly LlmUsageEntry[]): LlmUsageSummary {
  let inputTokens = 0;
  let cachedInputTokens = 0;
  let outputTokens = 0;

  for (const entry of list) {
    inputTokens += entry.usage.inputTokens;
    cachedInputTokens += entry.usage.cachedInputTokens;
    outputTokens += entry.usage.outputTokens;
  }

  const cacheHitShare =
    inputTokens === 0 ? 0 : Math.round((cachedInputTokens / inputTokens) * 100) / 100;

  return {
    calls: list.length,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    cacheHitShare,
  };
}

/** Rough characters per token for mixed English text; only for a human-readable size estimate. */
const CHARS_PER_TOKEN_ESTIMATE = 4;

/**
 * One line saying how big each block of a prompt is, biggest first, with a rough token estimate
 * (characters / 4: other languages cost more). Used by the dev log so the heaviest block of the
 * coach's system prompt is visible instead of guessed.
 */
export function describePromptBlocks(blocks: readonly { name: string; text: string }[]): string {
  const sized = blocks
    .filter((block) => block.text.length > 0)
    .map((block) => ({ name: block.name, chars: block.text.length }))
    .sort((a, b) => b.chars - a.chars);
  const total = sized.reduce((sum, block) => sum + block.chars, 0);
  const parts = sized.map((block) => `${block.name} ${block.chars}`);

  return `${parts.join(', ')} | total ${total} chars (~${Math.round(total / CHARS_PER_TOKEN_ESTIMATE)} tokens)`;
}
