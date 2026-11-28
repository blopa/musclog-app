/**
 * Batched machine translation of English catalogue copy, shared by the exercise and the foundation
 * food locale generators. Requests are batched while numeric markers keep every field associated
 * with its entry.
 */

const fs = require('fs');
const prettier = require('prettier');

const TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';
const MAX_BATCH_CHARACTERS = 4000;
const REQUEST_CONCURRENCY = 8;
const MARKER_PREFIX = '901731';

/** App locale files, keyed by the language code the translation service takes. */
const LOCALE_SUFFIXES = {
  es: 'EsEs',
  nl: 'NlNl',
  pt: 'PtBr',
  ru: 'RuRu',
  de: 'DeDe',
  fr: 'FrFr',
  it: 'ItIt',
  pl: 'PlPl',
  tr: 'TrTr',
};

function marker(markerIndex, fieldNumber) {
  return `${MARKER_PREFIX}${String(markerIndex).padStart(4, '0')}0${fieldNumber}`;
}

function textForEntry(entry, fields) {
  return fields.flatMap((field, i) => [marker(entry.markerIndex, i + 1), entry[field]]).join('\n');
}

function createBatches(entries, fields) {
  const batches = [];
  let batch = [];
  let characters = 0;

  for (const entry of entries) {
    const entryCharacters = textForEntry(entry, fields).length + 1;
    if (batch.length > 0 && characters + entryCharacters > MAX_BATCH_CHARACTERS) {
      batches.push(batch);
      batch = [];
      characters = 0;
    }

    batch.push(entry);
    characters += entryCharacters;
  }

  if (batch.length > 0) {
    batches.push(batch);
  }

  return batches;
}

async function translatedText(text, target) {
  const body = new URLSearchParams({ client: 'gtx', dt: 't', q: text, sl: 'en', tl: target });
  let lastError;

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(TRANSLATE_URL, {
        body,
        headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        method: 'POST',
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        throw new Error(`translation request failed with HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (!Array.isArray(payload?.[0])) {
        throw new Error('translation response has an unexpected shape');
      }

      return payload[0].map((segment) => segment[0]).join('');
    } catch (error) {
      lastError = error;
      if (attempt < 6) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  throw lastError;
}

function parseBatch(text, entries, fields, idKey) {
  const values = new Map();
  const markerPattern = new RegExp(`${MARKER_PREFIX}(\\d{4})0([1-9])`, 'g');
  const matches = [...text.matchAll(markerPattern)];

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const markerIndex = Number(match[1]);
    const field = fields[Number(match[2]) - 1];
    const start = match.index + match[0].length;
    const end = matches[i + 1]?.index ?? text.length;
    const value = values.get(markerIndex) ?? {};
    value[field] = text.slice(start, end).trim();
    values.set(markerIndex, value);
  }

  return entries.map((entry) => {
    const value = values.get(entry.markerIndex);
    if (fields.some((field) => !value?.[field])) {
      throw new Error(`could not recover translated fields for ${entry[idKey]}`);
    }

    return {
      [idKey]: entry[idKey],
      ...Object.fromEntries(fields.map((field) => [field, value[field]])),
    };
  });
}

async function translateBatch(entries, target, fields, idKey) {
  try {
    const source = entries.map((entry) => textForEntry(entry, fields)).join('\n');
    return parseBatch(await translatedText(source, target), entries, fields, idKey);
  } catch (error) {
    if (entries.length === 1) {
      throw error;
    }

    const middle = Math.ceil(entries.length / 2);
    const halves = await Promise.all([
      translateBatch(entries.slice(0, middle), target, fields, idKey),
      translateBatch(entries.slice(middle), target, fields, idKey),
    ]);

    return halves.flat();
  }
}

/**
 * Every entry with `fields` translated into `target`, in the order given. Each result holds
 * `idKey` (copied from the English entry) and the translated fields, nothing else.
 */
async function translateEntries(source, { target, fields, idKey }) {
  const entries = source.map((entry, index) => ({ ...entry, markerIndex: index + 1 }));
  const batches = createBatches(entries, fields);
  const translated = new Array(batches.length);
  let nextBatch = 0;
  let completed = 0;

  async function worker() {
    while (nextBatch < batches.length) {
      const index = nextBatch;
      nextBatch += 1;
      translated[index] = await translateBatch(batches[index], target, fields, idKey);
      completed += 1;
      process.stdout.write(`\r${target}: ${completed}/${batches.length} batches`);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(REQUEST_CONCURRENCY, batches.length) }, () => worker())
  );
  process.stdout.write('\n');

  return translated.flat();
}

/** The language codes named on the command line, or every supported one. */
function requestedTargets(argv) {
  const targets = argv.length > 0 ? argv : Object.keys(LOCALE_SUFFIXES);
  const unknown = targets.filter((target) => !LOCALE_SUFFIXES[target]);
  if (unknown.length > 0) {
    throw new Error(`unsupported translation target(s): ${unknown.join(', ')}`);
  }

  return targets;
}

async function writeJson(file, value) {
  const config = await prettier.resolveConfig(file);
  const json = await prettier.format(JSON.stringify(value), {
    ...config,
    filepath: file,
    parser: 'json',
  });
  fs.writeFileSync(file, json);
}

module.exports = { LOCALE_SUFFIXES, requestedTargets, translateEntries, writeJson };
