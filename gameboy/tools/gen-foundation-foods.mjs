// Ports the bundled food datasets into hardcoded, ROM-banked C tables.
//
// Two datasets are emitted, each into its own 16 KB ROM bank because neither the
// combined set nor the common set on its own fits a single bank:
//   - data/usda_foundation_foods.json -> foundation_foods.{c,h}  (bank 2, ~10 KB)
//   - data/common_foundation_foods.json -> common_foods.{c,h}    (bank 3, ~8 KB)
//
// For every food only the fields the tracker needs are kept, all per 100 g:
//   - name (USDA uses the generic `description`, e.g. "Lettuce, leaf, green, raw";
//     the common set uses `name`, e.g. "Pizza Margherita", as its `description`
//     is a verbose sentence)
//   - energy (kcal)
//   - protein, total fat, carbohydrate, fiber (grams)
//
// Macros are stored as decigrams (0.1 g resolution) in uint16 to keep the tables
// compact while preserving one decimal of precision; energy is stored as whole kcal
// in uint16. Both tables share the foundation_food_t struct (defined in
// foundation_foods.h); common_foods.h includes it for the type.
//
// food_db.c reads both tables behind a single global index space: USDA occupies
// indices 0..FOUNDATION_FOOD_COUNT-1 and the common set is appended after it, so
// existing food-log references into the USDA range stay stable.
//
// The generated files are committed so the ROM build does not depend on the app
// seed JSON. Re-run with `npm run gb:gen-foods` if a dataset changes.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..', '..');
const dataDir = join(repoRoot, 'data');
const outDir = join(repoRoot, 'gameboy', 'src');

// Escape a name for a C string literal.
function cString(name) {
    return name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

const MAX_KCAL_PER_100G = 950;
const MAX_GRAMS_PER_100G = 100;

const numberFromField = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
};
const decigrams = (g) => Math.max(0, Math.round((g ?? 0) * 10));

function validFoodRow(food, nameField) {
    const name = food[nameField];
    const kcal = numberFromField(food.kcal);
    const protein = numberFromField(food.protein);
    const fat = numberFromField(food.fat);
    const carbs = numberFromField(food.carbs);
    const fiber = numberFromField(food.fiber);
    const reasons = [];

    if (typeof name !== 'string' || name.trim().length === 0) reasons.push('missing name');
    for (const [field, value] of [
        ['kcal', kcal],
        ['protein', protein],
        ['fat', fat],
        ['carbs', carbs],
        ['fiber', fiber],
    ]) {
        if (value === undefined) reasons.push(`missing ${field}`);
        else if (value < 0) reasons.push(`negative ${field}`);
    }

    if (reasons.length === 0) {
        if (kcal > MAX_KCAL_PER_100G) reasons.push(`kcal > ${MAX_KCAL_PER_100G}`);
        for (const [field, value] of [
            ['protein', protein],
            ['fat', fat],
            ['carbs', carbs],
            ['fiber', fiber],
        ]) {
            if (value > MAX_GRAMS_PER_100G) reasons.push(`${field} > ${MAX_GRAMS_PER_100G}g`);
        }
        if (fiber > carbs) reasons.push('fiber > carbs');
        if (kcal === 0 && protein === 0 && fat === 0 && carbs === 0 && fiber === 0) {
            reasons.push('empty macro row');
        }
    }

    return {
        ok: reasons.length === 0,
        reasons,
        row: {
            name: cString(String(name ?? '')),
            kcal: Math.round(kcal ?? 0),
            protein: decigrams(protein),
            fat: decigrams(fat),
            carbs: decigrams(carbs),
            fiber: decigrams(fiber),
        },
    };
}

function toRows(foods, nameField, srcName) {
    const rows = [];
    const skipped = [];

    foods.forEach((food, index) => {
        const result = validFoodRow(food, nameField);
        if (result.ok) rows.push(result.row);
        else skipped.push({
            index,
            name: food[nameField] || food.description || food.name || '<unnamed>',
            reasons: result.reasons,
        });
    });

    if (skipped.length > 0) {
        console.warn(`Quarantined ${skipped.length} invalid rows from ${srcName}:`);
        for (const item of skipped) {
            console.warn(`  [${item.index}] ${item.name}: ${item.reasons.join(', ')}`);
        }
    }

    return rows;
}

