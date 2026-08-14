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
// source data uses two-decimal precision. The selected rows retain the source
// catalogue's exerciseIndex order, while their Game Boy ID is reassigned as the
// compact `array index + 1`.
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
const POPULAR_EXERCISE_COUNT = 100;
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

function selectPopularExerciseRows(rawRows, enumSets) {
  if (!Array.isArray(rawRows)) {
    throw new Error(`data/${SOURCE_FILE} must contain a JSON array.`);
  }

  const invalidPopularityRows = rawRows.filter(
    (row) => Object.hasOwn(row, 'isPopular') && row.isPopular !== true
  );
  if (invalidPopularityRows.length > 0) {
    throw new Error(`data/${SOURCE_FILE} must omit isPopular or set it to true.`);
  }

  const sortedRows = rawRows
    .filter((row) => row.isPopular === true)
    .sort((a, b) => numberFromField(a.exerciseIndex) - numberFromField(b.exerciseIndex));
  if (sortedRows.length !== POPULAR_EXERCISE_COUNT) {
    throw new Error(
      `data/${SOURCE_FILE} must contain exactly ${POPULAR_EXERCISE_COUNT} popular exercises; found ${sortedRows.length}.`
    );
  }

  const errors = [];
  const seenIndexes = new Set();

  sortedRows.forEach((row, index) => {
    const exerciseIndex = numberFromField(row.exerciseIndex);
    const name = row.__exerciseName;
    const muscleGroup = row.muscleGroup;
    const equipmentType = row.equipmentType;
    const mechanicType = row.mechanicType;
    const loadMultiplierCenti = centiMultiplier(row.loadMultiplier);
    const reasons = [];

    if (!Number.isInteger(exerciseIndex)) reasons.push('missing integer exerciseIndex');
    else if (seenIndexes.has(exerciseIndex)) reasons.push('duplicate exerciseIndex');

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

    if (exerciseIndex !== undefined) seenIndexes.add(exerciseIndex);
    if (reasons.length > 0) {
      errors.push(`  [${exerciseIndex ?? index}] ${name || '<unnamed>'}: ${reasons.join(', ')}`);
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
    .map((row) => {
      const name = cString(row.__exerciseName);
      const muscle = muscleMap.get(row.muscleGroup);
      const equipment = equipmentMap.get(row.equipmentType);
      const mechanic = mechanicMap.get(row.mechanicType);
      const load = centiMultiplier(row.loadMultiplier);
      return `    { "${name}", ${muscle}, ${equipment}, ${mechanic}, ${load}u }, /* ${row.exerciseIndex} */`;
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
const rows = selectPopularExerciseRows(JSON.parse(readFileSync(sourcePath, 'utf8')), {
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

/* One bundled exercise. Popular rows retain the source exerciseIndex order;
 * the Game Boy exercise id is the zero-based array index + 1.
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
