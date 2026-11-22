#!/usr/bin/env node
'use strict';
// RevenueCat: read-only export, drift plan, guarded apply, usage-free report.
//   node scripts/infra/revenuecat.js <export|plan|apply|report> [--json] [--yes] [--allow-pricing]
// Env: REVENUECAT_INFRA_KEY (v2 secret key, NOT the Premium Worker's), REVENUECAT_PROJECT_ID.
// Never creates or edits products, prices or store credentials: those are owned by the stores
// (gplay / App Store Connect) and are exported for reference only. NOT YET RUN against the live
// account (no credential was available when this was written): endpoint shapes follow the v2
// API reference and must be confirmed by the first `export`.
const fs = require('node:fs');
const path = require('node:path');
const { request, getAllRevenueCat } = require('./http');
const {
  sanitize,
  stableStringify,
  diffByLookupKey,
  needsExplicitApproval,
  isEmptyDiff,
} = require('./lib');

const ROOT = path.resolve(path.dirname(process.argv[1]), '..', '..');
const CONFIG_DIR = path.join(ROOT, 'infra', 'revenuecat', 'config');
const SNAPSHOT_DIR = path.join(ROOT, 'infra', 'snapshots', 'revenuecat');
const API = 'https://api.revenuecat.com';
const MANAGED = ['entitlements', 'offerings'];

function env() {
  const key = process.env.REVENUECAT_INFRA_KEY;
  const project = process.env.REVENUECAT_PROJECT_ID;
  if (!key || !project) {
    const err = new Error(
      'Set REVENUECAT_INFRA_KEY and REVENUECAT_PROJECT_ID (see docs/INFRASTRUCTURE.md).'
    );
    err.exitCode = 4;
    throw err;
  }

  return { key, project };
}

async function fetchLive({ key, project }) {
  const base = `/v2/projects/${project}`;
  const get = (p) => getAllRevenueCat(key, `${base}/${p}`);
  const attempt = async (label, fn) => {
    try {
      return await fn();
    } catch (e) {
      return { _unavailable: e.message, _label: label };
    }
  };

  const offerings = await get('offerings');
  const withPackages = [];
  for (const o of offerings) {
    const packages = await attempt('packages', () => get(`offerings/${o.id}/packages`));
    withPackages.push({ ...o, packages });
  }

  const entitlements = await get('entitlements');
  const withProducts = [];
  for (const e of entitlements) {
    withProducts.push({
      ...e,
      products: await attempt('entitlement products', () => get(`entitlements/${e.id}/products`)),
    });
  }

  return {
    apps: await get('apps'),
    products: await get('products'),
    entitlements: withProducts,
    offerings: withPackages,
    webhooks: await attempt('webhooks', () => get('integrations/webhooks')),
  };
}

function readDesired(name) {
  const file = path.join(CONFIG_DIR, `${name}.json`);
  if (!fs.existsSync(file)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(file, 'utf8')).items ?? [];
}

/** Only the fields a desired file may manage; everything else on the live item is ignored. */
function managedView(name, item) {
  const fields =
    name === 'entitlements'
      ? ['lookup_key', 'display_name']
      : ['lookup_key', 'display_name', 'is_current'];
  return Object.fromEntries(fields.filter((f) => item[f] !== undefined).map((f) => [f, item[f]]));
}

function planFrom(live) {
  const plan = {};
  for (const name of MANAGED) {
    plan[name] = diffByLookupKey(
      // Packages are planned separately (planPackages), never as a field diff.
      readDesired(name).map((item) => managedView(name, item)),
      live[name].map((i) => ({ ...managedView(name, i), id: i.id }))
    );
  }

  return plan;
}

/** Packages of desired offerings that the live offering lacks (matched by lookup_key). */
function planPackages(liveOfferings) {
  const missing = [];
  for (const want of readDesired('offerings')) {
    const have = liveOfferings.find((o) => o.lookup_key === want.lookup_key);
    const havePackages = Array.isArray(have?.packages) ? have.packages : [];
    for (const pkg of want.packages ?? []) {
      if (!havePackages.some((p) => p.lookup_key === pkg.lookup_key)) {
        missing.push({ offering: want.lookup_key, ...pkg });
      }
    }
  }

  return missing;
}

async function applyPackages(e, base, liveProducts, offeringIdByKey, missing) {
  for (const pkg of missing) {
    const created = await request(
      API,
      e.key,
      'POST',
      `${base}/offerings/${offeringIdByKey[pkg.offering]}/packages`,
      {
        lookup_key: pkg.lookup_key,
        display_name: pkg.display_name,
      }
    );
    const products = pkg.products.map((storeId) => {
      const found = liveProducts.find((pr) => pr.store_identifier === storeId);
      if (!found) {
        throw new Error(
          `package ${pkg.lookup_key}: no live product with store identifier ${storeId}`
        );
      }

      return { product_id: found.id, eligibility_criteria: 'all' };
    });
    await request(API, e.key, 'POST', `${base}/packages/${created.id}/actions/attach_products`, {
      products,
    });
  }
}

