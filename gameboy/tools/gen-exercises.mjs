// Ports the bundled exercise dataset into a hardcoded, ROM-banked C table.
//
// Source:
//   - data/exercisesData.json -> exercises.{c,h}  (bank 6)
//
// Only rows explicitly marked `isPopular: true` are included. For every selected
// exercise only the fields the Game Boy workout shell needs are kept:
//   - name (`__exerciseName`)
//   - primary muscle group
//   - equipment type
//   - mechanic type
//   - load multiplier
//
// Muscle groups, equipment types, and mechanic types use the frozen compact
// uint8 wire values in data/gameBoyOpticalProtocol.json.
// Load multipliers are stored as centi-units in uint16 (1.45 -> 145) because the
// source data uses two-decimal precision.
//
// TABLE ORDER IS FROZEN by `exerciseSlugs` in data/gameBoyOpticalProtocol.json,
// NOT by the catalogue's exerciseIndex. A row's position is its identity on two
// wires at once: cartridge `.sav` files store a workout set's exercise as that
// 0-based index, and the optical export sends the same index for the app to map
// back to a catalogue slug. exerciseIndex is alphabetical display order over the
// whole 873-entry catalogue, so a single upstream addition would shift it and
// silently re-point every saved workout at a different movement. Append to the
// frozen list to add an exercise; never reorder or remove.
//
// The generated files are committed so the ROM build does not depend on the app
// seed JSON. Re-run with `npm run gb:gen-exercises` if the dataset changes.

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..', '..');
const dataDir = join(repoRoot, 'data');
const outDir = join(repoRoot, 'gameboy', 'src', 'generated');
const clangFormat = createRequire(import.meta.url)('clang-format');
mkdirSync(outDir, { recursive: true });

const SOURCE_FILE = 'exercisesData.json';
const PROTOCOL_FILE = 'gameBoyOpticalProtocol.json';
const EXERCISES_BANK = 6;

function cString(name) {
  return name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function enumSuffix(value) {
  const suffix = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!/^[A-Z_][A-Z0-9_]*$/.test(suffix)) {
    throw new Error(`Cannot convert "${value}" to a C enum suffix.`);
  }
  return suffix;
}

function numberFromField(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function centiMultiplier(value) {
  const n = numberFromField(value);
  if (n === undefined) return undefined;

  const centi = Math.round(n * 100);
  return Math.abs(n * 100 - centi) < 0.000001 ? centi : undefined;
}

function protocolEnumValues(protocol, field) {
  const values = protocol.exerciseEnums?.[field];
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.some((value) => typeof value !== 'string' || value.trim().length === 0) ||
    new Set(values).size !== values.length
  ) {
    throw new Error(`data/${PROTOCOL_FILE} has an invalid ${field} enum.`);
  }
  return values;
}

function protocolVersion(protocol, field) {
  const value = protocol[field];
  if (!Number.isInteger(value) || value < 0 || value > 65_535) {
    throw new Error(`data/${PROTOCOL_FILE} has an invalid ${field}.`);
  }
  return value;
}

function protocolExerciseSlugs(protocol) {
  const slugs = protocol.exerciseSlugs;
  if (
    !Array.isArray(slugs) ||
    slugs.length === 0 ||
    slugs.length > 255 ||
    slugs.some((slug) => typeof slug !== 'string' || slug.trim().length === 0) ||
    new Set(slugs).size !== slugs.length
  ) {
    throw new Error(`data/${PROTOCOL_FILE} has an invalid exerciseSlugs list.`);
  }
  return slugs;
}