function rowLiterals(rows) {
    return rows
        .map((r) => `    { "${r.name}", ${r.kcal}u, ${r.protein}u, ${r.fat}u, ${r.carbs}u, ${r.fiber}u },`)
        .join('\n');
}

// Emit a .{c,h} pair for one dataset.
//   srcName     basename of the source JSON (for provenance comments)
//   nameField   JSON field used as the displayed name
//   array       C array symbol name
//   countMacro  preprocessor count macro (e.g. FOUNDATION_FOOD_COUNT)
//   bankMacro   preprocessor bank macro (e.g. FOUNDATION_FOODS_BANK)
//   bank        ROM bank number
//   guard       header include guard
//   base        output basename (e.g. "foundation_foods")
//   defineStruct  true for the file that owns the foundation_food_t typedef
function emitDataset({ srcName, nameField, array, countMacro, bankMacro, bank, guard, base, defineStruct }) {
    const srcJson = join(dataDir, srcName);
    console.log(`Reading ${srcJson} ...`);
    const rows = toRows(JSON.parse(readFileSync(srcJson, 'utf8')), nameField, srcName);
    const count = rows.length;

    const structBlock = defineStruct
        ? `/* One bundled food, all values per 100 g.
 * Macros are decigrams (0.1 g resolution); energy is whole kcal. */
typedef struct {
    const char *name;
    uint16_t kcal;        /* energy, kcal */
    uint16_t protein_dg;  /* protein, decigrams (0.1 g) */
    uint16_t fat_dg;      /* total fat, decigrams (0.1 g) */
    uint16_t carbs_dg;    /* carbohydrate by difference, decigrams (0.1 g) */
    uint16_t fiber_dg;    /* dietary fiber, decigrams (0.1 g) */
} foundation_food_t;
`
        : `#include "foundation_foods.h" /* for foundation_food_t */
`;

    const header = `/* Auto-generated by gameboy/tools/gen-foundation-foods.mjs — do not edit by hand. */
/* Source: data/${srcName}. */
#ifndef ${guard}
#define ${guard}

#include <stdint.h>

${structBlock}
#define ${countMacro} ${count}u

/* The table and its name strings live in this ROM bank. Callers must
 * SWITCH_ROM(${bankMacro}) before dereferencing the array. */
#define ${bankMacro} ${bank}

extern const foundation_food_t ${array}[${countMacro}];

#endif /* ${guard} */
`;

    const body = `/* Auto-generated by gameboy/tools/gen-foundation-foods.mjs — do not edit by hand. */
/* Source: data/${srcName}. */
#pragma bank ${bank}
#include "${base}.h"

const foundation_food_t ${array}[${countMacro}] = {
${rowLiterals(rows)}
};
`;

    writeFileSync(join(outDir, `${base}.h`), header);
    writeFileSync(join(outDir, `${base}.c`), body);
    console.log(`Wrote ${base}.{c,h} (${count} foods, bank ${bank}).`);
    return count;
}

const usdaCount = emitDataset({
    srcName: 'usda_foundation_foods.json',
    nameField: 'description',
    array: 'foundation_foods',
    countMacro: 'FOUNDATION_FOOD_COUNT',
    bankMacro: 'FOUNDATION_FOODS_BANK',
    bank: 2,
    guard: 'FOUNDATION_FOODS_H',
    base: 'foundation_foods',
    defineStruct: true,
});

const commonCount = emitDataset({
    srcName: 'common_foundation_foods.json',
    nameField: 'name',
    array: 'common_foods',
    countMacro: 'COMMON_FOOD_COUNT',
    bankMacro: 'COMMON_FOODS_BANK',
    bank: 3,
    guard: 'COMMON_FOODS_H',
    base: 'common_foods',
    defineStruct: false,
});

console.log(`Done: ${usdaCount + commonCount} foods total (USDA ${usdaCount} + common ${commonCount}).`);
