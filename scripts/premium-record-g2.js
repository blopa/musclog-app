#!/usr/bin/env node
// Read-only recorder for the RevenueCat sandbox matrix (G2/G9), see
// spikes/premium-p0/revenuecat/REPORT.md. Only GET requests are made. The v2 secret key comes
// from the environment only and is never printed or written. Field names and pagination mirror
// services/premium-worker/src/upstream/revenuecat.ts (a separate package, not imported).
// RevenueCat v2 timestamps are epoch milliseconds (the Worker compares them with Date.now()).
'use strict';

const BASE_URL = 'https://api.revenuecat.com/v2';
const MAX_PAGES = 20;
const RC_ID = /^mlg1_[0-9a-f]{64}$/;
const KEY_ENV = 'REVENUECAT_V2_SECRET_KEY';
const PROJECT_ENV = 'REVENUECAT_PROJECT_ID';

class RecorderError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = 'RecorderError';
    this.exitCode = exitCode;
  }
}

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v !== '' ? v : null);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const iso = (ms) => (num(ms) === null ? null : new Date(ms).toISOString());

const USAGE =
  'Usage: node scripts/premium-record-g2.js <rc_id> [--search <store_subscription_identifier>] ' +
  '[--project <id>] [--json] [--any-id]';

function parseArgs(argv) {
  const out = { rcId: null, search: null, project: null, json: false, anyId: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') {
      out.json = true;
    } else if (a === '--any-id') {
      out.anyId = true;
    } else if (a === '--search' || a === '--project') {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) {
        throw new RecorderError(`${a} needs a value`, 2);
      }

      out[a === '--search' ? 'search' : 'project'] = v;
    } else if (a.startsWith('--')) {
      throw new RecorderError(`Unknown option ${a}\n${USAGE}`, 2);
    } else if (out.rcId === null) {
      out.rcId = a;
    } else {
      throw new RecorderError(`Unexpected argument ${a}\n${USAGE}`, 2);
    }
  }

  if (!out.rcId) {
    throw new RecorderError(`Missing <rc_id>\n${USAGE}`, 2);
  }

  return out;
}

function failForStatus(res, what) {
  const status = res.status;
  if (status === 401 || status === 403) {
    throw new RecorderError(
      `${what}: HTTP ${status}. The key is rejected or lacks a read permission ` +
        '(customer_information:customers:read, customer_information:subscriptions:read).'
    );
  }

  const retry = res.headers && res.headers.get ? res.headers.get('retry-after') : null;
  const extra = retry ? ` retry-after: ${retry}` : '';
  throw new RecorderError(`${what}: HTTP ${status}.${extra}`);
}

/** One GET. Returns parsed JSON, or null on 404. */
async function getJson(fetchImpl, url, key, what) {
  const res = await fetchImpl(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
  });
  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    failForStatus(res, what);
  }

  try {
    return await res.json();
  } catch {
    throw new RecorderError(`${what}: response was not JSON (HTTP ${res.status}).`);
  }
}

/** Follows next_page (same origin only, capped). Returns null when the first page is a 404. */
async function fetchAllPages(fetchImpl, firstUrl, key, what = 'request') {
  const origin = new URL(BASE_URL).origin;
  const items = [];
  let url = firstUrl;
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await getJson(fetchImpl, url, key, what);
    if (body === null) {
      if (page === 0) {
        return null;
      }

      throw new RecorderError(`${what}: a later page returned 404.`);
    }

    if (!isObj(body) || !Array.isArray(body.items)) {
      throw new RecorderError(`${what}: unexpected response shape (no items).`);
    }

    items.push(...body.items);
    const next = str(body.next_page);
    if (!next) {
      return items;
    }

    let nextUrl;
    if (/^[a-z][a-z0-9+.-]*:/i.test(next) || next.startsWith('//')) {
      if (new URL(next, origin).origin !== origin) {
        throw new RecorderError(`${what}: next_page points at another origin; refused.`);
      }

      nextUrl = new URL(next, origin).toString();
    } else {
      nextUrl = `${origin}${next.startsWith('/') ? '' : '/'}${next}`;
    }

    url = nextUrl;
  }

  throw new RecorderError(`${what}: more than ${MAX_PAGES} pages; stopped.`);
}

