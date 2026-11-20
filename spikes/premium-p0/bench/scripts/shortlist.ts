// Builds the ZDR-eligible vision shortlist from OpenRouter's public, unauthenticated endpoints (GET only).
// Usage: tsx scripts/shortlist.ts [--out results/shortlist.json]
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = 'https://openrouter.ai/api/v1';
const PLAN_CANDIDATES = [
  'openai/gpt-6-luna', 'anthropic/claude-haiku-5.5', 'mistralai/mistral-small-2603',
  'qwen/qwen3-vl-30b-a3b-instruct', 'qwen/qwen3.8-flash', 'openai/gpt-5-nano',
];

async function get(path: string) {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return (await r.json()).data as any[];
}

const [zdr, models] = await Promise.all([get('/endpoints/zdr'), get('/models')]);
const byId = new Map(models.map((m) => [m.id, m]));
const per1M = (v: unknown) => (v == null ? null : Number(v) * 1e6);

const best = new Map<string, any>();
const reasons: Record<string, string[]> = {};
for (const e of zdr) {
  const m = byId.get(e.model_id);
  const why = (s: string) => (reasons[e.model_id] ??= []).push(`${e.provider_name}: ${s}`);
  if (!m) continue;
  if (!(m.architecture?.input_modalities ?? []).includes('image')) { why('no image input'); continue; }
  if (e.model_id.includes(':batch') || e.model_id.endsWith(':free')) { why('batch/free variant'); continue; }
  if (e.model_id.startsWith('google/') || e.provider_name === 'Google') { why('Google'); continue; }
  if (e.safety_retention) { why('safety_retention'); continue; }
  const sp: string[] = e.supported_parameters ?? [];
  if (!sp.includes('structured_outputs') || !sp.includes('tools')) { why('no structured_outputs/tools'); continue; }
  if (e.status !== 0) { why(`status ${e.status}`); continue; }
  const cur = best.get(e.model_id);
  const price = Number(e.pricing.prompt) + Number(e.pricing.completion);
  if (!cur || price < cur.price) best.set(e.model_id, { e, price });
}

const rows = [...best.values()].map(({ e }) => {
  const m = byId.get(e.model_id);
  const providers = zdr.filter((x) => x.model_id === e.model_id && !x.safety_retention && x.status === 0 && (x.supported_parameters ?? []).includes('structured_outputs')).map((x) => x.tag);
  const sp: string[] = e.supported_parameters ?? [];
  return {
    id: e.model_id,
    cheapestZdrEndpoint: e.tag,
    provider: e.provider_name,
    allZdrEndpoints: providers,
    promptPer1M: per1M(e.pricing.prompt),
    completionPer1M: per1M(e.pricing.completion),
    imagePerImage: e.pricing.image ?? m.pricing?.image ?? null,
    context: e.context_length,
    maxCompletion: e.max_completion_tokens,
    reasoningSupported: sp.includes('reasoning'),
    // The API only says whether reasoning is supported, not whether it can be turned off: measure it
    // (reasoning_tokens with reasoning.effort set low) in the live run.
    reasoningMandatory: 'unknown',
    uptime1d: e.uptime_last_1d,
  };
}).sort((a, b) => a.promptPer1M! + a.completionPer1M! - (b.promptPer1M! + b.completionPer1M!));

const planStatus = PLAN_CANDIDATES.map((id) => ({
  id,
  inModelsList: byId.has(id),
  eligible: best.has(id),
  whyNot: best.has(id) ? null : (reasons[id] ?? [byId.has(id) ? 'no ZDR endpoint listed' : 'not in /models']),
}));

mkdirSync('results', { recursive: true });
const out = { fetchedAt: new Date().toISOString(), eligibleModelCount: rows.length, top12: rows.slice(0, 12), all: rows, planCandidates: planStatus };
writeFileSync(process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'results/shortlist.json', JSON.stringify(out, null, 2));
writeFileSync('fixtures/models.snapshot.json', JSON.stringify({ fetchedAt: out.fetchedAt, models: rows }, null, 1));
console.log(`eligible models: ${rows.length}`);
for (const r of rows.slice(0, 12)) console.log(`${r.id}\t${r.cheapestZdrEndpoint}\t${r.promptPer1M?.toFixed(3)}/${r.completionPer1M?.toFixed(3)}\tctx ${r.context}\tmax ${r.maxCompletion}`);
console.log(JSON.stringify(planStatus, null, 1));
