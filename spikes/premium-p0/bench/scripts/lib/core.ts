import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export type ModelInfo = {
  id: string;
  cheapestZdrEndpoint: string;
  promptPer1M: number;
  completionPer1M: number;
  context: number;
  maxCompletion: number;
  reasoningSupported: boolean;
};

export const DEFAULT_MODELS = [
  'openai/gpt-6-luna',
  'mistralai/mistral-small-2603',
  'qwen/qwen3-vl-30b-a3b-instruct',
  'openai/gpt-5-nano',
  'mistralai/mistral-small-3.2-24b-instruct',
  'qwen/qwen3.5-9b',
];

export function loadSnapshot(): Map<string, ModelInfo> {
  const f = join(ROOT, 'fixtures', 'models.snapshot.json');
  const rows: ModelInfo[] = JSON.parse(readFileSync(f, 'utf8')).models;
  return new Map(rows.map((r) => [r.id, r]));
}

export function pickModels(arg: string | undefined): ModelInfo[] {
  const snap = loadSnapshot();
  const ids = arg
    ? arg
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_MODELS;
  return ids.map((id) => {
    const m = snap.get(id);
    if (!m)
      throw new Error(
        `Model ${id} is not in fixtures/models.snapshot.json (not ZDR-eligible, or run "npm run shortlist" first).`
      );
    return m;
  });
}

// ---- CLI -------------------------------------------------------------------------------------------------
export type Mode = { live: boolean; maxUsd: number };

export function parseArgs(argv = process.argv.slice(2)) {
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags.set(k, next);
      i++;
    } else flags.set(k, true);
  }
  return {
    str: (k: string) => (typeof flags.get(k) === 'string' ? (flags.get(k) as string) : undefined),
    has: (k: string) => flags.has(k),
    num: (k: string, d: number) => (typeof flags.get(k) === 'string' ? Number(flags.get(k)) : d),
  };
}

export function resolveMode(a: ReturnType<typeof parseArgs>): Mode {
  const live = a.has('live');
  if (live && a.has('dry-run')) throw new Error('--live and --dry-run are mutually exclusive.');
  if (!live) return { live: false, maxUsd: a.num('max-usd', Infinity) };
  const maxUsd = a.num('max-usd', NaN);
  if (!Number.isFinite(maxUsd) || maxUsd <= 0) {
    throw new Error(
      '--live requires --max-usd <positive number>. Refusing to run without a spending guard.'
    );
  }
  if (!process.env.OPENROUTER_API_KEY)
    throw new Error('--live requires OPENROUTER_API_KEY in the environment.');
  return { live, maxUsd };
}

// ---- Budget guard -----------------------------------------------------------------------------------------
export class Budget {
  spent = 0;
  constructor(readonly maxUsd: number) {}
  /** Worst case for one call: all input at the prompt price, max_tokens at the completion price. */
  static estimate(model: ModelInfo, promptTokens: number, maxTokens: number) {
    return (promptTokens * model.promptPer1M + maxTokens * model.completionPer1M) / 1e6;
  }
  allows(estimate: number) {
    return this.spent + estimate <= this.maxUsd;
  }
  record(cost: number | undefined) {
    if (typeof cost === 'number' && Number.isFinite(cost)) this.spent += cost;
  }
}

// ---- Stats -------------------------------------------------------------------------------------------------
export function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}
export const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
export const fmt = (n: number | null | undefined, d = 2) =>
  n == null || Number.isNaN(n) ? 'n/a' : n.toFixed(d);

// ---- Transport ---------------------------------------------------------------------------------------------
export type ChatResult = {
  status: number;
  json: any; // normalised non-streaming shape: { choices:[{message,finish_reason}], usage, error? }
  latencyMs: number;
  ttftMs: number | null;
};
export type CallOpts = { stream: boolean; meta?: Record<string, any> };
export interface Transport {
  chat(body: any, opts: CallOpts): Promise<ChatResult>;
}

