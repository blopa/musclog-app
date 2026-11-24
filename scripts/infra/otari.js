#!/usr/bin/env node
'use strict';
// Otari (the gateway Iron's requests run through): read-only export and spend report for the
// key in OTARI_USAGE_KEY, the only key the hosted API lets us read usage with (usage:read scope).
//   node scripts/infra/otari.js <export|report> [--json] [--days N] [--env staging|production]
// Env: OTARI_USAGE_KEY (usage:read; never printed or written), OTARI_EXPECTED_PROVIDERS
// (optional, comma-separated: any other provider in the usage is flagged). Read-only: nothing is
// created, rotated or deleted. Hosted otari.ai has no admin API for tenants, so this observes one key.
const fs = require('node:fs');
const path = require('node:path');
const { request } = require('./http');
const { sanitize, stableStringify } = require('./lib');

const ROOT = path.resolve(path.dirname(process.argv[1]), '..', '..');
const SNAPSHOT_DIR = path.join(ROOT, 'infra', 'snapshots', 'otari');
const API = 'https://eu.api.otari.ai/api/v1';
const FEATURES = ['chat', 'structured', 'vision'];
const ENVS = ['staging', 'production'];
const DEFAULT_DAYS = 30;
const LOW_BUDGET_USD = 2;
const DAY_MS = 86_400_000;

/** Query string from a params object: arrays become repeated keys, null/undefined are dropped. */
function buildQuery(params) {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value == null) {
      continue;
    }

    for (const item of Array.isArray(value) ? value : [value]) {
      search.append(name, String(item));
    }
  }

  const text = search.toString();
  return text ? `?${text}` : '';
}

/** Path of one usage summary. `tags` are request-metadata filters (`env:…`, `feature:…`). */
function summaryPath({ start, end, bucket = 'day', dimensions = [], tags = [] }) {
  return `/key/usage/summary${buildQuery({
    start_date: start,
    end_date: end,
    bucket,
    dimensions,
    tag: tags.length ? tags : null,
  })}`;
}

