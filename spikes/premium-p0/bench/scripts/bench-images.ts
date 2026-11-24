// Image benchmark (gate G6): long edge x JPEG quality per model, error vs gold and vs the full-resolution run.
//   dry-run (default, offline, mock):  tsx scripts/bench-images.ts
//   live (spends money):               OPENROUTER_API_KEY=... tsx scripts/bench-images.ts --live --max-usd 3
//   Otari gateway (pinned selectors):  OTARI_API_KEY=... tsx scripts/bench-images.ts --live --gateway otari --max-usd 3 \
//                                        --models deepinfra:alibaba/qwen3-vl-30b-a3b-instruct,deepinfra:nvidia/nemotron-3.5-super-vl-120b-a12b
// Options: --models id,id  --gateway openrouter|otari (default openrouter)  --manifest data/manifest.json
//          --edges 512,768,1024,1280,1568  --qualities 60,75,85
//          --photos N (use the first N manifest rows)  --out results/images
// Manifest rows: { image: path relative to data/, kcal, protein, carbs, fat, kind: plated|packaged|label|restaurant|mixed, grams? }
// Otari: a call served by another provider than the selector's prefix, or one the gateway marked as a fallback, counts as an error.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import {
  Budget,
  DEFAULT_MODELS,
  DEFAULT_OTARI_IMAGE_MODELS,
  ROOT,
  checkedChat,
  costOf,
  fmt,
  gatewayExtras,
  makeTransport,
  mean,
  parseArgs,
  percentile,
  pickModels,
  resolveMode,
  type ModelInfo,
} from './lib/core.ts';
import * as F from '../fixtures/schemas.ts';

type Row = {
  image: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  kind: string;
  grams?: number;
};
type Macros = { kcal: number; protein: number; carbs: number; fat: number };
type Setting = { edge: number | 'full'; quality: number | 'orig' };
type Rec = {
  model: string;
  photo: string;
  kind: string;
  setting: string;
  edge: number | 'full';
  quality: number | 'orig';
  bytes: number;
  width: number;
  height: number;
  pred: Macros | null;
  error?: string;
  prompt: number;
  imageTokens: number | null;
  cost: number;
  latencyMs: number;
};

const settingKey = (s: Setting) => (s.edge === 'full' ? 'full' : `${s.edge}@q${s.quality}`);

async function makeSyntheticSet(dir: string): Promise<Row[]> {
  mkdirSync(dir, { recursive: true });
  const rows: Row[] = [];
  const specs: [string, Macros, Row['kind']][] = [
    ['plate-a', { kcal: 620, protein: 38, carbs: 55, fat: 26 }, 'plated'],
    ['pack-b', { kcal: 250, protein: 8, carbs: 30, fat: 11 }, 'packaged'],
    ['label-c', { kcal: 180, protein: 5, carbs: 24, fat: 7 }, 'label'],
  ];
  for (const [name, m, kind] of specs) {
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1500"><rect width="2000" height="1500" fill="#c9c2b6"/><circle cx="1000" cy="750" r="600" fill="#f2f2ee"/><circle cx="800" cy="700" r="220" fill="#c98b3c"/><rect x="1100" y="560" width="320" height="380" rx="40" fill="#6b8e3a"/><text x="120" y="160" font-size="90" fill="#222">${name}</text></svg>`
    );
    const rel = `synthetic/${name}.jpg`;
    writeFileSync(join(dir, `${name}.jpg`), await sharp(svg).jpeg({ quality: 90 }).toBuffer());
    rows.push({ image: rel, kind, ...m });
  }
  return rows;
}

async function render(
  abs: string,
  s: Setting
): Promise<{ b64: string; bytes: number; w: number; h: number }> {
  let img = sharp(abs).rotate();
  let buf: Buffer;
  if (s.edge === 'full')
    buf = s.quality === 'orig' ? readFileSync(abs) : await img.jpeg({ quality: 92 }).toBuffer();
  else
    buf = await img
      .resize({ width: s.edge, height: s.edge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: s.quality as number })
      .toBuffer();
  const md = await sharp(buf).metadata();
  return { b64: buf.toString('base64'), bytes: buf.length, w: md.width ?? 0, h: md.height ?? 0 };
}

