#!/usr/bin/env node
/* eslint-disable no-undef */

const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const INPUT_FILE = path.join(ROOT_DIR, 'data/common_foods_filled.json');
const OUTPUT_FILE = path.join(ROOT_DIR, 'data/common_foundation_foods.json');

const CALORIES_FOR_PROTEIN = 4;
const CALORIES_FOR_CARBS = 4;
const CALORIES_FOR_FAT = 9;
const CALORIES_FOR_FIBER = 2;
const ROUNDING_DECIMALS = 6;

function parseNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function nutrientValue(nutrient) {
  if (!nutrient || typeof nutrient !== 'object') {
    return 0;
  }

  return Math.max(0, parseNumber(nutrient.value));
}

function macroValue(food, key) {
  return nutrientValue(food.macrosPer100g?.[key]);
}

function microValue(food, key) {
  return nutrientValue(food.microsPer100g?.[key]);
}

function totalCarbsFromOpenFoodFacts(carbs, fiber) {
  // common_foods_filled.json does not retain label energy or carbohydrates-total,
  // so use the app's OFF fallback: treat ambiguous carbohydrates as EU-style net carbs.
  return carbs + fiber;
}

function inferCalories(protein, carbs, fat, fiber) {
  const digestibleCarbs = Math.max(0, carbs - fiber);

  return (
    CALORIES_FOR_PROTEIN * protein +
    CALORIES_FOR_CARBS * digestibleCarbs +
    CALORIES_FOR_FAT * fat +
    CALORIES_FOR_FIBER * fiber
  );
}

function formatNumber(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0';
  }

  const factor = 10 ** ROUNDING_DECIMALS;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function slugify(value) {
  const slug = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'food';
}

function descriptionFor(food) {
  const candidates = [
    food.description,
    food.openFoodFacts?.genericName,
    food.openFoodFacts?.categories,
    food.openFoodFacts?.productName,
  ];

  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function toFoundationFood(food, index) {
  const rawCarbs = macroValue(food, 'carbs');
  const fiber = macroValue(food, 'fiber');
  const carbs = totalCarbsFromOpenFoodFacts(rawCarbs, fiber);
  const protein = macroValue(food, 'protein');
  const fat = macroValue(food, 'fats');
  const sugar = microValue(food, 'sugars');
  const sodium = microValue(food, 'sodium');
  const magnesium = microValue(food, 'magnesium');
  const vitaminC = microValue(food, 'vitamin-c');
  const vitaminD = microValue(food, 'vitamin-d');
  const barcode = food.openFoodFacts?.code ? String(food.openFoodFacts.code) : '';
  const name =
    typeof food.name === 'string' && food.name.trim()
      ? food.name.trim()
      : food.openFoodFacts?.productName || `Common food ${index + 1}`;

  return {
    barcode,
    description: descriptionFor(food),
    external_id: `common:${slugify(name)}`,
    name,
    kcal: formatNumber(inferCalories(protein, carbs, fat, fiber)),
    protein: formatNumber(protein),
    carbs: formatNumber(carbs),
    fat: formatNumber(fat),
    fiber: formatNumber(fiber),
    sugar: formatNumber(sugar),
    sodium: formatNumber(sodium),
    magnesium: formatNumber(magnesium),
    vitamin_c: formatNumber(vitaminC),
    vitamin_d: formatNumber(vitaminD),
    sodium_mg: formatNumber(sodium * 1000),
  };
}

async function main() {
  const raw = await fs.readFile(INPUT_FILE, 'utf8');
  const foods = JSON.parse(raw);

  if (!Array.isArray(foods)) {
    throw new Error(`${path.relative(ROOT_DIR, INPUT_FILE)} must contain a JSON array`);
  }

  const foundationFoods = foods.map(toFoundationFood);
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(foundationFoods, null, 2)}\n`);

  process.stdout.write(
    `Wrote ${foundationFoods.length} foods to ${path.relative(ROOT_DIR, OUTPUT_FILE)}.\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
