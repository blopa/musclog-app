// Ports the bundled exercise dataset into a hardcoded, ROM-banked C table.
//
// Source:
//   - data/exercisesData.json -> exercises.{c,h}  (bank 6)
//
// For every exercise only the fields the Game Boy workout shell needs are kept:
//   - name (`__exerciseName`)
//   - primary muscle group
//   - equipment type
//   - load multiplier
//
// Muscle groups and equipment types are emitted as compact uint8 enum values.
// Load multipliers are stored as centi-units in uint16 (1.45 -> 145) because the
// source data uses two-decimal precision. The table order follows exerciseIndex,
// so exercise ID remains implicit as `array index + 1`.
//
// The generated files are committed so the ROM build does not depend on the app
// seed JSON. Re-run with `npm run gb:gen-exercises` if the dataset changes.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..', '..');
const dataDir = join(repoRoot, 'data');
const outDir = join(repoRoot, 'gameboy', 'src');

const SOURCE_FILE = 'exercisesData.json';
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

function sortedUnique(rows, field) {
  return [...new Set(rows.map((row) => row[field]))].sort();
}

function validateExerciseRows(rawRows) {
  if (!Array.isArray(rawRows)) {
    throw new Error(`data/${SOURCE_FILE} must contain a JSON array.`);
  }

  const sortedRows = [...rawRows].sort(
    (a, b) => numberFromField(a.exerciseIndex) - numberFromField(b.exerciseIndex)
  );
  const errors = [];
  const seenIndexes = new Set();

  sortedRows.forEach((row, index) => {
    const expectedIndex = index + 1;
    const exerciseIndex = numberFromField(row.exerciseIndex);
    const name = row.__exerciseName;
    const muscleGroup = row.muscleGroup;
    const equipmentType = row.equipmentType;
    const loadMultiplierCenti = centiMultiplier(row.loadMultiplier);
    const reasons = [];

    if (!Number.isInteger(exerciseIndex)) reasons.push('missing integer exerciseIndex');
    else if (exerciseIndex !== expectedIndex)
      reasons.push(`exerciseIndex must be ${expectedIndex}`);
    else if (seenIndexes.has(exerciseIndex)) reasons.push('duplicate exerciseIndex');

    if (typeof name !== 'string' || name.trim().length === 0) reasons.push('missing exercise name');
    if (typeof muscleGroup !== 'string' || muscleGroup.trim().length === 0)
      reasons.push('missing muscleGroup');
    if (typeof equipmentType !== 'string' || equipmentType.trim().length === 0)
      reasons.push('missing equipmentType');
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

function rowLiterals(rows, muscleMap, equipmentMap) {
  return rows
    .map((row) => {
      const name = cString(row.__exerciseName);
      const muscle = muscleMap.get(row.muscleGroup);
      const equipment = equipmentMap.get(row.equipmentType);
      const load = centiMultiplier(row.loadMultiplier);
      return `    { "${name}", ${muscle}, ${equipment}, ${load}u }, /* ${row.exerciseIndex} */`;
    })
    .join('\n');
}

const sourcePath = join(dataDir, SOURCE_FILE);
console.log(`Reading ${sourcePath} ...`);

const rows = validateExerciseRows(JSON.parse(readFileSync(sourcePath, 'utf8')));
const muscleGroups = sortedUnique(rows, 'muscleGroup');
const equipmentTypes = sortedUnique(rows, 'equipmentType');
const muscleMap = new Map(muscleGroups.map((value) => [value, `EX_MUSCLE_${enumSuffix(value)}`]));
const equipmentMap = new Map(
  equipmentTypes.map((value) => [value, `EX_EQUIPMENT_${enumSuffix(value)}`])
);

const header = `/* Auto-generated by gameboy/tools/gen-exercises.mjs — do not edit by hand. */
/* Source: data/${SOURCE_FILE}. */
#ifndef MUSCLOG_EXERCISES_H
#define MUSCLOG_EXERCISES_H

#include <stdint.h>

${enumDefinitions(muscleGroups, 'EX_MUSCLE', 'exercise_muscle_group_t')}
#define EXERCISE_MUSCLE_GROUP_COUNT ${muscleGroups.length}u

${enumDefinitions(equipmentTypes, 'EX_EQUIPMENT', 'exercise_equipment_type_t')}
#define EXERCISE_EQUIPMENT_TYPE_COUNT ${equipmentTypes.length}u

/* One bundled exercise. The table order follows exerciseIndex, so the stable
 * exercise id is the zero-based array index + 1.
 * load_multiplier_centi stores loadMultiplier * 100 (1.45 -> 145). */
typedef struct {
    const char *name;
    uint8_t muscle_group;            /* exercise_muscle_group_t */
    uint8_t equipment_type;          /* exercise_equipment_type_t */
    uint16_t load_multiplier_centi;
} exercise_t;

#define EXERCISE_COUNT ${rows.length}u
#define EXERCISE_LOAD_MULTIPLIER_SCALE 100u

/* The table and its name strings live in this ROM bank. Callers must
 * SWITCH_ROM(EXERCISES_BANK) before dereferencing the arrays. */
#define EXERCISES_BANK ${EXERCISES_BANK}

extern const char * const exercise_muscle_group_names[EXERCISE_MUSCLE_GROUP_COUNT];
extern const char * const exercise_equipment_type_names[EXERCISE_EQUIPMENT_TYPE_COUNT];
extern const exercise_t exercises[EXERCISE_COUNT];

#endif /* MUSCLOG_EXERCISES_H */
`;

const body = `/* Auto-generated by gameboy/tools/gen-exercises.mjs — do not edit by hand. */
/* Source: data/${SOURCE_FILE}. */
#pragma bank ${EXERCISES_BANK}
#include "exercises.h"

${nameArray(muscleGroups, 'exercise_muscle_group_names', 'EXERCISE_MUSCLE_GROUP_COUNT')}
${nameArray(equipmentTypes, 'exercise_equipment_type_names', 'EXERCISE_EQUIPMENT_TYPE_COUNT')}
const exercise_t exercises[EXERCISE_COUNT] = {
${rowLiterals(rows, muscleMap, equipmentMap)}
};
`;

writeFileSync(join(outDir, 'exercises.h'), header);
writeFileSync(join(outDir, 'exercises.c'), body);

console.log(
  `Wrote exercises.{c,h} (${rows.length} exercises, ${muscleGroups.length} muscle groups, ` +
    `${equipmentTypes.length} equipment types, bank ${EXERCISES_BANK}).`
);