function macrosOf(content: unknown): Macros | null {
  try {
    const j = JSON.parse(String(content));
    const ing = (j.meals ?? []).flatMap((m: any) => m.ingredients ?? []);
    if (!ing.length) return null;
    const sum = (k: string) => ing.reduce((a: number, i: any) => a + Number(i[k] ?? 0), 0);
    const m = { kcal: sum('kcal'), protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat') };
    return Object.values(m).every(Number.isFinite) ? m : null;
  } catch {
    return null;
  }
}

const pctErr = (p: number, g: number) => (Math.abs(p - g) / Math.max(g, 1)) * 100;
const macroPct = (p: Macros, g: Macros) =>
  mean([pctErr(p.protein, g.protein), pctErr(p.carbs, g.carbs), pctErr(p.fat, g.fat)])!;

export async function main(argv?: string[]) {
  const a = parseArgs(argv);
  const mode = resolveMode(a);
  const models: ModelInfo[] = pickModels(
    a.str('models'),
    mode.gateway,
    mode.gateway === 'otari' ? DEFAULT_OTARI_IMAGE_MODELS : DEFAULT_MODELS
  );
  const edges = (a.str('edges') ?? '512,768,1024,1280,1568').split(',').map(Number);
  const qualities = (a.str('qualities') ?? '60,75,85').split(',').map(Number);
  const dataDir = join(ROOT, 'data');
  let manifestPath = join(ROOT, a.str('manifest') ?? 'data/manifest.json');
  let rows: Row[];
  let sourceNote: string;
  if (existsSync(manifestPath)) {
    rows = JSON.parse(readFileSync(manifestPath, 'utf8'));
    sourceNote = `manifest ${manifestPath.replace(ROOT + '/', '')}`;
  } else {
    rows = await makeSyntheticSet(join(dataDir, 'synthetic'));
    sourceNote = 'synthetic placeholder images (no manifest found)';
  }
  const limit = a.num('photos', rows.length);
  rows = rows.slice(0, limit);

  const settings: Setting[] = [{ edge: 'full', quality: 'orig' }];
  for (const e of edges) for (const q of qualities) settings.push({ edge: e, quality: q });

  const budget = new Budget(mode.maxUsd);
  const t = makeTransport(mode);
  const recs: Rec[] = [];
  const baseline = new Map<string, number>(); // text-only prompt tokens per model (system + schema), to isolate image tokens
  let stopped = false;
  const seen = new Set<string>();

  const call = async (model: ModelInfo, content: any[], meta: any, maxTokens = 1500) => {
    const body: any = {
      model: model.id,
      max_tokens: Math.min(maxTokens, model.maxCompletion),
      ...gatewayExtras(model, mode.gateway),
      messages: [
        { role: 'system', content: F.MEAL_ANALYSIS_PROMPT },
        { role: 'user', content },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'trackMeal',
          strict: true,
          schema: F.makeSchemaStrict(F.TRACK_MEAL_SCHEMA),
        },
      },
    };
    const est = Budget.estimate(
      model,
      3000 + Math.ceil(JSON.stringify(F.TRACK_MEAL_SCHEMA).length / 2),
      body.max_tokens
    );
    if (mode.live && !budget.allows(est)) return null;
    const r = await checkedChat(t, model, body, { stream: false, meta }, mode.gateway);
    budget.record(costOf(r.json?.usage));
    return r;
  };

  outer: for (const model of models) {
    const b = await call(
      model,
      [{ type: 'text', text: F.IMAGE_USER_TEXT }],
      { fixture: 'baseline' },
      50
    );
    if (!b) {
      stopped = true;
      break;
    }
    baseline.set(model.id, b.json?.usage?.prompt_tokens ?? 0);
    for (const row of rows) {
      const abs = join(dataDir, row.image);
      for (const s of settings) {
        const img = await render(abs, s);
        // A setting that does not shrink the original (long edge already <= target) is the same bytes as an earlier one: skip duplicates.
        const dupKey = `${model.id}|${row.image}|${s.edge}|${img.w}x${img.h}|${img.bytes}`;
        if (seen.has(dupKey)) continue;
        seen.add(dupKey);
        const r = await call(
          model,
          [
            { type: 'text', text: F.IMAGE_USER_TEXT },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img.b64}` } },
          ],
          { gold: { ...row, grams: row.grams }, fixture: row.image }
        );
        if (!r) {
          stopped = true;
          break outer;
        }
        const u = r.json?.usage;
        const prompt = u?.prompt_tokens ?? 0;
        recs.push({
          model: model.id,
          photo: row.image,
          kind: row.kind,
          setting: settingKey(s),
          edge: s.edge,
          quality: s.quality,
          bytes: img.bytes,
          width: img.w,
          height: img.h,
          pred:
            r.status === 200 && !r.routeError
              ? macrosOf(r.json?.choices?.[0]?.message?.content)
              : null,
          error: r.routeError ?? (r.status === 200 ? undefined : `HTTP ${r.status}`),
          prompt,
          imageTokens: prompt ? Math.max(0, prompt - (baseline.get(model.id) ?? 0)) : null,
          cost: costOf(u),
          latencyMs: r.latencyMs,
        });
      }
    }
  }

  // ---- analysis --------------------------------------------------------------------------------------------
  const goldOf = new Map(rows.map((r) => [r.image, r]));
  const summary: any[] = [];
  const recommendation: any = {};
  for (const model of models) {
    const mine = recs.filter((r) => r.model === model.id);
    const keys = [...new Set(mine.map((r) => r.setting))];
    const full = new Map(mine.filter((r) => r.setting === 'full').map((r) => [r.photo, r]));
    const perSetting = keys.map((k) => {
      const rs = mine.filter((r) => r.setting === k);
      const scored = rs.filter((r) => r.pred);
      const kcalErr = mean(scored.map((r) => pctErr(r.pred!.kcal, goldOf.get(r.photo)!.kcal)));
      const macroErr = mean(scored.map((r) => macroPct(r.pred!, goldOf.get(r.photo)!)));
      const vsFull = mean(
        scored
          .filter((r) => full.get(r.photo)?.pred)
          .map((r) => pctErr(r.pred!.kcal, full.get(r.photo)!.pred!.kcal))
      );
      const tokens = rs.map((r) => r.imageTokens).filter((x): x is number => x != null);
      return {
        model: model.id,
        setting: k,
        n: rs.length,
        scored: scored.length,
        kcalMapePct: kcalErr,
        macroMapePct: macroErr,
        kcalVsFullPct: vsFull,
        bytesMean: mean(rs.map((r) => r.bytes)),
        imgTokensMax: tokens.length ? Math.max(...tokens) : null,
        imgTokensP95: percentile(tokens, 95),
        latP50s: percentile(
          rs.map((r) => r.latencyMs / 1000),
          50
        ),
        costMean: mean(rs.map((r) => r.cost)),
      };
    });
    summary.push(...perSetting);
    const ref = perSetting.find((p) => p.setting === 'full');
    // Candidates: every setting within 2 points of the full-resolution run on BOTH kcal and macro error; smallest mean bytes wins.
    const ok = perSetting.filter(
      (p) =>
        p.setting !== 'full' &&
        ref &&
        p.kcalMapePct != null &&
        p.macroMapePct != null &&
        p.kcalMapePct <= ref.kcalMapePct! + 2 &&
        p.macroMapePct <= ref.macroMapePct! + 2
    );
    ok.sort((x, y) => (x.bytesMean ?? 0) - (y.bytesMean ?? 0));
    const maxTok = Math.max(0, ...perSetting.map((p) => p.imgTokensMax ?? 0));
    recommendation[model.id] = {
      smallestOkSetting: ok[0]?.setting ?? null,
      okSettings: ok.map((o) => o.setting),
      maxImageTokensObserved: maxTok,
      imageTokensMaxSuggested: Math.ceil(maxTok * 1.25),
    };
  }
  const maxAcross = Math.max(
    0,
    ...Object.values<any>(recommendation).map((r) => r.maxImageTokensObserved)
  );
  const meta = `Mode: ${mode.live ? 'LIVE' : 'DRY-RUN (mock transport, numbers are NOT measurements)'}. Photos: ${rows.length} (${sourceNote}). Settings: full + ${edges.join('/')} x q${qualities.join('/')}. Models: ${models.map((m) => m.id).join(', ')}. Spent: $${budget.spent.toFixed(4)}${mode.live ? ` of $${mode.maxUsd}` : ''}${stopped ? ' (STOPPED early by --max-usd guard)' : ''}.`;

  const md = [
    `# Image benchmark\n\n${meta}\n`,
    'Error = mean absolute percentage error vs gold (kcal; macros = mean of protein/carbs/fat). "vs full" = kcal difference from the full-resolution run. Image tokens = prompt tokens minus a text-only baseline call.\n',
    '| model | setting | n | kcal err % | macro err % | kcal vs full % | KB | img tok max | img tok p95 | p50 s | avg $ |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const p of summary)
    md.push(
      `| ${p.model} | ${p.setting} | ${p.n} | ${fmt(p.kcalMapePct, 1)} | ${fmt(p.macroMapePct, 1)} | ${fmt(p.kcalVsFullPct, 1)} | ${fmt((p.bytesMean ?? 0) / 1024, 0)} | ${p.imgTokensMax ?? 'n/a'} | ${fmt(p.imgTokensP95, 0)} | ${fmt(p.latP50s)} | ${fmt(p.costMean, 5)} |`
    );
  md.push(
    '\n## Recommendation (per model)\n',
    '```json',
    JSON.stringify(recommendation, null, 2),
    '```',
    `\nIMAGE_TOKENS_MAX (max over models and settings x 1.25): **${Math.ceil(maxAcross * 1.25)}**\n`
  );
  const out = a.str('out') ?? join('results', mode.live ? 'images-live' : 'images-dryrun');
  mkdirSync(join(ROOT, dirname(out)), { recursive: true });
  writeFileSync(
    join(ROOT, `${out}.json`),
    JSON.stringify({ meta, summary, recommendation, records: recs.map((r) => ({ ...r })) }, null, 1)
  );
  writeFileSync(join(ROOT, `${out}.md`), md.join('\n'));
  console.log(meta);
  console.log(
    `calls: ${recs.length} -> ${out}.{json,md}; IMAGE_TOKENS_MAX suggestion ${Math.ceil(maxAcross * 1.25)}`
  );
  return { recs, spent: budget.spent };
}

if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((e) => {
    console.error(String(e.message ?? e));
    process.exit(1);
  });
