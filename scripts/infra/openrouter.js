#!/usr/bin/env node
'use strict';
// OpenRouter: read-only export of what the management API shows, plus a spend report.
//   node scripts/infra/openrouter.js <export|report> [--json]
// Env: OPENROUTER_MANAGEMENT_KEY (sk-or-mgmt-..., cannot spend credits; also what the OpenTofu
// provider reads). Never creates, rotates or revokes a key. Resources are MANAGED through
// infra/openrouter (OpenTofu); this script only observes. NOT YET RUN against the live account.
const fs = require('node:fs');
const path = require('node:path');
const { request } = require('./http');
const { sanitize, stableStringify } = require('./lib');

const ROOT = path.resolve(path.dirname(process.argv[1]), '..', '..');
const SNAPSHOT_DIR = path.join(ROOT, 'infra', 'snapshots', 'openrouter');
const API = 'https://openrouter.ai/api/v1';

function key() {
  const k = process.env.OPENROUTER_MANAGEMENT_KEY;
  if (!k) {
    throw Object.assign(
      new Error('Set OPENROUTER_MANAGEMENT_KEY (a management key; see docs/INFRASTRUCTURE.md).'),
      { exitCode: 4 }
    );
  }

  return k;
}

async function tryGet(token, p) {
  try {
    const r = await request(API, token, 'GET', p);
    return r?.data ?? r;
  } catch (e) {
    return { _unavailable: e.message };
  }
}

const ENDPOINTS = {
  credits: '/credits',
  keys: '/keys',
  guardrails: '/guardrails',
  workspaces: '/workspaces',
};

async function cmdExport(args) {
  const token = key();
  const snapshot = {};
  for (const [name, p] of Object.entries(ENDPOINTS)) {
    snapshot[name] = sanitize(await tryGet(token, p));
  }

  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  for (const [name, v] of Object.entries(snapshot)) {
    fs.writeFileSync(path.join(SNAPSHOT_DIR, `${name}.json`), stableStringify(v));
  }

  print(args, {
    exported_to: path.relative(ROOT, SNAPSHOT_DIR),
    unavailable: Object.keys(snapshot).filter((n) => snapshot[n]?._unavailable),
  });
}

async function cmdReport(args) {
  const token = key();
  const credits = await tryGet(token, '/credits');
  const keys = await tryGet(token, '/keys');
  const perKey = Array.isArray(keys)
    ? keys.map((k) => ({
        label: k.label ?? k.name,
        disabled: k.disabled,
        limit: k.limit,
        limit_reset: k.limit_reset,
        usage: k.usage,
        usage_daily: k.usage_daily,
        usage_monthly: k.usage_monthly,
      }))
    : keys;
  const EXPIRY_WARN_DAYS = 60;
  const now = Date.now();
  const expiring = Array.isArray(keys)
    ? keys
        .filter((k) => k.expires_at && !k.disabled)
        .map((k) => ({
          name: k.name,
          days_left: Math.ceil((Date.parse(k.expires_at) - now) / 86_400_000),
        }))
        .filter((k) => k.days_left <= EXPIRY_WARN_DAYS)
    : [];
  print(args, { credits, keys: perKey, expiring_keys: expiring });
}

function print(args, data) {
  console.log(args.includes('--json') ? JSON.stringify(data) : JSON.stringify(data, null, 2));
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const table = { export: cmdExport, report: cmdReport };
  if (!table[cmd]) {
    console.error('usage: openrouter.js <export|report> [--json]');
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