function projectBase(project) {
  return `${BASE_URL}/projects/${encodeURIComponent(project)}`;
}

function parseSubscription(v) {
  if (!isObj(v)) {
    return null;
  }

  const s = {
    id: str(v.id),
    customer_id: str(v.customer_id),
    original_customer_id: str(v.original_customer_id),
    store: str(v.store),
    environment: str(v.environment),
    ownership: str(v.ownership),
    status: str(v.status),
    gives_access: typeof v.gives_access === 'boolean' ? v.gives_access : null,
    product_id: str(v.product_id),
    store_subscription_identifier: str(v.store_subscription_identifier),
    starts_at: iso(v.starts_at),
    current_period_starts_at: iso(v.current_period_starts_at),
    current_period_ends_at: iso(v.current_period_ends_at),
  };
  return s.id ? s : null;
}

function parseRevenue(v) {
  if (!isObj(v)) {
    return null;
  }

  return {
    gross: num(v.gross),
    commission: num(v.commission),
    tax: num(v.tax),
    proceeds: num(v.proceeds),
  };
}

function parseTransaction(v, nowMs) {
  if (!isObj(v)) {
    return null;
  }

  const rev = parseRevenue(v.revenue_in_usd);
  const purchased = num(v.purchased_at);
  return {
    id: str(v.id),
    purchased_at: iso(purchased),
    expiration_date: iso(v.expiration_date),
    effective_expiration_date: iso(v.effective_expiration_date),
    revenue_in_usd: rev,
    proceeds_present: rev !== null && rev.proceeds !== null,
    age_seconds: purchased === null ? null : Math.round((nowMs - purchased) / 1000),
  };
}

function parseEntitlements(customer) {
  if (!isObj(customer)) {
    return [];
  }

  const ae = customer.active_entitlements;
  let list = [];
  if (Array.isArray(ae)) {
    list = ae;
  } else if (isObj(ae) && Array.isArray(ae.items)) {
    list = ae.items;
  }

  return list.filter(isObj).map((e) => ({
    entitlement_id: str(e.entitlement_id) ?? str(e.id),
    expires_at: iso(e.expires_at),
  }));
}

/**
 * Pure. responses: { customer, subscriptions: [], transactions: { [subId]: [] }, search? }
 * (customer null = not found; search undefined = not requested).
 */
function buildRecord(responses, now) {
  const nowMs = now instanceof Date ? now.getTime() : now;
  const r = responses || {};
  const customer = isObj(r.customer) ? r.customer : null;
  const txMap = isObj(r.transactions) ? r.transactions : {};
  const subs = (Array.isArray(r.subscriptions) ? r.subscriptions : [])
    .map(parseSubscription)
    .filter(Boolean)
    .map((s) => ({
      ...s,
      transactions: (Array.isArray(txMap[s.id]) ? txMap[s.id] : [])
        .map((t) => parseTransaction(t, nowMs))
        .filter(Boolean),
    }));
  return {
    captured_at: new Date(nowMs).toISOString(),
    customer_found: customer !== null,
    customer_id: customer ? str(customer.id) : null,
    active_entitlements: parseEntitlements(customer),
    subscriptions: subs,
    search:
      r.search === undefined
        ? null
        : (Array.isArray(r.search) ? r.search : []).map(parseSubscription).filter(Boolean),
  };
}

const show = (v) => (v === null || v === undefined ? 'null' : String(v));

