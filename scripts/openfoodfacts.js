import fs from 'node:fs/promises';

const BARCODE = '3073781195972';
const SEARCH_TERM = 'La Vache';
// OFF requests a descriptive User-Agent to avoid being throttled
const HEADERS = {
  'User-Agent': 'MyStudyApp/1.0 (contact@example.com)',
};

const endpoints = {
  // V1: The legacy standard. Often uses /api/v0/ in the URL.
  v1_fetch: `https://world.openfoodfacts.org/api/v0/product/${BARCODE}.json`,
  v1_search: `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(SEARCH_TERM)}&json=1&page_size=5`,

  // V2: Introduced better field filtering and some structural changes.
  v2_fetch: `https://world.openfoodfacts.org/api/v2/product/${BARCODE}.json`,
  v2_search: `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(SEARCH_TERM)}&json=2&page_size=5`,

  // V3: The modern RESTful API. cleaner JSON structure and better error handling.
  v3_fetch: `https://world.openfoodfacts.org/api/v3/product/${BARCODE}`,
  v3_search: `https://world.openfoodfacts.org/api/v3/search?search_terms=${encodeURIComponent(SEARCH_TERM)}&page_size=5`,
};

async function studyApis() {
  const results = {};

  for (const [key, url] of Object.entries(endpoints)) {
    console.log(`Fetching ${key}...`);
    try {
      const response = await fetch(url, { headers: HEADERS });

      if (!response.ok) {
        results[key] = { error: `HTTP ${response.status}`, url };
        continue;
      }

      const data = await response.json();
      results[key] = {
        url,
        // We store the full data, but you'll notice V3 wraps things in a "product" or "products" key
        data: data,
      };
    } catch (err) {
      results[key] = { error: err.message, url };
    }
  }

  await fs.writeFile('off_comparison.json', JSON.stringify(results, null, 2));
  console.log('\nDone! Results saved to off_comparison.json');
}

studyApis();
