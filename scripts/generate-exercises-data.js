#!/usr/bin/env node
/* eslint-disable no-undef */

/**
 * Generates the app's exercise catalogue (873 exercises, CC0) from free-exercise-db:
 *   - `data/exercisesData.json` contains the structural exercise data.
 *   - `data/exercisesEnUS.json` contains its English names and descriptions.
 *
 * Usage:
 *   node scripts/generate-exercises-data.js [path-to-free-exercise-db]
 *
 * The source repo is expected at `../free-exercise-db` relative to this repo
 * unless a path is given. Only `dist/exercises.json` is read. Locale
 * descriptions are assembled from each source exercise's instructions.
 *
 * Field derivation:
 *   - `exerciseIndex`  1-based position in the alphabetically sorted catalogue.
 *                      It is display order only. Stable locale joins use
 *                      `exerciseSlug`; database primary keys are
 *                      `fx-<__freeExerciseDbId>`.
 *   - `muscleGroup`    free-exercise-db's primary muscle folded into the nine
 *                      coarse `EXERCISE_JSON_MUSCLE_GROUPS` names.
 *   - `equipmentType`  their `equipment` mapped onto `EquipmentType`, with the
 *                      Smith-machine family split out of `machine`.
 *   - `mechanicType`   their `category` first (stretching/plyometrics/cardio),
 *                      then their `mechanic` (compound/isolation).
 *   - `targetMuscles`  primary + secondary muscles mapped onto the
 *                      `MUSCLE_SEED_DATA` vocabulary, refined by name for
 *                      deltoid heads and obliques.
 *   - `loadMultiplier` an exercise that also exists in the frozen legacy catalogue
 *                      inherits its value verbatim (see MUSCLOG_ANCHORS); the
 *                      rest are derived from the movement family by the rules
 *                      in AGENTS.md — bodyweight entries carry the fraction of
 *                      body mass moved, holds and cardio stay a hard 0.
 */

const fs = require('fs');
const path = require('path');

const {
  assertSourceMusclesMapped,
  descriptionFor,
  resolveEquipment,
  resolveMechanic,
  resolveMuscleGroup,
  resolveTargetMuscles,
} = require('./exercise-catalogue-mapping');
const { resolveLoadMultiplier } = require('./exercise-load-multiplier-policy');

const repoRoot = path.join(__dirname, '..');
const sourceRepo = process.argv[2] || path.join(repoRoot, '..', 'free-exercise-db');
const sourceFile = path.join(sourceRepo, 'dist', 'exercises.json');
const outputFile = path.join(repoRoot, 'data', 'exercisesData.json');
const enUsOutputFile = path.join(repoRoot, 'data', 'exercisesEnUS.json');

async function main() {
  if (!fs.existsSync(sourceFile)) {
    console.error(`Could not find ${sourceFile}`);
    console.error('Pass the free-exercise-db checkout path as the first argument.');
    process.exit(1);
  }

  const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));

  assertSourceMusclesMapped(source);

  // The frozen pre-free-exercise-db catalogue, kept only as the loadMultiplier anchor
  // scale (and as the Game Boy ROM's source). Reading the generator's own output here
  // would be circular.
  const legacy = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'data', 'legacyExercisesData.json'), 'utf8')
  );
  const anchorMultipliers = new Map(legacy.map((e) => [e.__exerciseName, e.loadMultiplier]));
  const firstExerciseIndex = 1;

  const stats = { anchored: 0, ruled: 0, zeroed: 0, fallback: [] };

  const sorted = [...source].sort((a, b) => a.name.localeCompare(b.name));
  const output = sorted.map((entry, i) => {
    const equipmentType = resolveEquipment(entry);
    const mechanicType = resolveMechanic(entry);

    return {
      exerciseIndex: firstExerciseIndex + i,
      muscleGroup: resolveMuscleGroup(entry, equipmentType),
      equipmentType,
      mechanicType,
      targetMuscles: resolveTargetMuscles(entry),
      loadMultiplier: resolveLoadMultiplier(
        entry,
        equipmentType,
        mechanicType,
        anchorMultipliers,
        stats
      ),
      __exerciseName: entry.name,
      __freeExerciseDbId: entry.id,
    };
  });

  const enUsOutput = sorted.map((entry) => ({
    exerciseSlug: entry.id,
    name: entry.name,
    description: descriptionFor(entry),
  }));

  // Formatted the way `npm run format` would, so regenerating leaves no diff
  // for the lint suite to pick up.
  const prettier = require('prettier');
  const writeJson = async (file, value) => {
    const config = await prettier.resolveConfig(file);
    const json = await prettier.format(JSON.stringify(value), {
      ...config,
      filepath: file,
      parser: 'json',
    });
    fs.writeFileSync(file, json);
  };

  await Promise.all([writeJson(outputFile, output), writeJson(enUsOutputFile, enUsOutput)]);

  console.log(`Wrote ${output.length} exercises to ${path.relative(repoRoot, outputFile)}`);
  console.log(
    `Wrote ${enUsOutput.length} English descriptions to ${path.relative(repoRoot, enUsOutputFile)}`
  );
  console.log(`  loadMultiplier from a legacy anchor  : ${stats.anchored}`);
  console.log(`  loadMultiplier from a family rule    : ${stats.ruled}`);
  console.log(`  loadMultiplier zeroed (stretch/cardio): ${stats.zeroed}`);
  console.log(`  loadMultiplier from the fallback     : ${stats.fallback.length}`);
  if (stats.fallback.length > 0) {
    for (const name of stats.fallback) {
      console.log(`    - ${name}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