/** Provider routing the Worker will force (plan section 7), plus max_price pinned from the snapshot. */
export function providerBlock(model: ModelInfo) {
  return {
    zdr: true,
    data_collection: 'deny',
    require_parameters: true,
    allow_fallbacks: false,
    // USD per million tokens, the unit OpenRouter documents for max_price.
    max_price: { prompt: model.promptPer1M, completion: model.completionPer1M },
  };
}

export class LiveTransport implements Transport {
  private key = process.env.OPENROUTER_API_KEY!; // never logged, never written
  async chat(body: any, opts: CallOpts): Promise<ChatResult> {
    const t0 = performance.now();
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(opts.stream ? { ...body, stream: true } : body),
    });
    if (!opts.stream || !res.ok || !res.body) {
      const json = await res.json().catch(() => ({ error: { message: 'unparseable body' } }));
      return { status: res.status, json, latencyMs: performance.now() - t0, ttftMs: null };
    }
    let ttft: number | null = null;
    let content = '';
    const calls: any[] = [];
    let finish: string | null = null;
    let usage: any;
    let error: any;
    const dec = new TextDecoder();
    let buf = '';
    for await (const chunk of res.body as any) {
      buf += dec.decode(chunk, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue; // ": OPENROUTER PROCESSING" comments are ignored
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        let j: any;
        try {
          j = JSON.parse(data);
        } catch {
          continue;
        }
        if (j.error) error = j.error;
        if (j.usage) usage = j.usage; // docs: the final chunk before [DONE] carries usage
        const c = j.choices?.[0];
        if (c?.finish_reason) finish = c.finish_reason;
        const d = c?.delta;
        if (d?.content) {
          if (ttft === null) ttft = performance.now() - t0;
          content += d.content;
        }
        for (const tc of d?.tool_calls ?? []) {
          if (ttft === null) ttft = performance.now() - t0;
          const slot = (calls[tc.index ?? 0] ??= {
            id: tc.id,
            type: 'function',
            function: { name: '', arguments: '' },
          });
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.function.name += tc.function.name;
          if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
        }
      }
    }
    const message: any = { role: 'assistant', content };
    if (calls.length) message.tool_calls = calls.filter(Boolean);
    return {
      status: res.status,
      json: { choices: [{ message, finish_reason: finish }], usage, error },
      latencyMs: performance.now() - t0,
      ttftMs: ttft,
    };
  }
}

// ---- Offline mock ------------------------------------------------------------------------------------------
function hashInt(s: string): number {
  return createHash('sha256').update(s).digest().readUInt32BE(0);
}
function sample(schema: any, seed: number, depth = 0): any {
  if (schema.enum) return schema.enum[seed % schema.enum.length];
  switch (schema.type) {
    case 'object': {
      const o: any = {};
      for (const [k, v] of Object.entries<any>(schema.properties ?? {}))
        o[k] = sample(v, seed + k.length, depth + 1);
      return o;
    }
    case 'array':
      return Array.from(
        { length: Math.max(schema.minItems ?? 1, 1) + (depth === 1 ? 1 : 0) },
        (_, i) => sample(schema.items, seed + i, depth + 1)
      );
    case 'number':
      return 20 + (seed % 200);
    case 'integer':
      return 1 + (seed % 10);
    case 'boolean':
      return true;
    default:
      return 'mock text ' + (seed % 97);
  }
}

export async function imageTokensFor(model: string, dataUrl: string): Promise<number> {
  const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  const { width = 0, height = 0 } = await sharp(buf).metadata();
  // Tile model, invented for the mock only: 512 px tiles at 170 tokens + 85 base, capped (real models differ).
  const cap = model.includes('qwen') ? 1600 : 1100;
  return Math.min(cap, Math.ceil(width / 512) * Math.ceil(height / 512) * 170 + 85);
}