/** The last `days` days ending at `now`, as ISO timestamps. */
function windowFor(days, now = Date.now()) {
  return {
    start: new Date(now - days * DAY_MS).toISOString(),
    end: new Date(now).toISOString(),
  };
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isUnavailable(value) {
  return value == null || typeof value !== 'object' || '_unavailable' in value;
}

/** Turns one `by_*` row into `{ name, cost_usd, requests, tokens }`, degrading missing fields to null. */
function groupRow(row) {
  const r = row && typeof row === 'object' ? row : {};
  return {
    name: r.label ?? r.key ?? null,
    cost_usd: numberOrNull(r.cost),
    requests: numberOrNull(r.requests),
    tokens: numberOrNull(r.tokens),
  };
}

function groupRows(list) {
  return Array.isArray(list) ? list.map(groupRow) : [];
}

function totalsOf(summary) {
  const t = summary?.totals && typeof summary.totals === 'object' ? summary.totals : {};
  const requests = numberOrNull(t.request_count);
  const errors = numberOrNull(t.error_count);
  return {
    cost_usd: numberOrNull(t.cost),
    requests,
    errors,
    error_rate: requests && errors != null ? errors / requests : null,
    unpriced_requests: numberOrNull(t.unpriced_requests),
    avg_latency_ms: numberOrNull(t.avg_latency_ms),
    prompt_tokens: numberOrNull(t.prompt_tokens),
    completion_tokens: numberOrNull(t.completion_tokens),
    total_tokens: numberOrNull(t.total_tokens),
  };
}

function errorRows(summary) {
  const list = Array.isArray(summary?.errors_by_status_code) ? summary.errors_by_status_code : [];
  return list.map((row) => ({
    status_code: row?.status_code ?? null,
    error_class: row?.error_class ?? null,
    requests: numberOrNull(row?.requests),
  }));
}

/**
 * Pure: API answers in, report object out. `features` maps feature name -> summary (or an
 * unavailable marker). Anything missing becomes null rather than throwing.
 */
function buildReport({
  budget,
  summary,
  features = {},
  days,
  env = null,
  expectedProviders = null,
}) {
  const warnings = [];
  const unavailable = [];
  const budgetOk = !isUnavailable(budget);
  const summaryOk = !isUnavailable(summary);
  if (!budgetOk) {
    unavailable.push('budget');
  }

  if (!summaryOk) {
    unavailable.push('summary');
  }

  const totals = totalsOf(summaryOk ? summary : null);
  const byProvider = groupRows(summaryOk ? summary.by_provider : null);
  const budgetView = budgetOk
    ? {
        budgets_enforced:
          typeof budget.budgets_enforced === 'boolean' ? budget.budgets_enforced : null,
        remaining_usd: numberOrNull(budget.remaining_usd),
      }
    : null;

  if (totals.unpriced_requests > 0) {
    warnings.push(`${totals.unpriced_requests} request(s) had no price (unpriced_requests)`);
  }

  if (budgetView && budgetView.budgets_enforced === false) {
    warnings.push('budgets are not enforced on this key');
  }

  if (budgetView && budgetView.remaining_usd != null && budgetView.remaining_usd < LOW_BUDGET_USD) {
    warnings.push(`remaining budget is ${budgetView.remaining_usd} USD (under ${LOW_BUDGET_USD})`);
  }

  if (expectedProviders && summaryOk) {
    const expected = new Set(expectedProviders);
    for (const row of byProvider) {
      if (row.name != null && !expected.has(row.name)) {
        warnings.push(`unexpected provider in usage: ${row.name}`);
      }
    }
  }

  const byFeature = FEATURES.map((feature) => {
    const found = features[feature];
    if (isUnavailable(found)) {
      unavailable.push(`feature:${feature}`);
    }

    const t = totalsOf(isUnavailable(found) ? null : found);
    return { feature, cost_usd: t.cost_usd, requests: t.requests };
  });

  return {
    window: { start: summary?.start_date ?? null, end: summary?.end_date ?? null, days, env },
    totals,
    by_model: summaryOk ? groupRows(summary.by_model) : [],
    by_provider: byProvider,
    errors_by_status_code: summaryOk ? errorRows(summary) : [],
    budget: budgetView,
    by_feature: byFeature,
    warnings,
    unavailable,
  };
}

function fmt(value, digits = 2) {
  return value == null ? 'n/a' : Number(value).toFixed(digits);
}

function formatText(report) {
  const t = report.totals;
  const lines = [
    `Otari usage, last ${report.window.days} day(s)${report.window.env ? `, env:${report.window.env}` : ''}`,
    `  cost        ${fmt(t.cost_usd, 4)} USD`,
    `  requests    ${fmt(t.requests, 0)}   errors ${fmt(t.errors, 0)}   error rate ${
      t.error_rate == null ? 'n/a' : `${(t.error_rate * 100).toFixed(2)}%`
    }`,
    `  unpriced    ${fmt(t.unpriced_requests, 0)}   avg latency ${fmt(t.avg_latency_ms, 0)} ms`,
    `  tokens      ${fmt(t.prompt_tokens, 0)} in / ${fmt(t.completion_tokens, 0)} out`,
  ];
  if (report.budget) {
    lines.push(
      `  budget      enforced: ${report.budget.budgets_enforced}, remaining: ${fmt(report.budget.remaining_usd)} USD`
    );
  }

  const section = (title, rows) => {
    lines.push('', title);
    for (const r of rows) {
      lines.push(
        `  ${String(r.name ?? r.status_code ?? r.feature).padEnd(32)} ${fmt(r.cost_usd, 4).padStart(12)} USD  ${fmt(r.requests, 0).padStart(8)} req`
      );
    }
  };

  section('By model', report.by_model);
  section('By provider', report.by_provider);
  section('By feature', report.by_feature);
  lines.push('', 'Errors by status code');
  for (const e of report.errors_by_status_code) {
    lines.push(`  ${String(e.status_code).padEnd(10)} ${fmt(e.requests, 0)}`);
  }

  for (const w of report.warnings) {
    lines.push(`WARN ${w}`);
  }

  for (const u of report.unavailable) {
    lines.push(`unavailable: ${u}`);
  }

  return lines.join('\n');
}

function parseArgs(args) {
  const opts = { json: false, days: DEFAULT_DAYS, env: null };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--days') {
      const n = Number(args[i + 1]);
      if (!Number.isInteger(n) || n < 1 || n > 366) {
        throw Object.assign(new Error('--days takes a whole number from 1 to 366'), {
          exitCode: 2,
        });
      }

      opts.days = n;
      i += 1;
    } else if (arg === '--env') {
      if (!ENVS.includes(args[i + 1])) {
        throw Object.assign(new Error(`--env takes ${ENVS.join(' or ')}`), { exitCode: 2 });
      }

      opts.env = args[i + 1];
      i += 1;
    } else {
      throw Object.assign(new Error(`unknown argument: ${arg}`), { exitCode: 2 });
    }
  }

  return opts;
}

