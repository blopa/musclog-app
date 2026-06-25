#!/usr/bin/env node
/* eslint-disable no-undef */

const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const INPUT_FILE = path.join(ROOT_DIR, 'data/common_foods.json');
const OUTPUT_FILE = path.join(ROOT_DIR, 'data/common_foods_filled.json');
const ERROR_FILE = path.join(ROOT_DIR, 'data/common_food_error.txt');

const DEFAULT_DELAY_MS = 6500;
const PRODUCT_FIELDS = [
  'code',
  'product_name',
  'generic_name',
  'brands',
  'categories',
  'serving_size',
  'nutriments',
  'nutrition_data',
  'nutrition_data_per',
];
const SEARCH_FIELDS = PRODUCT_FIELDS.join(',');

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

function sdkFetch(url, init) {
  if (!process.env.OFF_USER_AGENT) {
    return fetch(url, init);
  }

  const headers = new Headers(init?.headers);
  headers.set('User-Agent', process.env.OFF_USER_AGENT);
  return fetch(url, {
    ...init,
    headers,
  });
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

function productFromHit(hit) {
  if (!hit || typeof hit !== 'object') {
    return null;
  }

  if (hit.product && typeof hit.product === 'object') {
    return hit.product;
  }

  if (hit._source && typeof hit._source === 'object') {
    return hit._source;
  }

  return hit;
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

async function searchFirstProduct(searchClient, productClient, foodName) {
  const { data, error, response } = await searchClient.searchGet({
    q: foodName,
    langs: 'en,es,it,pt,nl',
    page: 1,
    page_size: 1,
    fields: SEARCH_FIELDS,
  });

  if (error) {
    throw new Error(`Search API error: ${JSON.stringify(error)}`);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    throw new Error(data.errors.map((item) => item.title || item.description).join('; '));
  }

  const hit = Array.isArray(data?.hits) ? data.hits[0] : null;
  const hitProduct = productFromHit(hit);
  const code = hitProduct?.code ? String(hitProduct.code) : '';

  if (!code) {
    return hitProduct;
  }

  try {
    const detailResult = await productClient.getProductV3(code, {
      fields: PRODUCT_FIELDS,
    });
    const detailProduct = detailResult.data?.product;
    return detailProduct && typeof detailProduct === 'object' ? detailProduct : hitProduct;
  } catch {
    return hitProduct;
  }
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
  const { OpenFoodFacts, SearchApi } = await import('@openfoodfacts/openfoodfacts-nodejs');
  const searchClient = new SearchApi(sdkFetch);
  const productClient = new OpenFoodFacts(sdkFetch);

  if (!process.env.OFF_USER_AGENT) {
    process.stdout.write('Tip: set OFF_USER_AGENT if you want a custom contact User-Agent.\n');
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
      const product = await searchFirstProduct(searchClient, productClient, foodName);
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