function formatRecord(rec, queriedId) {
  const L = [];
  L.push(`captured_at: ${rec.captured_at}`);
  if (!rec.customer_found) {
    L.push(`customer not found: ${queriedId}`);
  } else {
    L.push(`customer_id: ${show(rec.customer_id)}`);
    L.push(
      `active entitlements: ${
        rec.active_entitlements.length
          ? rec.active_entitlements
              .map((e) => `${show(e.entitlement_id)} (expires ${show(e.expires_at)})`)
              .join(', ')
          : 'none'
      }`
    );
  }

  for (const s of rec.subscriptions) {
    L.push('');
    L.push(`subscription ${s.id}`);
    for (const k of [
      'customer_id',
      'original_customer_id',
      'store',
      'environment',
      'ownership',
      'status',
      'gives_access',
      'product_id',
      'store_subscription_identifier',
      'starts_at',
      'current_period_starts_at',
      'current_period_ends_at',
    ]) {
      L.push(`  ${k}: ${show(s[k])}`);
    }

    for (const t of s.transactions) {
      const rv = t.revenue_in_usd;
      L.push(`  transaction ${show(t.id)}`);
      L.push(`    purchased_at: ${show(t.purchased_at)} (age ${show(t.age_seconds)} s)`);
      L.push(`    expiration_date: ${show(t.expiration_date)}`);
      L.push(`    effective_expiration_date: ${show(t.effective_expiration_date)}`);
      L.push(
        `    revenue_in_usd: gross ${show(rv && rv.gross)}, commission ${show(
          rv && rv.commission
        )}, tax ${show(rv && rv.tax)}, proceeds ${show(rv && rv.proceeds)}`
      );
      L.push(
        `    G9 proceeds present: ${
          t.proceeds_present ? 'yes' : 'no'
        } (null revenue_in_usd or null proceeds), age ${show(t.age_seconds)} s`
      );
    }
  }

  if (rec.search !== null) {
    L.push('');
    L.push(`search by store_subscription_identifier: ${rec.search.length} match(es)`);
    for (const s of rec.search) {
      L.push(
        `  ${s.id}: customer_id ${show(s.customer_id)} (current owner), original_customer_id ${show(
          s.original_customer_id
        )}, gives_access ${show(s.gives_access)}`
      );
    }
  }

  return L.join('\n');
}

async function main(argv, env, fetchImpl, stdout, stderr) {
  const out = stdout || process.stdout;
  const err = stderr || process.stderr;
  try {
    const args = parseArgs(argv);
    const key = env[KEY_ENV];
    if (!key) {
      throw new RecorderError(`${KEY_ENV} is not set.`, 2);
    }

    const project = args.project || env[PROJECT_ENV];
    if (!project) {
      throw new RecorderError(`Project id missing: pass --project or set ${PROJECT_ENV}.`, 2);
    }

    if (!args.anyId && !RC_ID.test(args.rcId)) {
      throw new RecorderError('rc_id must match mlg1_<64 hex> (use --any-id to override).', 2);
    }

    const base = projectBase(project);
    const cid = encodeURIComponent(args.rcId);

    const customer = await getJson(fetchImpl, `${base}/customers/${cid}`, key, 'customer');
    let subscriptions = [];
    const transactions = {};
    if (customer !== null) {
      subscriptions =
        (await fetchAllPages(
          fetchImpl,
          `${base}/customers/${cid}/subscriptions`,
          key,
          'subscriptions'
        )) || [];
      for (const s of subscriptions) {
        const id = isObj(s) ? str(s.id) : null;
        if (!id) {
          continue;
        }

        transactions[id] =
          (await fetchAllPages(
            fetchImpl,
            `${base}/subscriptions/${encodeURIComponent(id)}/transactions`,
            key,
            `transactions of ${id}`
          )) || [];
      }
    }

    let search;
    if (args.search !== null) {
      search =
        (await fetchAllPages(
          fetchImpl,
          `${base}/subscriptions?store_subscription_identifier=${encodeURIComponent(args.search)}`,
          key,
          'subscription search'
        )) || [];
    }

    const rec = buildRecord({ customer, subscriptions, transactions, search }, Date.now());
    out.write(
      args.json ? `${JSON.stringify(rec, null, 2)}\n` : `${formatRecord(rec, args.rcId)}\n`
    );
    return 0;
  } catch (e) {
    if (e instanceof RecorderError) {
      err.write(`error: ${e.message}\n`);
      return e.exitCode;
    }

    err.write('error: request failed (network or unexpected failure).\n');
    return 1;
  }
}

module.exports = {
  main,
  buildRecord,
  parseArgs,
  fetchAllPages,
  formatRecord,
  RecorderError,
  BASE_URL,
  MAX_PAGES,
};

if (require.main === module) {
  main(process.argv.slice(2), process.env, fetch, process.stdout, process.stderr).then((code) => {
    process.exitCode = code;
  });
}