function selectPopularExerciseRows(rawRows, frozenSlugs, enumSets) {
  if (!Array.isArray(rawRows)) {
    throw new Error(`data/${SOURCE_FILE} must contain a JSON array.`);
  }

  const invalidPopularityRows = rawRows.filter(
    (row) => Object.hasOwn(row, 'isPopular') && row.isPopular !== true
  );
  if (invalidPopularityRows.length > 0) {
    throw new Error(`data/${SOURCE_FILE} must omit isPopular or set it to true.`);
  }

  const popularRows = new Map(
    rawRows.filter((row) => row.isPopular === true).map((row) => [row.__freeExerciseDbId, row])
  );

  // The frozen list and the popular flag must describe the same set. Diffing both ways
  // turns "someone re-ran the popularity policy without appending to the wire contract"
  // into a build failure instead of a silent cartridge/app exercise remap.
  const missingFromCatalogue = frozenSlugs.filter((slug) => !popularRows.has(slug));
  if (missingFromCatalogue.length > 0) {
    throw new Error(
      `data/${PROTOCOL_FILE} freezes exercise slugs that are no longer marked isPopular in ` +
        `data/${SOURCE_FILE}: ${missingFromCatalogue.join(', ')}`
    );
  }

  const frozenSlugSet = new Set(frozenSlugs);
  const unfrozenSlugs = [...popularRows.keys()].filter((slug) => !frozenSlugSet.has(slug));
  if (unfrozenSlugs.length > 0) {
    throw new Error(
      `data/${SOURCE_FILE} marks exercises isPopular that are missing from the frozen ` +
        `exerciseSlugs list in data/${PROTOCOL_FILE}. Append them (never reorder): ` +
        unfrozenSlugs.join(', ')
    );
  }

  const sortedRows = frozenSlugs.map((slug) => popularRows.get(slug));
  const errors = [];

  sortedRows.forEach((row, index) => {
    const name = row.__exerciseName;
    const muscleGroup = row.muscleGroup;
    const equipmentType = row.equipmentType;
    const mechanicType = row.mechanicType;
    const loadMultiplierCenti = centiMultiplier(row.loadMultiplier);
    const reasons = [];

    if (typeof name !== 'string' || name.trim().length === 0) reasons.push('missing exercise name');
    if (typeof muscleGroup !== 'string' || muscleGroup.trim().length === 0)
      reasons.push('missing muscleGroup');
    else if (!enumSets.muscleGroups.has(muscleGroup))
      reasons.push(`muscleGroup "${muscleGroup}" is missing from ${PROTOCOL_FILE}`);
    if (typeof equipmentType !== 'string' || equipmentType.trim().length === 0)
      reasons.push('missing equipmentType');
    else if (!enumSets.equipmentTypes.has(equipmentType))
      reasons.push(`equipmentType "${equipmentType}" is missing from ${PROTOCOL_FILE}`);
    if (typeof mechanicType !== 'string' || mechanicType.trim().length === 0)
      reasons.push('missing mechanicType');
    else if (!enumSets.mechanicTypes.has(mechanicType))
      reasons.push(`mechanicType "${mechanicType}" is missing from ${PROTOCOL_FILE}`);
    if (loadMultiplierCenti === undefined)
      reasons.push('loadMultiplier must fit two-decimal precision');
    else if (loadMultiplierCenti < 0) reasons.push('negative loadMultiplier');

    if (reasons.length > 0) {
      errors.push(`  [${index}] ${name || row.__freeExerciseDbId}: ${reasons.join(', ')}`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`Invalid rows in data/${SOURCE_FILE}:\n${errors.join('\n')}`);
  }

  return sortedRows;
}

function enumDefinitions(values, prefix, typedefName) {
  const lines = values.map((value, index) => `    ${prefix}_${enumSuffix(value)} = ${index},`);
  return `typedef enum {
${lines.join('\n')}
} ${typedefName};
`;
}

function nameArray(values, symbol, countMacro) {
  return `const char * const ${symbol}[${countMacro}] = {
${values.map((value) => `    "${cString(value)}",`).join('\n')}
};
`;
}

function rowLiterals(rows, muscleMap, equipmentMap, mechanicMap) {
  return rows
    .map((row, index) => {
      const name = cString(row.__exerciseName);
      const muscle = muscleMap.get(row.muscleGroup);
      const equipment = equipmentMap.get(row.equipmentType);
      const mechanic = mechanicMap.get(row.mechanicType);
      const load = centiMultiplier(row.loadMultiplier);
      // The trailing comment is the frozen wire index and slug: what a `.sav` file
      // stores and what the app maps an optical export back to.
      return `    { "${name}", ${muscle}, ${equipment}, ${mechanic}, ${load}u }, /* ${index} ${row.__freeExerciseDbId} */`;
    })
    .join('\n');
}

const sourcePath = join(dataDir, SOURCE_FILE);
const protocolPath = join(dataDir, PROTOCOL_FILE);
console.log(`Reading ${sourcePath} ...`);

const protocol = JSON.parse(readFileSync(protocolPath, 'utf8'));
const muscleGroups = protocolEnumValues(protocol, 'muscleGroups');
const equipmentTypes = protocolEnumValues(protocol, 'equipmentTypes');
const mechanicTypes = protocolEnumValues(protocol, 'mechanicTypes');
const databaseExportVersion = protocolVersion(protocol, 'databaseExportVersion');
const gameBoyExportVersion = protocolVersion(protocol, 'gameBoyExportVersion');
const gameBoyDayShareVersion = protocolVersion(protocol, 'gameBoyDayShareVersion');
const frozenSlugs = protocolExerciseSlugs(protocol);
const rows = selectPopularExerciseRows(JSON.parse(readFileSync(sourcePath, 'utf8')), frozenSlugs, {
  muscleGroups: new Set(muscleGroups),
  equipmentTypes: new Set(equipmentTypes),
  mechanicTypes: new Set(mechanicTypes),
});
const muscleMap = new Map(muscleGroups.map((value) => [value, `EX_MUSCLE_${enumSuffix(value)}`]));
const equipmentMap = new Map(
  equipmentTypes.map((value) => [value, `EX_EQUIPMENT_${enumSuffix(value)}`])
);
const mechanicMap = new Map(
  mechanicTypes.map((value) => [value, `EX_MECHANIC_${enumSuffix(value)}`])
);

const header = `/* Auto-generated by gameboy/tools/gen-exercises.mjs — do not edit by hand. */
/* Sources: data/${SOURCE_FILE}, data/${PROTOCOL_FILE}. */
#ifndef MUSCLOG_EXERCISES_H
#define MUSCLOG_EXERCISES_H

#include <stdint.h>

${enumDefinitions(muscleGroups, 'EX_MUSCLE', 'exercise_muscle_group_t')}
#define EXERCISE_MUSCLE_GROUP_COUNT ${muscleGroups.length}u

${enumDefinitions(equipmentTypes, 'EX_EQUIPMENT', 'exercise_equipment_type_t')}
#define EXERCISE_EQUIPMENT_TYPE_COUNT ${equipmentTypes.length}u

${enumDefinitions(mechanicTypes, 'EX_MECHANIC', 'exercise_mechanic_type_t')}
#define EXERCISE_MECHANIC_TYPE_COUNT ${mechanicTypes.length}u

/* One bundled exercise. The table order is frozen by exerciseSlugs in
 * data/${PROTOCOL_FILE}: a row's zero-based index is what .sav files store for a
 * logged set and what an optical export sends for the app to map back to a slug.
 * load_multiplier_centi stores loadMultiplier * 100 (1.45 -> 145). */
typedef struct {
    const char *name;
    uint8_t muscle_group;            /* exercise_muscle_group_t */
    uint8_t equipment_type;          /* exercise_equipment_type_t */
    uint8_t mechanic_type;           /* exercise_mechanic_type_t */
    uint16_t load_multiplier_centi;
} exercise_t;

#define EXERCISE_COUNT ${rows.length}u
#define EXERCISE_LOAD_MULTIPLIER_SCALE 100u

/* The table and its name strings live in this ROM bank. Callers must
 * SWITCH_ROM(EXERCISES_BANK) before dereferencing the arrays. */
#define EXERCISES_BANK ${EXERCISES_BANK}

extern const char * const exercise_muscle_group_names[EXERCISE_MUSCLE_GROUP_COUNT];
extern const char * const exercise_equipment_type_names[EXERCISE_EQUIPMENT_TYPE_COUNT];
extern const char * const exercise_mechanic_type_names[EXERCISE_MECHANIC_TYPE_COUNT];
extern const exercise_t exercises[EXERCISE_COUNT];

#endif /* MUSCLOG_EXERCISES_H */
`;

const body = `/* Auto-generated by gameboy/tools/gen-exercises.mjs — do not edit by hand. */
/* Sources: data/${SOURCE_FILE}, data/${PROTOCOL_FILE}. */
#pragma bank ${EXERCISES_BANK}
#include "exercises.h"

${nameArray(muscleGroups, 'exercise_muscle_group_names', 'EXERCISE_MUSCLE_GROUP_COUNT')}
${nameArray(equipmentTypes, 'exercise_equipment_type_names', 'EXERCISE_EQUIPMENT_TYPE_COUNT')}
${nameArray(mechanicTypes, 'exercise_mechanic_type_names', 'EXERCISE_MECHANIC_TYPE_COUNT')}
const exercise_t exercises[EXERCISE_COUNT] = {
${rowLiterals(rows, muscleMap, equipmentMap, mechanicMap)}
};
`;

const protocolHeader = `/* Auto-generated by gameboy/tools/gen-exercises.mjs — do not edit by hand. */
/* Source: data/${PROTOCOL_FILE}. */
#ifndef MUSCLOG_OPTICAL_PROTOCOL_GENERATED_H
#define MUSCLOG_OPTICAL_PROTOCOL_GENERATED_H

#define OPTICAL_EXPORT_DATABASE_VERSION ${databaseExportVersion}u
#define OPTICAL_EXPORT_SCHEMA_VERSION ${gameBoyExportVersion}u
#define OPTICAL_DAY_SHARE_SCHEMA_VERSION ${gameBoyDayShareVersion}u

#endif /* MUSCLOG_OPTICAL_PROTOCOL_GENERATED_H */
`;

const generatedFiles = [
  join(outDir, 'exercises.h'),
  join(outDir, 'exercises.c'),
  join(outDir, 'optical_protocol.generated.h'),
];
writeFileSync(generatedFiles[0], header);
writeFileSync(generatedFiles[1], body);
writeFileSync(generatedFiles[2], protocolHeader);
execFileSync(
  process.execPath,
  [
    clangFormat.location,
    '-i',
    `--style=file:${join(repoRoot, 'gameboy', '.clang-format')}`,
    ...generatedFiles,
  ],
  { cwd: repoRoot, stdio: 'inherit' }
);

console.log(
  `Wrote exercises.{c,h} and optical_protocol.generated.h (${rows.length} exercises, ` +
    `${muscleGroups.length} muscle groups, ` +
    `${equipmentTypes.length} equipment types, ${mechanicTypes.length} mechanic types, ` +
    `bank ${EXERCISES_BANK}).`
);