async function cmdExport(args) {
  const live = sanitize(await fetchLive(env()));
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  for (const [name, value] of Object.entries(live)) {
    fs.writeFileSync(path.join(SNAPSHOT_DIR, `${name}.json`), stableStringify(value));
  }

  const summary = Object.fromEntries(
    Object.entries(live).map(([k, v]) => [k, Array.isArray(v) ? v.length : 'unavailable'])
  );
  out(args, { exported_to: path.relative(ROOT, SNAPSHOT_DIR), counts: summary });
}

async function cmdPlan(args) {
  const live = await fetchLive(env());
  const plan = planFrom(live);
  const packages = planPackages(live.offerings);
  const drift = MANAGED.some((n) => !isEmptyDiff(plan[n])) || packages.length > 0;
  out(args, {
    drift,
    plan,
    packages_to_create: packages.map((p) => `${p.offering}/${p.lookup_key}`),
  });
  return drift ? 3 : 0;
}

async function cmdApply(args) {
  const e = env();
  const live = await fetchLive(e);
  const plan = planFrom(live);
  const missingPackages = planPackages(live.offerings);
  const pricing = needsExplicitApproval({ update: MANAGED.flatMap((n) => plan[n].update) });
  if (pricing.length && !args.includes('--allow-pricing')) {
    throw Object.assign(
      new Error(
        `Refusing: pricing-related fields would change (${pricing.join(', ')}). Re-run with --allow-pricing after review.`
      ),
      { exitCode: 2 }
    );
  }

  const pending = missingPackages
    .map((p) => `create package ${p.offering}/${p.lookup_key}`)
    .concat(
      MANAGED.flatMap((n) => [
        ...plan[n].create.map((c) => `create ${n}/${c.lookup_key}`),
        ...plan[n].update.map((u) => `update ${n}/${u.lookup_key}`),
      ])
    );
  if (!args.includes('--yes')) {
    out(args, { dry_run: true, would_apply: pending, hint: 'add --yes to apply' });
    return 0;
  }

  const base = `/v2/projects/${e.project}`;
  const offeringIdByKey = Object.fromEntries(live.offerings.map((o) => [o.lookup_key, o.id]));
  for (const n of MANAGED) {
    for (const c of plan[n].create) {
      const body =
        n === 'offerings' ? { lookup_key: c.lookup_key, display_name: c.display_name } : c;
      const created = await request(API, e.key, 'POST', `${base}/${n}`, body);
      if (n === 'offerings') {
        offeringIdByKey[c.lookup_key] = created.id;
      }
    }

    for (const u of plan[n].update) {
      const body = Object.fromEntries(Object.entries(u.changes).map(([f, v]) => [f, v.to]));
      await request(API, e.key, 'PATCH', `${base}/${n}/${u.id}`, body);
    }
  }

  await applyPackages(e, base, live.products, offeringIdByKey, missingPackages);

  // Only now, with its package attached, may an offering become the current one.
  for (const o of readDesired('offerings').filter((d) => d.is_current)) {
    const liveOffering = live.offerings.find((l) => l.lookup_key === o.lookup_key);
    if (!liveOffering?.is_current) {
      await request(API, e.key, 'PATCH', `${base}/offerings/${offeringIdByKey[o.lookup_key]}`, {
        is_current: true,
      });
    }
  }

  out(args, {
    applied: pending,
    note: 'unmanaged live items were left untouched; nothing was deleted',
  });
  return 0;
}

async function cmdReport(args) {
  const e = env();
  // Aggregates only. /customers is deliberately not read (PII).
  let overview;
  try {
    overview = await request(API, e.key, 'GET', `/v2/projects/${e.project}/metrics/overview`);
  } catch (err) {
    overview = { unavailable: err.message };
  }

  out(args, { overview: sanitize(overview) });
}

function out(args, data) {
  console.log(args.includes('--json') ? JSON.stringify(data) : JSON.stringify(data, null, 2));
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const table = { export: cmdExport, plan: cmdPlan, apply: cmdApply, report: cmdReport };
  if (!table[cmd]) {
    console.error(
      'usage: revenuecat.js <export|plan|apply|report> [--json] [--yes] [--allow-pricing]'
    );
    process.exit(2);
  }

  try {
    process.exit((await table[cmd](args)) ?? 0);
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exit(err.exitCode ?? 1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { planFrom, managedView };
