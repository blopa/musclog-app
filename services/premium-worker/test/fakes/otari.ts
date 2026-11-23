// Scripted OtariClient for tests. No network. Chat bodies are recorded into the same `allRecorded`
// as the OpenRouter fake, tagged `upstream: 'otari'`, so the privacy assertions see them.
//   const ot = fakeOtari(otariJsonCompletion('0.001230'));
//   ot.calls[0].body                       // parsed upstream body
//   ot.summary = { costUsd: 1, requests: 3, errors: 0, unpriced: 0 }   // usageSummary result
import type { OtariConfig } from '../../src/config';
import type { OtariBudget, OtariClient, OtariUsageSummary } from '../../src/upstream/types';
import { allRecorded, respond, type Recorded, type Script, type ScriptSource } from './openrouter';

/** A valid `otari` config block: a pinned selector per feature, prices unlike OpenRouter's. */
export const OTARI_CONFIG: OtariConfig = {
  providers: ['deepinfra'],
  models: {
    chat: {
      model: 'deepinfra:z-ai/glm-5.3-flash',
      prices: { prompt_per_mtok: 0.2, completion_per_mtok: 0.8, image_per_image: 0 },
    },
    structured: {
      model: 'deepinfra:z-ai/glm-5.3-flash',
      prices: { prompt_per_mtok: 0.2, completion_per_mtok: 0.8, image_per_image: 0 },
    },
    vision: {
      model: 'deepinfra:z-ai/glm-5.3-vision',
      prices: { prompt_per_mtok: 0.3, completion_per_mtok: 1, image_per_image: 0.002 },
    },
  },
};

export interface FakeOtari extends OtariClient {
  calls: Recorded[];
  /** Result (or error) of usageSummary / budget. */
  summary: OtariUsageSummary | Error;
  summaryCalls: { startMs: number; endMs: number }[];
  budgetResult: OtariBudget | Error;
  budgetCalls: number;
}

export function fakeOtari(script: ScriptSource): FakeOtari {
  const calls: Recorded[] = [];
  const fake: FakeOtari = {
    calls,
    summary: { costUsd: 0, requests: 0, errors: 0, unpriced: 0 },
    summaryCalls: [],
    budgetResult: { enforced: false, remainingUsd: null },
    budgetCalls: 0,
    async chatCompletions(text, init) {
      const rec: Recorded = {
        body: JSON.parse(text),
        text,
        signal: init.signal,
        upstream: 'otari',
      };
      calls.push(rec);
      allRecorded.push(rec);
      const s = typeof script === 'function' ? await script(calls.length - 1, rec.body) : script;
      return respond(s, init.signal);
    },
    async usageSummary(startMs, endMs) {
      fake.summaryCalls.push({ startMs, endMs });
      if (fake.summary instanceof Error) throw fake.summary;
      return fake.summary;
    },
    async budget() {
      fake.budgetCalls++;
      if (fake.budgetResult instanceof Error) throw fake.budgetResult;
      return fake.budgetResult;
    },
  };
  return fake;
}

// ---------- builders ----------

/** Otari reports cost as a six-decimal USD string in `usage.cost_usd`. */
export const otariUsageObject = (cost: string, prompt = 100, completion = 50) => ({
  prompt_tokens: prompt,
  completion_tokens: completion,
  total_tokens: prompt + completion,
  cost_usd: cost,
});

export const OTARI_HEADERS = { 'otari-provider': 'deepinfra', 'otari-request-id': 'req-otari-1' };

export function otariJsonCompletion(
  cost: string | null,
  headers: Record<string, string> = OTARI_HEADERS,
  content = 'hello'
): Script {
  return {
    kind: 'json',
    headers,
    body: {
      id: 'chatcmpl-otari-1',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      ...(cost === null ? {} : { usage: otariUsageObject(cost) }),
    },
  };
}

const data = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;

/** SSE chunks: content deltas, finish, the usage chunk (when `cost`), [DONE]. */
export function otariSseChunks(o: { pieces?: string[]; cost?: string | null } = {}): string[] {
  const id = 'chatcmpl-otari-sse';
  const out: string[] = [];
  for (const p of o.pieces ?? ['Hel', 'lo']) {
    out.push(data({ id, choices: [{ index: 0, delta: { content: p } }] }));
  }
  out.push(data({ id, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }));
  if (o.cost != null) out.push(data({ id, choices: [], usage: otariUsageObject(o.cost) }));
  out.push('data: [DONE]\n\n');
  return out;
}

export const otariSseCompletion = (
  cost: string | null,
  headers: Record<string, string> = OTARI_HEADERS
): Script => ({ kind: 'sse', chunks: otariSseChunks({ cost }), headers });
