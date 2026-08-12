#!/usr/bin/env node
/* eslint-disable no-undef */

/**
 * Machine-translates the English exercise catalogue into every supported app locale.
 *
 * Usage:
 *   node scripts/generate-exercise-locales.js
 *   node scripts/generate-exercise-locales.js es nl pt ru
 *
 * The generated files contain copy only. `exerciseSlug` joins them to the structural
 * catalogue in `data/exercisesData.json`; names and descriptions come from
 * `data/exercisesEnUS.json`. Requests are batched while numeric markers keep every field
 * associated with its exercise.
 */

const fs = require('fs');
const path = require('path');
const prettier = require('prettier');

const ROOT = path.join(__dirname, '..');
const SOURCE_FILE = path.join(ROOT, 'data', 'exercisesEnUS.json');
const TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';
const MAX_BATCH_CHARACTERS = 4000;
const REQUEST_CONCURRENCY = 8;
const MARKER_PREFIX = '901731';

const TARGETS = {
  es: 'exercisesEsEs.json',
  nl: 'exercisesNlNl.json',
  pt: 'exercisesPtBr.json',
  ru: 'exercisesRuRu.json',
};

function marker(markerIndex, field) {
  return `${MARKER_PREFIX}${String(markerIndex).padStart(4, '0')}0${field}`;
}

function textForEntry(entry) {
  return [
    marker(entry.markerIndex, 1),
    entry.name,
    marker(entry.markerIndex, 2),
    entry.description,
  ].join('\n');
}

function createBatches(entries) {
  const batches = [];
  let batch = [];
  let characters = 0;

  for (const entry of entries) {
    const entryCharacters = textForEntry(entry).length + 1;
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

function parseBatch(text, entries) {
  const values = new Map();
  const markerPattern = new RegExp(`${MARKER_PREFIX}(\\d{4})(0[12])`, 'g');
  const matches = [...text.matchAll(markerPattern)];

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const markerIndex = Number(match[1]);
    const field = match[2] === '01' ? 'name' : 'description';
    const start = match.index + match[0].length;
    const end = matches[i + 1]?.index ?? text.length;
    const entry = values.get(markerIndex) ?? {};
    entry[field] = text.slice(start, end).trim();
    values.set(markerIndex, entry);
  }

  return entries.map(({ exerciseSlug, markerIndex }) => {
    const value = values.get(markerIndex);
    if (!value?.name || !value?.description) {
      throw new Error(`could not recover translated fields for exercise ${exerciseSlug}`);
    }

    return { exerciseSlug, name: value.name, description: value.description };
  });
}

async function translateBatch(entries, target) {
  try {
    const source = entries.map(textForEntry).join('\n');
    return parseBatch(await translatedText(source, target), entries);
  } catch (error) {
    if (entries.length === 1) {
      throw error;
    }

    const middle = Math.ceil(entries.length / 2);
    const halves = await Promise.all([
      translateBatch(entries.slice(0, middle), target),
      translateBatch(entries.slice(middle), target),
    ]);

    return halves.flat();
  }
}

async function translateLocale(entries, target) {
  const batches = createBatches(entries);
  const translated = new Array(batches.length);
  let nextBatch = 0;
  let completed = 0;

  async function worker() {
    while (nextBatch < batches.length) {
      const index = nextBatch;
      nextBatch += 1;
      translated[index] = await translateBatch(batches[index], target);
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

async function writeJson(file, value) {
  const config = await prettier.resolveConfig(file);
  const json = await prettier.format(JSON.stringify(value), {
    ...config,
    filepath: file,
    parser: 'json',
  });
  fs.writeFileSync(file, json);
}

async function main() {
  const requestedTargets = process.argv.slice(2);
  const targets = requestedTargets.length > 0 ? requestedTargets : Object.keys(TARGETS);
  const unknown = targets.filter((target) => !TARGETS[target]);
  if (unknown.length > 0) {
    throw new Error(`unsupported translation target(s): ${unknown.join(', ')}`);
  }

  const source = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8')).map((entry, index) => ({
    ...entry,
    markerIndex: index + 1,
  }));
  for (const target of targets) {
    const outputFile = path.join(ROOT, 'data', TARGETS[target]);
    const translated = await translateLocale(source, target);
    await writeJson(outputFile, translated);
    console.log(
      `Wrote ${translated.length} ${target} exercises to ${path.relative(ROOT, outputFile)}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
