#!/usr/bin/env node

/**
 * Fetch raw sample responses from the nutrition APIs used by the app.
 *
 * Usage:
 *   node scripts/test-api-endpoints.js
 *
 * Output:
 *   scripts/api-samples/*.json
 */

const fs = require('node:fs/promises');
const path = require('node:path');

require('dotenv/config');

const SEARCH_TERM = 'egg';
const BARCODES = ['7613035648494'];
const USDA_FOOD_IDS = ['2575290'];
const OUTPUT_DIR = path.join(__dirname, 'api-samples');
const USDA_API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY || process.env.USDA_API_KEY || '';
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const OFF_SEARCH_FIELDS = [
  'code',
  'product_name',
  'brands',
  'generic_name',
  'nutriments',
  'serving_size',
  'categories',
  'image_url',
  'image_small_url',
].join(',');

function slug(value) {
  return String(value).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeJson(fileName, payload) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, fileName);
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  return filePath;
}

function redactUrl(url) {
  const parsedUrl = new URL(url);
  if (parsedUrl.searchParams.has('api_key')) {
    parsedUrl.searchParams.set('api_key', USDA_API_KEY ? '<redacted>' : '');
  }
  return parsedUrl.toString();
}

async function fetchJson(label, url, options = {}, attempt = 1) {
  const startedAt = new Date().toISOString();

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    const result = {
      label,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url: redactUrl(url),
      fetchedAt: startedAt,
      body,
    };

    if (!result.ok && RETRYABLE_STATUSES.has(response.status) && attempt < 3) {
      await delay(750 * attempt);
      return fetchJson(label, url, options, attempt + 1);
    }

    return result;
  } catch (error) {
    if (attempt < 3) {
      await delay(750 * attempt);
      return fetchJson(label, url, options, attempt + 1);
    }

    return {
      label,
      ok: false,
      status: null,
      statusText: 'Fetch failed',
      url: redactUrl(url),
      fetchedAt: startedAt,
      error: {
        name: error.name,
        message: error.message,
      },
    };
  }
}

function offSearchUrl() {
  const params = new URLSearchParams({
    search_terms: SEARCH_TERM,
    json: '1',
    page_size: '20',
    page: '1',
    fields: OFF_SEARCH_FIELDS,
  });

  return `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`;
}

function usdaSearchUrl() {
  const params = new URLSearchParams({
    query: SEARCH_TERM,
    pageSize: '20',
    pageNumber: '1',
    api_key: USDA_API_KEY,
  });

  return `https://api.nal.usda.gov/fdc/v1/foods/search?${params.toString()}`;
}

function offBarcodeUrl(barcode) {
  return `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(barcode)}`;
}

function usdaFoodDetailsUrl(foodId) {
  const params = new URLSearchParams({
    api_key: USDA_API_KEY,
  });

  return `https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(foodId)}?${params.toString()}`;
}

function musclogBarcodeUrl(barcode) {
  return `https://api.musclog.app/barcodes/${encodeURIComponent(barcode)}.json`;
}

async function runRequest({ label, fileName, url }) {
  process.stdout.write(`Fetching ${label}...\n`);
  const result = await fetchJson(label, url);
  const filePath = await writeJson(fileName, result.body ?? { error: result.error ?? null });
  process.stdout.write(`Saved ${filePath} (${result.status ?? 'error'})\n`);
  return result;
}

async function main() {
  if (!USDA_API_KEY) {
    process.stdout.write(
      'No EXPO_PUBLIC_USDA_API_KEY or USDA_API_KEY found. USDA responses may be rejected.\n'
    );
  }

  const requests = [
    {
      label: `OFF search "${SEARCH_TERM}"`,
      fileName: `off-search-${slug(SEARCH_TERM)}.json`,
      url: offSearchUrl(),
    },
    {
      label: `USDA search "${SEARCH_TERM}"`,
      fileName: `usda-search-${slug(SEARCH_TERM)}.json`,
      url: usdaSearchUrl(),
    },
  ];

  for (const barcode of BARCODES) {
    requests.push(
      {
        label: `OFF barcode ${barcode}`,
        fileName: `off-barcode-${barcode}.json`,
        url: offBarcodeUrl(barcode),
      },
      {
        label: `Musclog barcode ${barcode}`,
        fileName: `musclog-barcode-${barcode}.json`,
        url: musclogBarcodeUrl(barcode),
      }
    );
  }

  for (const foodId of USDA_FOOD_IDS) {
    requests.push({
      label: `USDA food details ${foodId}`,
      fileName: `usda-food-${foodId}.json`,
      url: usdaFoodDetailsUrl(foodId),
    });
  }

  const results = [];
  for (const request of requests) {
    results.push(await runRequest(request));
  }

  const summary = results.map((result) => ({
    label: result.label,
    ok: result.ok,
    status: result.status,
    url: result.url,
  }));

  await writeJson('summary.json', summary);
  process.stdout.write(`Done. Wrote ${results.length} responses to ${OUTPUT_DIR}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
