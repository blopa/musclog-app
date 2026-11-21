// Model benchmark (plan section 7 / gate G5 inputs): schema validity, refusals, latency, tokens, cost.
//   dry-run (default, offline, mock):  tsx scripts/bench-models.ts
//   live (spends money):               OPENROUTER_API_KEY=... tsx scripts/bench-models.ts --live --max-usd 1.5
// Options: --models id,id  --reps N  --stream  --out results/models
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import sharp from 'sharp';
import {
  Budget,
  ROOT,
  fmt,
  makeTransport,
  mean,
  parseArgs,
  percentile,
  pickModels,
  providerBlock,
  resolveMode,
  type ModelInfo,
  type Transport,
} from './lib/core.ts';
import * as F from '../fixtures/schemas.ts';

const ajv = new Ajv({ strict: false, allErrors: false });

type Fixture =
  | {
      kind: 'schema';
      type: string;
      messages: any[];
      schema: any;
      schemaName: string;
      maxTokens: number;
      needsImage?: boolean;
    }
  | {
      kind: 'tools';
      type: string;
      messages: any[];
      tools: any[];
      toolResult: string;
      maxTokens: number;
    };

async function syntheticMealImage(): Promise<string> {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768"><rect width="768" height="768" fill="#d9d2c5"/><circle cx="384" cy="384" r="300" fill="#f5f5f0"/><circle cx="300" cy="340" r="110" fill="#c98b3c"/><rect x="420" y="300" width="160" height="200" rx="30" fill="#6b8e3a"/><circle cx="330" cy="520" r="70" fill="#b8402f"/></svg>`
  );
  const jpg = await sharp(svg).jpeg({ quality: 80 }).toBuffer();
  return `data:image/jpeg;base64,${jpg.toString('base64')}`;
}

export async function buildFixtures(): Promise<Fixture[]> {
  const img = await syntheticMealImage();
  const strict = F.makeSchemaStrict;
  const fx: Fixture[] = [];
  fx.push({
    kind: 'schema',
    type: 'meal_photo',
    schemaName: 'trackMeal',
    schema: strict(F.TRACK_MEAL_SCHEMA),
    maxTokens: 1500,
    needsImage: true,
    messages: [
      { role: 'system', content: F.MEAL_ANALYSIS_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: F.IMAGE_USER_TEXT },
          { type: 'image_url', image_url: { url: img } },
        ],
      },
    ],
  });
  fx.push({
    kind: 'schema',
    type: 'label_photo',
    schemaName: 'estimateMacros',
    schema: strict(F.ESTIMATE_MACROS_SCHEMA),
    maxTokens: 600,
    needsImage: true,
    messages: [
      { role: 'system', content: F.LABEL_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: F.IMAGE_USER_TEXT },
          { type: 'image_url', image_url: { url: img } },
        ],
      },
    ],
  });
  for (const [i, m] of F.TRACK_MEAL_MESSAGES.entries()) {
    fx.push({
      kind: 'schema',
      type: 'track_meal',
      schemaName: 'trackMeal',
      schema: strict(F.TRACK_MEAL_SCHEMA),
      maxTokens: 1500,
      messages: [
        { role: 'system', content: F.MEAL_ANALYSIS_PROMPT },
        { role: 'user', content: m },
      ],
    });
    void i;
  }
  fx.push({
    kind: 'schema',
    type: 'generate_workout_plan',
    schemaName: 'generateWorkoutPlan',
    schema: strict(F.WORKOUT_PLAN_SCHEMA),
    maxTokens: 3500,
    messages: [
      { role: 'system', content: F.WORKOUT_PLAN_SYSTEM },
      { role: 'user', content: F.WORKOUT_PLAN_USER },
    ],
  });
  for (const m of F.COACH_MESSAGES) {
    fx.push({
      kind: 'schema',
      type: 'coach_chat',
      schemaName: 'coach_response',
      schema: strict(F.COACH_RESPONSE_SCHEMA),
      maxTokens: 800,
      messages: [
        { role: 'system', content: F.COACH_SYSTEM },
        { role: 'user', content: m },
      ],
    });
  }
  fx.push({
    kind: 'tools',
    type: 'tool_roundtrip',
    tools: F.TOOLS_A,
    toolResult: JSON.stringify({ kcal: 2140, protein: 151, carbs: 230, fat: 66 }),
    maxTokens: 600,
    messages: [
      {
        role: 'system',
        content: "You are a nutrition coach. Use tools when you need the user's data.",
      },
      {
        role: 'user',
        content: 'How many calories did I eat on 2026-11-18? Answer in one sentence.',
      },
    ],
  });
  fx.push({
    kind: 'tools',
    type: 'tool_roundtrip',
    tools: F.TOOLS_B,
    toolResult: JSON.stringify({ ok: true }),
    maxTokens: 600,
    messages: [
      {
        role: 'system',
        content: 'You are a nutrition coach. Use tools when you need to act for the user.',
      },
      {
        role: 'user',
        content: 'I just drank two glasses of water (about 500 ml). Please log that, then confirm.',
      },
    ],
  });
  return fx;
}

