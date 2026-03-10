const fs = require('fs');

// 1. Point this to the file you downloaded from the USDA
const INPUT_FILE = '../data/usda/FoundationFoods.json';
const OUTPUT_FILE = '../data/usda/app_database.json';

console.log('Reading USDA database... (This might take a moment for large files)');
const rawData = fs.readFileSync(INPUT_FILE, 'utf8');
const parsedData = JSON.parse(rawData);

// The USDA nests the array under a key named after the dataset.
// This handles Foundation, SR Legacy, or Branded formats.
const foodsArray =
  parsedData.FoundationFoods || parsedData.SRLegacyFoods || parsedData.BrandedFoods || parsedData;

console.log(`Found ${foodsArray.length} foods. Cleaning data...`);

const cleanDatabase = foodsArray.map((food) => {
  const nutrients = {};

  // 2. Loop through and grab every macro and micro nutrient
  if (food.foodNutrients) {
    food.foodNutrients.forEach((n) => {
      // Account for slight schema variations between USDA datasets
      const nutrientName = n.nutrient?.name || n.nutrientName;
      const amount = n.amount ?? n.value ?? 0;
      const unit = n.nutrient?.unitName || n.unitName || '';

      if (nutrientName) {
        // Saves it as "Protein: 25 g" or "Vitamin C: 12 mg"
        nutrients[nutrientName] = `${amount} ${unit}`.trim();
      }
    });
  }

  // 3. Return the clean, simplified object
  return {
    id: food.fdcId,
    name: food.description,
    // Grabs the barcode if it's a Branded food, otherwise null
    barcode: food.gtinUpc || null,
    nutrients: nutrients,
  };
});

// 4. Save the new, lightweight JSON file
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cleanDatabase, null, 2));

console.log(`Success! Saved clean database to ${OUTPUT_FILE}`);
