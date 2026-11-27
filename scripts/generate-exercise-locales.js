#!/usr/bin/env node
/* eslint-disable no-undef */

/**
 * Machine-translates the English exercise catalogue into every supported app locale.
 *
 * Usage:
 *   node scripts/generate-exercise-locales.js
 *   node scripts/generate-exercise-locales.js es nl pt ru de fr it pl tr
 *
 * The generated files contain copy only. `exerciseSlug` joins them to the structural
 * catalogue in `data/exercisesData.json`; names and descriptions come from
 * `data/exercisesEnUS.json`. The translation itself is `scripts/lib/machineTranslate.js`.
 */

const fs = require('fs');
const path = require('path');

const {
  LOCALE_SUFFIXES,
  requestedTargets,
  translateEntries,
  writeJson,
} = require('./lib/machineTranslate');

const ROOT = path.join(__dirname, '..');
const SOURCE_FILE = path.join(ROOT, 'data', 'exercisesEnUS.json');

async function main() {
  const targets = requestedTargets(process.argv.slice(2));
  const source = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));

  for (const target of targets) {
    const outputFile = path.join(ROOT, 'data', `exercises${LOCALE_SUFFIXES[target]}.json`);
    const translated = await translateEntries(source, {
      target,
      fields: ['name', 'description'],
      idKey: 'exerciseSlug',
    });
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
