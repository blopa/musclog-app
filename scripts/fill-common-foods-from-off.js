#!/usr/bin/env node
/* eslint-disable no-undef */

const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const INPUT_FILE = path.join(ROOT_DIR, 'data/common_foods.json');
const OUTPUT_FILE = path.join(ROOT_DIR, 'data/common_foods_filled.json');
const ERROR_FILE = path.join(ROOT_DIR, 'data/common_food_error.txt');

const DEFAULT_DELAY_MS = 6500;
const USER_AGENT =
  process.env.OFF_USER_AGENT ||
  'MusclogCommonFoodsFiller/1.0 (local script; set OFF_USER_AGENT with contact)';
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const SEARCH_FIELDS = [
  'code',
  'product_name',
  'generic_name',
  'brands',
  'categories',
  'serving_size',
  'nutriments',
  'nutrition_data',
  'nutrition_data_per',
].join(',');

const MACRO_BASE_NAMES = new Set(['fat', 'fiber', 'carbohydrates', 'proteins']);
const NON_MICRO_BASE_NAMES = new Set([
  ...MACRO_BASE_NAMES,
  'energy',
  'energy-kcal',
  'energy-kj',
  'nova-group',
  'nutrition-score-fr',
  'nutrition-score-uk',
]);

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

function numericOption(name, envName, fallback) {
  const raw = argValue(name) ?? process.env[envName];
  if (raw === undefined || raw === '') {
    return fallback;
  }

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function searchUrl(foodName) {
  const params = new URLSearchParams({
    search_terms: foodName,
    search_simple: '1',
    action: 'process',
    json: '1',
    page: '1',
    page_size: '1',
    fields: SEARCH_FIELDS,
  });

  return `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`;
}

async function fetchJson(url, attempt = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return body;
  } catch (error) {
    if (RETRYABLE_STATUSES.has(error.status) && attempt < 3) {
      await delay(1000 * attempt);
      return fetchJson(url, attempt + 1);
    }

    if (error.name === 'AbortError' && attempt < 3) {
      await delay(1000 * attempt);
      return fetchJson(url, attempt + 1);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function nutrientFrom(nutriments, baseName) {
  const value =
    parseNumber(nutriments[`${baseName}_100g`]) ??
    parseNumber(nutriments[baseName]) ??
    parseNumber(nutriments[`${baseName}_value`]);

  if (value === null) {
    return null;
  }

  const unit =
    typeof nutriments[`${baseName}_unit`] === 'string' ? nutriments[`${baseName}_unit`] : '';
  return { value, unit };
}

function isMicroBaseName(baseName) {
  if (NON_MICRO_BASE_NAMES.has(baseName)) {
    return false;
  }

  if (
    baseName.includes('estimate-from-ingredients') ||
    baseName.startsWith('fruits-vegetables-') ||
    baseName.startsWith('carbon-footprint')
  ) {
    return false;
  }

  return true;
}

function extractMicrosPer100g(nutriments) {
  const micros = {};
  const baseNames = Object.keys(nutriments)
    .filter((key) => key.endsWith('_100g'))
    .map((key) => key.slice(0, -5))
    .filter(isMicroBaseName)
    .sort();

  for (const baseName of baseNames) {
    const nutrient = nutrientFrom(nutriments, baseName);
    if (nutrient) {
      micros[baseName] = nutrient;
    }
  }

  return micros;
}

function buildFilledFood(food, product) {
  const nutriments = product.nutriments;
  if (!nutriments || typeof nutriments !== 'object') {
    return null;
  }

  const macrosPer100g = {
    fats: nutrientFrom(nutriments, 'fat'),
    fiber: nutrientFrom(nutriments, 'fiber'),
    carbs: nutrientFrom(nutriments, 'carbohydrates'),
    protein: nutrientFrom(nutriments, 'proteins'),
  };

  const hasMacro = Object.values(macrosPer100g).some(Boolean);
  if (!hasMacro) {
    return null;
  }

  const code = product.code ? String(product.code) : '';

  return {
    ...food,
    openFoodFacts: {
      code: code || null,
      productName: product.product_name || product.generic_name || null,
      genericName: product.generic_name || null,
      brands: product.brands || null,
      categories: product.categories || null,
      servingSize: product.serving_size || null,
      nutritionDataPer: product.nutrition_data_per || null,
      url: code ? `https://world.openfoodfacts.org/product/${code}` : null,
    },
    macrosPer100g,
    microsPer100g: extractMicrosPer100g(nutriments),
  };
}

async function writeOutputs(filledFoods, errorNames) {
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(filledFoods, null, 2)}\n`);
  await fs.writeFile(ERROR_FILE, errorNames.length ? `${errorNames.join('\n')}\n` : '');
}

async function main() {
  const rawFoods = await fs.readFile(INPUT_FILE, 'utf8');
  const foods = JSON.parse(rawFoods);

  if (!Array.isArray(foods)) {
    throw new Error(`${INPUT_FILE} must contain a JSON array`);
  }

  const delayMs = numericOption('delay-ms', 'OFF_DELAY_MS', DEFAULT_DELAY_MS);
  const limit = numericOption('limit', 'OFF_LIMIT', foods.length);
  const foodsToProcess = foods.slice(0, limit);
  const filledFoods = [];
  const errorNames = [];

  if (!process.env.OFF_USER_AGENT) {
    process.stdout.write('Tip: set OFF_USER_AGENT to identify yourself to Open Food Facts.\n');
  }

  process.stdout.write(
    `Loading ${foodsToProcess.length} foods from ${path.relative(ROOT_DIR, INPUT_FILE)}...\n`
  );
  await writeOutputs(filledFoods, errorNames);

  for (let index = 0; index < foodsToProcess.length; index += 1) {
    const food = foodsToProcess[index];
    const foodName = food && typeof food.name === 'string' ? food.name : '';

    if (!foodName) {
      continue;
    }

    process.stdout.write(`[${index + 1}/${foodsToProcess.length}] Searching ${foodName}...\n`);

    try {
      const data = await fetchJson(searchUrl(foodName));
      const product = Array.isArray(data?.products) ? data.products[0] : null;
      const filledFood = product ? buildFilledFood(food, product) : null;

      if (filledFood) {
        filledFoods.push(filledFood);
      } else {
        errorNames.push(foodName);
      }
    } catch (error) {
      process.stderr.write(`Failed ${foodName}: ${error.message}\n`);
      errorNames.push(foodName);
    }

    await writeOutputs(filledFoods, errorNames);

    if (index < foodsToProcess.length - 1 && delayMs > 0) {
      await delay(delayMs);
    }
  }

  process.stdout.write(
    `Saved ${filledFoods.length} foods to ${path.relative(ROOT_DIR, OUTPUT_FILE)}.\n`
  );
  process.stdout.write(
    `Saved ${errorNames.length} errors to ${path.relative(ROOT_DIR, ERROR_FILE)}.\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
