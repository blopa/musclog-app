// SSE pass-through support (plan 7 "Streaming"): the stream is relayed unchanged while a small
// tail is kept, from which the final usage chunk (OpenRouter sends it just before [DONE]) is read.
// Nothing here ever throws on malformed upstream data.
import { isObj, num, type Json } from '../upstream/http';

export const TAIL_BYTES = 2048;

export interface ParsedUsage {
  /** USD, from `usage.cost`; null when absent. */
  costUsd: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  /** The tail holds a final chunk with an `error` object or finish_reason "error". */
  error: boolean;
}

export type UsageRead = Omit<ParsedUsage, 'error'>;
/** Reads a response's `usage` object; null when it carries no usable cost. One per gateway. */
export type UsageReader = (usage: unknown) => UsageRead | null;

function makeUsageReader(readCost: (u: Json) => number | null): UsageReader {
  return (u) => {
    if (!isObj(u)) return null;
    const cost = readCost(u);
    if (cost === null || cost < 0) return null;
    return {
      costUsd: cost,
      promptTokens: num(u.prompt_tokens),
      completionTokens: num(u.completion_tokens),
    };
  };
}

/** OpenRouter: `usage.cost`, a number of USD. */
export const openRouterUsage: UsageReader = makeUsageReader((u) => num(u.cost));

/** Otari: `usage.cost_usd`, a six-decimal USD string (a number is accepted too). */
export const otariUsage: UsageReader = makeUsageReader((u) => {
  const raw = u.cost_usd;
  return typeof raw === 'string' && raw.trim() !== '' ? num(Number(raw)) : num(raw);
});

/** The last usage object with a numeric cost, and whether the tail ends in an error chunk. */
export function parseTail(text: string, readUsage: UsageReader = openRouterUsage): ParsedUsage {
  let usage: UsageRead = {
    costUsd: null,
    promptTokens: null,
    completionTokens: null,
  };
  let error = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    // Comment lines (": OPENROUTER PROCESSING") and non-data lines are ignored.
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (payload === '' || payload === '[DONE]') continue;
    let chunk: unknown;
    try {
      chunk = JSON.parse(payload);
    } catch {
      continue; // a line cut by the tail window or malformed
    }
    if (!isObj(chunk)) continue;
    const u = readUsage(chunk.usage);
    if (u) usage = u;
    if (isObj(chunk.error)) error = true;
    if (Array.isArray(chunk.choices)) {
      for (const c of chunk.choices) if (isObj(c) && c.finish_reason === 'error') error = true;
    }
  }
  return { ...usage, error };
}

/** Non-stream response body: usage and the generation id. Never throws. */
export function parseJsonUsage(
  body: string,
  readUsage: UsageReader = openRouterUsage
): ParsedUsage & { id: string | null } {
  try {
    const j: unknown = JSON.parse(body);
    if (isObj(j)) {
      const u = readUsage(j.usage);
      return {
        costUsd: u?.costUsd ?? null,
        promptTokens: u?.promptTokens ?? null,
        completionTokens: u?.completionTokens ?? null,
        error: isObj(j.error),
        id: typeof j.id === 'string' ? j.id : null,
      };
    }
  } catch {
    /* fall through */
  }
  return { costUsd: null, promptTokens: null, completionTokens: null, error: false, id: null };
}

const ID_RE = /"id"\s*:\s*"([^"]{1,200})"/;

/** Keeps the last TAIL_BYTES of everything pushed, and the first chunk's `id` (the generation id). */
export class TailBuffer {
  private buf = new Uint8Array(TAIL_BYTES * 2);
  private len = 0;
  private first = true;
  firstId: string | null = null;

  push(chunk: Uint8Array): void {
    if (this.first) {
      this.first = false;
      const m = ID_RE.exec(new TextDecoder().decode(chunk.subarray(0, 2048)));
      this.firstId = m ? m[1]! : null;
    }
    if (chunk.length >= TAIL_BYTES) {
      this.buf.set(chunk.subarray(chunk.length - TAIL_BYTES), 0);
      this.len = TAIL_BYTES;
      return;
    }
    if (this.len + chunk.length > this.buf.length) {
      const keep = Math.min(this.len, TAIL_BYTES);
      this.buf.copyWithin(0, this.len - keep, this.len);
      this.len = keep;
    }
    this.buf.set(chunk, this.len);
    this.len += chunk.length;
  }

  text(): string {
    return new TextDecoder().decode(
      this.buf.subarray(Math.max(0, this.len - TAIL_BYTES), this.len)
    );
  }

  /** The generation id: from the tail's last chunk id, else the first chunk. */
  generationId(): string | null {
    return this.firstId ?? ID_RE.exec(this.text())?.[1] ?? null;
  }
}
