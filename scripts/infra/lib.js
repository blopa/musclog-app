'use strict';
// Pure helpers for the RevenueCat / OpenRouter infrastructure tooling (docs/INFRASTRUCTURE.md).
// No network, no filesystem: everything here is unit tested.

const SECRET_KEY_PATTERN =
  /(secret|token|password|api[_-]?key|private|credential|authorization|signing|service[_-]?account|hash$)/i;
const SECRET_VALUE_PATTERN =
  /(sk-or-[A-Za-z0-9_-]+|sk_[A-Za-z0-9]{16,}|goog_[A-Za-z0-9]{16,}|appl_[A-Za-z0-9]{16,}|-----BEGIN [A-Z ]+-----)/g;
// Fields that identify a person; they are dropped from every snapshot and report.
const PII_KEY_PATTERN =
  /(email|name_of_person|customer_id|app_user_id|ip_address|creator_user_id)$/i;

/** Deep copy with secret-looking fields replaced by '<redacted>' and PII fields dropped. */
function sanitize(value, keyName = '') {
  if (Array.isArray(value)) {
    return value.map((v) => sanitize(v, keyName));
  }

  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (PII_KEY_PATTERN.test(k)) {
        continue;
      }

      out[k] =
        SECRET_KEY_PATTERN.test(k) && v != null && typeof v !== 'boolean'
          ? '<redacted>'
          : sanitize(v, k);
    }

    return out;
  }

  if (typeof value === 'string') {
    return value.replace(SECRET_VALUE_PATTERN, '<redacted>');
  }

  return value;
}

/** Stable JSON: sorted keys, so two exports of the same state are byte-identical. */
function stableStringify(value) {
  const sort = (v) => {
    if (Array.isArray(v)) {
      return v.map(sort);
    }

    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .map((k) => [k, sort(v[k])])
      );
    }

    return v;
  };

  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

/**
 * Diffs desired items against live items by `lookup_key`, comparing only the fields the
 * desired item names (an unnamed field is not managed). Never produces a delete: an item
 * that exists live but not in the desired file is reported as `unmanaged`.
 */
function diffByLookupKey(desired, live, keyField = 'lookup_key') {
  const liveByKey = new Map(live.map((i) => [i[keyField], i]));
  const desiredKeys = new Set(desired.map((i) => i[keyField]));
  const create = [];
  const update = [];
  const same = [];
  for (const want of desired) {
    const have = liveByKey.get(want[keyField]);
    if (!have) {
      create.push(want);
      continue;
    }

    const changes = {};
    for (const [field, value] of Object.entries(want)) {
      if (field === keyField) {
        continue;
      }

      if (stableStringify(value) !== stableStringify(have[field])) {
        changes[field] = { from: have[field] ?? null, to: value };
      }
    }

    if (Object.keys(changes).length) {
      update.push({ [keyField]: want[keyField], id: have.id, changes });
    } else {
      same.push(want[keyField]);
    }
  }

  const unmanaged = live.filter((i) => !desiredKeys.has(i[keyField])).map((i) => i[keyField]);
  return { create, update, same, unmanaged };
}

/** Fields whose change needs --allow-pricing / --allow-destructive style approval. */
const PRICE_FIELD_PATTERN = /(price|amount|currency|period|duration|trial)/i;

function needsExplicitApproval(change) {
  const touched = [];
  for (const u of change.update) {
    for (const f of Object.keys(u.changes)) {
      if (PRICE_FIELD_PATTERN.test(f)) {
        touched.push(`${u[Object.keys(u)[0]]}.${f}`);
      }
    }
  }

  return touched;
}

function isEmptyDiff(d) {
  return d.create.length === 0 && d.update.length === 0;
}

/** Creates an Error with an attached process exit code. */
function cliError(message, exitCode = 1) {
  return Object.assign(new Error(message), { exitCode });
}

/** Ensures a required environment variable value is present or throws a config error (exit code 4). */
function requireEnv(value, name, help) {
  if (!value) {
    throw cliError(help || `Set ${name}.`, 4);
  }

  return value;
}

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

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatNumber(value, digits = 2) {
  return value == null ? 'n/a' : Number(value).toFixed(digits);
}

function isUnavailable(value) {
  return value == null || typeof value !== 'object' || '_unavailable' in value;
}

/** Wraps an async API call, turning failures into `{ _unavailable: message }`. */
async function tryRequest(fn) {
  try {
    return await fn();
  } catch (e) {
    return { _unavailable: e.message };
  }
}

function formatJson(data, compact = false) {
  return compact ? JSON.stringify(data) : JSON.stringify(data, null, 2);
}

function printJson(data, compact = false) {
  console.log(formatJson(data, compact));
}

/** Dispatches `<cmd> [args...]` to `commands[cmd]`, exiting cleanly with usage or error codes. */
async function runCli(commands, usage, argv = process.argv.slice(2)) {
  const [cmd, ...args] = argv;
  if (!commands[cmd]) {
    console.error(usage);
    process.exit(2);
    return undefined;
  }

  try {
    return await commands[cmd](args);
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exit(e.exitCode ?? 1);
    return undefined;
  }
}

module.exports = {
  sanitize,
  stableStringify,
  diffByLookupKey,
  needsExplicitApproval,
  isEmptyDiff,
  cliError,
  requireEnv,
  buildQuery,
  numberOrNull,
  formatNumber,
  isUnavailable,
  tryRequest,
  formatJson,
  printJson,
  runCli,
};
