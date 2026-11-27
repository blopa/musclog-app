#!/usr/bin/env node
/* eslint-disable no-undef */

/**
 * Machine-translates the bundled foundation foods into every supported app locale.
 *
 * Usage:
 *   node scripts/generate-foundation-food-locales.js
 *   node scripts/generate-foundation-food-locales.js es nl pt ru de fr it pl tr
 *   node scripts/generate-foundation-food-locales.js --overrides-only
 *
 * English lives in the two seed files themselves (`data/usda_foundation_foods.json` and
 * `data/common_foundation_foods.json`). Each generated `data/foundationFoods<Xx><Xx>.json` holds
 * copy only, joined to its seed row by `external_id`; where two rows share an id the first one
 * wins, as in the seeder. Run `npm run generate-lang` after adding a language.
 *
 * Machine translation misreads short food names ("Gyro" as a gyroscope), so hand corrections live
 * in `scripts/foundation-food-translation-overrides.json` (`{ lang: { externalId: { name?,
 * description? } } }`) and are applied on every run. Never hand-edit the generated files:
 * add an override and run `--overrides-only`, which re-applies them without translating again.
 * Removing an override needs a full run for that language: the machine text it replaced is gone.
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
const OVERRIDES_FILE = path.join(__dirname, 'foundation-food-translation-overrides.json');
const SOURCE_FILES = ['usda_foundation_foods.json', 'common_foundation_foods.json'];

function readSource() {
  const entries = new Map();
  for (const file of SOURCE_FILES) {
    for (const row of JSON.parse(fs.readFileSync(path.join(ROOT, 'data', file), 'utf8'))) {
      if (!entries.has(row.external_id)) {
        entries.set(row.external_id, {
          externalId: row.external_id,
          name: row.name,
          description: row.description,
        });
      }
    }
  }

  return [...entries.values()];
}

/** The service often returns a lone word in lower case; English names all start upper case. */
function capitalize(text, locale) {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

function finish(entries, target) {
  const overrides = fs.existsSync(OVERRIDES_FILE)
    ? (JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'))[target] ?? {})
    : {};
  const unknown = Object.keys(overrides).filter(
    (externalId) => !entries.some((entry) => entry.externalId === externalId)
  );
  if (unknown.length > 0) {
    throw new Error(`overrides for unknown ${target} food(s): ${unknown.join(', ')}`);
  }

  return entries.map((entry) => {
    const { name, description } = { ...entry, ...overrides[entry.externalId] };

    return {
      externalId: entry.externalId,
      name: capitalize(name, target),
      description: capitalize(description, target),
    };
  });
}

async function main() {
  const args = process.argv.slice(2);
  const overridesOnly = args.includes('--overrides-only');
  const targets = requestedTargets(args.filter((arg) => arg !== '--overrides-only'));
  const source = readSource();

  for (const target of targets) {
    const outputFile = path.join(ROOT, 'data', `foundationFoods${LOCALE_SUFFIXES[target]}.json`);
    const translated = overridesOnly
      ? JSON.parse(fs.readFileSync(outputFile, 'utf8'))
      : await translateEntries(source, {
          target,
          fields: ['name', 'description'],
          idKey: 'externalId',
        });
    await writeJson(outputFile, finish(translated, target));
    console.log(`Wrote ${translated.length} ${target} foods to ${path.relative(ROOT, outputFile)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
