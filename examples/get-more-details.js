const fs = require('fs').promises;

// Configuration
const OUTPUT_FILE = 'enriched_products.json';
const BASE_URL = 'https://world.openfoodfacts.org/api/v0/product/';

async function enrichProductData() {
  try {
    // 1. Load the local JSON file
    console.log(`Reading json...`);
    const data = await fs.readFile('./examples/openFoodSearch.json', 'utf8');
    const jsonData = JSON.parse(data);
    const products = jsonData.products || [];

    const enrichedResults = [];

    console.log(`Starting enrichment for ${products.length} products...`);

    // 2. Map through the products and fetch API data
    // Using a for...of loop to avoid overwhelming the API and handle errors gracefully
    for (const product of products) {
      const code = product.code;
      if (!code) continue;

      const url = `${BASE_URL}${code}.json`;
      console.log(`Fetching details for: ${code}...`);

      try {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const apiResult = await response.json();

        // Push the result into our array
        enrichedResults.push({
          original_data: product,
          api_details: apiResult,
        });
      } catch (fetchError) {
        console.error(`Failed to fetch code ${code}:`, fetchError.message);
        // Optional: save the product anyway with an error flag
        enrichedResults.push({
          original_data: product,
          api_details: null,
          error: fetchError.message,
        });
      }
    }

    // 3. Save the final array to a new JSON file
    const outputContent = JSON.stringify(enrichedResults, null, 2);
    await fs.writeFile(OUTPUT_FILE, outputContent);

    console.log('------------------------------------------');
    console.log(`Success! Enriched data saved to ${OUTPUT_FILE}`);
    console.log(`Total products processed: ${enrichedResults.length}`);
  } catch (error) {
    console.error('Critical Error:', error.message);
  }
}

// Run the script
enrichProductData();
