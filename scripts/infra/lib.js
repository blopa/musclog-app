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

module.exports = { sanitize, stableStringify, diffByLookupKey, needsExplicitApproval, isEmptyDiff };
