#!/usr/bin/env node
/* eslint-disable no-undef */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const structuralFile = path.join(dataDir, 'exercisesData.json');
const copyFiles = fs
  .readdirSync(dataDir)
  .filter((file) => file !== 'exercisesData.json' && /^exercises[A-Z][A-Za-z]+\.json$/.test(file))
  .sort();

const structural = JSON.parse(fs.readFileSync(structuralFile, 'utf8'));
const expectedSlugs = structural.map(({ __freeExerciseDbId }) => __freeExerciseDbId);
const expectedSlugSet = new Set(expectedSlugs);
let hasErrors = false;

if (expectedSlugSet.size !== structural.length) {
  console.error('exercisesData.json contains duplicate free-exercise-db slugs');
  hasErrors = true;
}

for (const file of copyFiles) {
  const copies = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
  const slugs = copies.map(({ exerciseSlug }) => exerciseSlug);
  const slugSet = new Set(slugs);

  if (copies.length !== structural.length) {
    console.error(`${file} has ${copies.length} rows; expected ${structural.length}`);
    hasErrors = true;
  }

  if (slugSet.size !== copies.length) {
    console.error(`${file} contains duplicate exerciseSlug values`);
    hasErrors = true;
  }

  const missing = expectedSlugs.filter((slug) => !slugSet.has(slug));
  const unknown = slugs.filter((slug) => !expectedSlugSet.has(slug));
  if (missing.length > 0 || unknown.length > 0) {
    console.error(`${file} slug mismatch: ${missing.length} missing, ${unknown.length} unknown`);
    hasErrors = true;
  }
}

if (hasErrors) {
  process.exit(1);
}

console.log(
  `Validated ${structural.length} stable exercise slugs across ${copyFiles.length} locale files`
);