type Rec = {
  model: string;
  type: string;
  rep: number;
  ok: boolean;
  valid: boolean;
  emptyOrRefused: boolean;
  error?: string;
  latencyMs: number;
  ttftMs: number | null;
  prompt: number;
  completion: number;
  reasoning: number;
  cost: number;
};

function parseJson(s: unknown) {
  try {
    return JSON.parse(String(s));
  } catch {
    return undefined;
  }
}

async function runOne(
  t: Transport,
  model: ModelInfo,
  fx: Fixture,
  rep: number,
  budget: Budget,
  stream: boolean,
  mode: { live: boolean }
): Promise<Rec | 'budget'> {
  const base: any = {
    model: model.id,
    messages: fx.messages,
    max_tokens: Math.min(fx.maxTokens, model.maxCompletion),
    provider: providerBlock(model),
    ...(model.reasoningSupported ? { reasoning: { effort: 'low' } } : {}),
  };
  if (fx.kind === 'schema')
    base.response_format = {
      type: 'json_schema',
      json_schema: { name: fx.schemaName, strict: true, schema: fx.schema },
    };
  else {
    base.tools = fx.tools;
    base.tool_choice = 'auto';
  }

  const textBytes =
    JSON.stringify(fx.messages).replace(/data:image[^"]+/g, '').length +
    JSON.stringify(fx.kind === 'schema' ? fx.schema : fx.tools).length;
  const est =
    Budget.estimate(
      model,
      Math.ceil(textBytes / 2) + (fx.kind === 'schema' && fx.needsImage ? 2500 : 0),
      base.max_tokens
    ) * (fx.kind === 'tools' ? 2 : 1);
  if (mode.live && !budget.allows(est)) return 'budget';

  const rec: Rec = {
    model: model.id,
    type: fx.type,
    rep,
    ok: false,
    valid: false,
    emptyOrRefused: false,
    latencyMs: 0,
    ttftMs: null,
    prompt: 0,
    completion: 0,
    reasoning: 0,
    cost: 0,
  };
  const addUsage = (r: { json: any }) => {
    const u = r.json?.usage;
    if (!u) return;
    rec.prompt += u.prompt_tokens ?? 0;
    rec.completion += u.completion_tokens ?? 0;
    rec.reasoning += u.completion_tokens_details?.reasoning_tokens ?? 0;
    const c = typeof u.cost === 'number' ? u.cost : 0;
    rec.cost += c;
    budget.record(c);
  };

  const r1 = await t.chat(base, { stream, meta: { fixture: fx.type } });
  rec.latencyMs += r1.latencyMs;
  rec.ttftMs = r1.ttftMs;
  addUsage(r1);
  if (r1.status !== 200 || r1.json?.error) {
    rec.error = `HTTP ${r1.status} ${r1.json?.error?.code ?? r1.json?.error?.message ?? ''}`.slice(
      0,
      120
    );
    return rec;
  }
  const ch = r1.json.choices?.[0];
  const msg = ch?.message;

  if (fx.kind === 'schema') {
    const content = msg?.content;
    rec.emptyOrRefused =
      !content ||
      !String(content).trim() ||
      !!msg?.refusal ||
      ch?.finish_reason === 'content_filter';
    const parsed = parseJson(content);
    rec.valid =
      parsed !== undefined &&
      ajv.compile(fx.schema)(parsed) === true &&
      ch?.finish_reason !== 'length';
    rec.ok = true;
    return rec;
  }

  // tool round trip: call 1 must be a valid tool call, call 2 (after the tool result) must be plain text
  const call = msg?.tool_calls?.[0];
  const tool = fx.tools.find((x) => x.function.name === call?.function?.name);
  const args = parseJson(call?.function?.arguments);
  const call1Ok =
    !!tool && args !== undefined && ajv.compile(tool.function.parameters)(args) === true;
  if (!call) rec.emptyOrRefused = !msg?.content;
  if (!call1Ok) {
    rec.ok = true;
    return rec;
  }
  const follow = {
    ...base,
    messages: [
      ...fx.messages,
      { role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls },
      { role: 'tool', tool_call_id: call.id, content: fx.toolResult },
    ],
  };
  const r2 = await t.chat(follow, { stream, meta: { fixture: fx.type } });
  rec.latencyMs += r2.latencyMs;
  addUsage(r2);
  const text = r2.json?.choices?.[0]?.message?.content;
  rec.emptyOrRefused = !text || !String(text).trim();
  rec.valid = r2.status === 200 && !rec.emptyOrRefused;
  rec.ok = true;
  return rec;
}

export function summarise(recs: Rec[]) {
  const groups = new Map<string, Rec[]>();
  for (const r of recs) {
    const k = `${r.model}||${r.type}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  return [...groups.entries()].map(([k, rs]) => {
    const [model, type] = k.split('||');
    const lat = rs.map((r) => r.latencyMs / 1000);
    return {
      model,
      type,
      n: rs.length,
      validPct: (100 * rs.filter((r) => r.valid).length) / rs.length,
      emptyOrRefusedPct: (100 * rs.filter((r) => r.emptyOrRefused).length) / rs.length,
      errorPct: (100 * rs.filter((r) => r.error).length) / rs.length,
      p50s: percentile(lat, 50),
      p95s: percentile(lat, 95),
      ttftP50s: percentile(
        rs
          .map((r) => r.ttftMs)
          .filter((x): x is number => x != null)
          .map((x) => x / 1000),
        50
      ),
      promptAvg: mean(rs.map((r) => r.prompt)),
      completionAvg: mean(rs.map((r) => r.completion)),
      reasoningAvg: mean(rs.map((r) => r.reasoning)),
      costAvg: mean(rs.map((r) => r.cost)),
    };
  });
}

export function toMarkdown(rows: ReturnType<typeof summarise>, meta: string) {
  const out = [
    `# Model benchmark\n\n${meta}\n`,
    '| model | request | n | valid % | empty/refused % | error % | p50 s | p95 s | TTFT p50 s | prompt tok | compl tok | reasoning tok | avg $ |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const r of rows)
    out.push(
      `| ${r.model} | ${r.type} | ${r.n} | ${fmt(r.validPct, 0)} | ${fmt(r.emptyOrRefusedPct, 0)} | ${fmt(r.errorPct, 0)} | ${fmt(r.p50s)} | ${fmt(r.p95s)} | ${fmt(r.ttftP50s)} | ${fmt(r.promptAvg, 0)} | ${fmt(r.completionAvg, 0)} | ${fmt(r.reasoningAvg, 0)} | ${fmt(r.costAvg, 5)} |`
    );
  const byModel = new Map<string, Rec[]>();
  void byModel;
  return out.join('\n') + '\n';
}

export async function main(argv?: string[]) {
  const a = parseArgs(argv);
  const mode = resolveMode(a);
  const models = pickModels(a.str('models'));
  const reps = a.num('reps', 3);
  const stream = a.has('stream');
  const fixtures = await buildFixtures();
  const budget = new Budget(mode.maxUsd);
  const t = makeTransport(mode);
  const recs: Rec[] = [];
  let stopped = false;
  outer: for (const model of models)
    for (const fx of fixtures)
      for (let rep = 0; rep < reps; rep++) {
        const r = await runOne(t, model, fx, rep, budget, stream, mode);
        if (r === 'budget') {
          stopped = true;
          break outer;
        }
        recs.push(r);
      }
  const rows = summarise(recs);
  const meta = `Mode: ${mode.live ? 'LIVE' : 'DRY-RUN (mock transport, numbers are NOT measurements)'}. Models: ${models.map((m) => m.id).join(', ')}. Reps: ${reps}. Streaming: ${stream}. Spent: $${budget.spent.toFixed(4)}${mode.live ? ` of $${mode.maxUsd}` : ''}${stopped ? ' (STOPPED early by --max-usd guard)' : ''}.`;
  const out = a.str('out') ?? join('results', mode.live ? 'models-live' : 'models-dryrun');
  mkdirSync(join(ROOT, 'results'), { recursive: true });
  writeFileSync(join(ROOT, `${out}.json`), JSON.stringify({ meta, rows, records: recs }, null, 1));
  writeFileSync(join(ROOT, `${out}.md`), toMarkdown(rows, meta));
  console.log(meta);
  console.log(`rows: ${rows.length}, calls: ${recs.length} -> ${out}.{json,md}`);
  return { rows, recs, spent: budget.spent };
}

if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((e) => {
    console.error(String(e.message ?? e));
    process.exit(1);
  });
