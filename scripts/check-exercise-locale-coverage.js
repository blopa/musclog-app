#!/usr/bin/env node
/* eslint-disable no-undef */

/**
 * check-exercise-locale-coverage.js
 *
 * Collects all `muscleGroup` and `targetMuscles` values from the exercise data
 * files and checks whether each value has a corresponding translation key in
 * lang/locales/en-us/exercises.json.
 *
 * Usage:
 *   node scripts/check-exercise-locale-coverage.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// TODO: instead, load all exercises*.json from data dir
const EXERCISE_DATA_FILES = [
  path.join(ROOT, 'data/exercisesEnUS.json'),
  path.join(ROOT, 'data/exercisesPtBr.json'),
  path.join(ROOT, 'data/exercisesRuRu.json'),
];

const EXERCISES_LOCALE_FILE = path.join(ROOT, 'lang/locales/en-us/exercises.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`✗ Failed to read ${path.relative(ROOT, filePath)}: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Flatten a nested object into a set of dot-separated keys that map to leaf
 * (non-object) values, prefixed by `prefix`.
 */
function flattenKeys(obj, prefix = '') {
  const keys = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const nested of flattenKeys(v, full)) {
        keys.add(nested);
      }
    } else {
      keys.add(full);
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Collect values from exercise data files
// ---------------------------------------------------------------------------

const muscleGroups = new Set();
const targetMuscles = new Set();
/** Map: value -> Set of source filenames (for reporting) */
const mgSources = new Map();
const tmSources = new Map();

for (const filePath of EXERCISE_DATA_FILES) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠  Data file not found, skipping: ${path.relative(ROOT, filePath)}`);
    continue;
  }

  const exercises = loadJson(filePath);
  const filename = path.relative(ROOT, filePath);

  if (!Array.isArray(exercises)) {
    console.warn(`⚠  Expected an array in ${filename}, skipping.`);
    continue;
  }

  for (const ex of exercises) {
    if (ex.muscleGroup) {
      muscleGroups.add(ex.muscleGroup);
      if (!mgSources.has(ex.muscleGroup)) {
        mgSources.set(ex.muscleGroup, new Set());
      }
      mgSources.get(ex.muscleGroup).add(filename);
    }

    if (Array.isArray(ex.targetMuscles)) {
      for (const tm of ex.targetMuscles) {
        targetMuscles.add(tm);
        if (!tmSources.has(tm)) {
          tmSources.set(tm, new Set());
        }
        tmSources.get(tm).add(filename);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Load locale and build lookup structures
// ---------------------------------------------------------------------------

const localeData = loadJson(EXERCISES_LOCALE_FILE);
const localeRelative = path.relative(ROOT, EXERCISES_LOCALE_FILE);

const allLocaleKeys = flattenKeys(localeData);

// Both muscleGroup and targetMuscles values are checked against exercises.muscleGroups.
const muscleGroupLocaleKeys = new Set();
const mgObj = localeData?.exercises?.muscleGroups ?? {};
for (const key of flattenKeys(mgObj)) {
  muscleGroupLocaleKeys.add(key);
}

// ---------------------------------------------------------------------------
// Check coverage
// ---------------------------------------------------------------------------

const missingMg = [];
const missingTm = [];

for (const mg of [...muscleGroups].sort()) {
  if (!muscleGroupLocaleKeys.has(mg)) {
    missingMg.push(mg);
  }
}

for (const tm of [...targetMuscles].sort()) {
  if (!muscleGroupLocaleKeys.has(tm)) {
    missingTm.push(tm);
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log('='.repeat(60));
console.log('  EXERCISE LOCALE COVERAGE CHECK');
console.log('='.repeat(60));
console.log(`\nLocale file : ${localeRelative}`);
console.log(`Data files  : ${EXERCISE_DATA_FILES.length} file(s)\n`);

console.log('─'.repeat(60));
console.log('MUSCLE GROUPS  (exercises.muscleGroups.<key>)');
console.log('─'.repeat(60));
console.log(`  Found in data    : ${muscleGroups.size}`);
console.log(`  Covered in locale: ${muscleGroups.size - missingMg.length}`);
console.log(`  Missing          : ${missingMg.length}`);

if (missingMg.length > 0) {
  console.log('\n  ❌ Missing muscleGroup keys:');
  for (const mg of missingMg) {
    const sources = [...(mgSources.get(mg) ?? [])].join(', ');
    console.log(`     • "${mg}"  (from: ${sources})`);
  }
  console.log('\n  💡 Add these under exercises.muscleGroups in exercises.json:');
  console.log('  {');
  for (const mg of missingMg) {
    console.log(`    "${mg}": "TODO",`);
  }
  console.log('  }');
} else {
  console.log('\n  ✅ All muscleGroup values are covered.');
}

console.log('\n' + '─'.repeat(60));
console.log('TARGET MUSCLES  (exercises.muscleGroups.<key>)');
console.log('─'.repeat(60));
console.log(`  Found in data    : ${targetMuscles.size}`);
console.log(`  Covered in locale: ${targetMuscles.size - missingTm.length}`);
console.log(`  Missing          : ${missingTm.length}`);

if (missingTm.length > 0) {
  console.log('\n  ❌ Missing targetMuscles keys:');
  for (const tm of missingTm) {
    const sources = [...(tmSources.get(tm) ?? [])].join(', ');
    console.log(`     • "${tm}"  (from: ${sources})`);
  }
  console.log('\n  💡 Add these under exercises.muscleGroups in exercises.json:');
  console.log('  {');
  for (const tm of missingTm) {
    console.log(`    "${tm}": "TODO",`);
  }
  console.log('  }');
} else {
  console.log('\n  ✅ All targetMuscles values are covered.');
}

console.log('\n' + '='.repeat(60));

const totalMissing = missingMg.length + missingTm.length;
if (totalMissing > 0) {
  console.log(`\n⚠  ${totalMissing} value(s) are not covered in the locale file.\n`);
  process.exit(1);
} else {
  console.log('\n✅ Full coverage — no missing locale entries.\n');
}