export class MockTransport implements Transport {
  constructor(private snapshot = loadSnapshot()) {}
  async chat(body: any, opts: CallOpts): Promise<ChatResult> {
    const model = this.snapshot.get(body.model);
    const text =
      JSON.stringify(
        body.messages.map((m: any) =>
          typeof m.content === 'string'
            ? m.content
            : (m.content ?? []).filter((p: any) => p.type === 'text').map((p: any) => p.text)
        )
      ) +
      JSON.stringify(body.tools ?? '') +
      JSON.stringify(body.response_format ?? '');
    let promptTokens = Math.ceil(text.length / 4);
    let pixels = 0;
    for (const m of body.messages) {
      if (Array.isArray(m.content))
        for (const p of m.content)
          if (p.type === 'image_url') {
            promptTokens += await imageTokensFor(body.model, p.image_url.url);
            const buf = Buffer.from(
              p.image_url.url.slice(p.image_url.url.indexOf(',') + 1),
              'base64'
            );
            const md = await sharp(buf).metadata();
            pixels = (md.width ?? 0) * (md.height ?? 0);
          }
    }
    const seed = hashInt(body.model + text.slice(0, 400) + JSON.stringify(opts.meta ?? {}));
    const latency = 400 + (seed % 1500) + pixels / 5000;
    const toolsPresent = Array.isArray(body.tools) && body.tools.length > 0;
    const sawToolResult = body.messages.some((m: any) => m.role === 'tool');
    let message: any;
    let completion: number;
    if (toolsPresent && !sawToolResult) {
      const t = body.tools[0].function;
      message = {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_' + (seed % 9999),
            type: 'function',
            function: { name: t.name, arguments: JSON.stringify(sample(t.parameters, seed)) },
          },
        ],
      };
      completion = 40;
    } else if (body.response_format?.json_schema?.schema) {
      const out = sample(body.response_format.json_schema.schema, seed);
      const gold = opts.meta?.gold;
      if (gold && out.meals) {
        const noise =
          1 + ((seed % 1000) / 1000 - 0.5) * 2 * (0.35 - Math.min(0.25, (pixels / 4e6) * 0.4)); // smaller image, noisier
        out.meals = [
          {
            mealType: 'lunch',
            mealName: 'mock dish',
            ingredients: [
              {
                name: 'mock',
                kcal: gold.kcal * noise,
                protein: gold.protein * noise,
                carbs: gold.carbs * noise,
                fat: gold.fat * noise,
                fiber: 3,
                grams: gold.grams ?? 300,
              },
            ],
          },
        ];
      } else if (gold) {
        const noise = 1 + ((seed % 1000) / 1000 - 0.5) * 0.1;
        Object.assign(out, {
          kcal: gold.kcal * noise,
          protein: gold.protein * noise,
          carbs: gold.carbs * noise,
          fat: gold.fat * noise,
        });
      }
      // ~2% of calls from the two weakest mock models drop a required field, so the validity metric has teeth.
      if (/nano|qwen3\.5-9b/.test(body.model) && seed % 50 === 0) delete out[Object.keys(out)[0]];
      message = { role: 'assistant', content: JSON.stringify(out) };
      completion = Math.ceil(message.content.length / 4);
    } else {
      message = { role: 'assistant', content: 'Mock final answer after tool use.' };
      completion = 12;
    }
    const reasoning = model?.reasoningSupported ? 30 + (seed % 120) : 0;
    const cost = model
      ? (promptTokens * model.promptPer1M + (completion + reasoning) * model.completionPer1M) / 1e6
      : 0;
    const usage = {
      prompt_tokens: promptTokens,
      completion_tokens: completion + reasoning,
      total_tokens: promptTokens + completion + reasoning,
      cost,
      completion_tokens_details: { reasoning_tokens: reasoning },
    };
    return {
      status: 200,
      json: {
        id: 'gen-mock',
        choices: [{ message, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }],
        usage,
      },
      latencyMs: latency,
      ttftMs: opts.stream ? latency * 0.35 : null,
    };
  }
}

export function makeTransport(mode: Mode): Transport {
  return mode.live ? new LiveTransport() : new MockTransport();
}

export const fileExists = existsSync;