function expectedProvidersFromEnv() {
  const raw = process.env.OTARI_EXPECTED_PROVIDERS;
  if (!raw) {
    return null;
  }

  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function key() {
  const k = process.env.OTARI_USAGE_KEY;
  if (!k) {
    throw Object.assign(
      new Error(
        'Set OTARI_USAGE_KEY (a key with the usage:read scope; see docs/INFRASTRUCTURE.md).'
      ),
      { exitCode: 4 }
    );
  }

  return k;
}

async function tryGet(token, p) {
  try {
    return await request(API, token, 'GET', p);
  } catch (e) {
    return { _unavailable: e.message };
  }
}

function envTags(env) {
  return env ? [`env:${env}`] : [];
}

async function fetchAll(token, opts) {
  const { start, end } = windowFor(opts.days);
  const window = { start, end };
  const budget = await tryGet(token, '/key/budget');
  const summary = await tryGet(
    token,
    summaryPath({
      ...window,
      dimensions: ['model', 'provider', 'status_code'],
      tags: envTags(opts.env),
    })
  );
  const features = {};
  for (const feature of FEATURES) {
    features[feature] = await tryGet(
      token,
      summaryPath({ ...window, tags: [`feature:${feature}`, ...envTags(opts.env)] })
    );
  }

  return { budget, summary, features };
}

async function cmdExport(args) {
  const opts = parseArgs(args);
  const token = key();
  const { budget, summary } = await fetchAll(token, opts);
  const snapshot = {
    budget: sanitize(budget),
    summary_30d: sanitize(summary),
  };
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  for (const [name, value] of Object.entries(snapshot)) {
    fs.writeFileSync(path.join(SNAPSHOT_DIR, `${name}.json`), stableStringify(value));
  }

  print(args, {
    exported_to: path.relative(ROOT, SNAPSHOT_DIR),
    unavailable: Object.keys(snapshot).filter((n) => snapshot[n]?._unavailable),
  });
}

async function cmdReport(args) {
  const opts = parseArgs(args);
  const token = key();
  const data = await fetchAll(token, opts);
  const report = buildReport({
    ...data,
    days: opts.days,
    env: opts.env,
    expectedProviders: expectedProvidersFromEnv(),
  });
  if (args.includes('--json')) {
    console.log(JSON.stringify(report));
  } else {
    console.log(formatText(report));
  }
}

function print(args, data) {
  console.log(args.includes('--json') ? JSON.stringify(data) : JSON.stringify(data, null, 2));
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const table = { export: cmdExport, report: cmdReport };
  if (!table[cmd]) {
    console.error('usage: otari.js <export|report> [--json] [--days N] [--env staging|production]');
    process.exit(2);
  }

  try {
    await table[cmd](args);
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exit(e.exitCode ?? 1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  API,
  FEATURES,
  buildQuery,
  summaryPath,
  windowFor,
  buildReport,
  formatText,
  parseArgs,
  expectedProvidersFromEnv,
};
