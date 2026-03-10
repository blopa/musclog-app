const fs = require('fs');

const API_KEY = 'THEKEY';
const INPUT_FILE = '../data/usda/FoundationFoods.json';
const OUTPUT_FILE = './robust_comparison_results.csv';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const simplifyName = (name) => name.split(',')[0].trim();
const escapeCSV = (str) => `"${str.replace(/"/g, '""')}"`;

// CONFIGURATION
const SEARCH_LIMIT = 200; // How many branded items to check per generic food
const TOLERANCE = 2; // Grams difference allowed (1.1 to be safe with rounding)
const CAL_TOLERANCE = 25; // Calories difference allowed

const NUTRIENTS_TO_TRACK = [
  { header: 'kcal', match: ['energy'] },
  { header: 'Prot(g)', match: ['protein'] },
  { header: 'Carb(g)', match: ['carbohydrate, by difference'] },
  { header: 'Fat(g)', match: ['total lipid (fat)'] },
  { header: 'Fiber(g)', match: ['fiber, total dietary'] },
  { header: 'Sugar(g)', match: ['sugars, total'] },
  { header: 'Sodium(mg)', match: ['sodium, na'] },
  { header: 'Magnesium(mg)', match: ['magnesium, mg'] },
  { header: 'Vit C(mg)', match: ['vitamin c, total ascorbic acid'] },
  { header: 'Vit D(mcg)', match: ['vitamin d (d2 + d3)', 'vitamin d'] },
];

const extractNutrients = (nutrientsArray) => {
  let data = {};
  NUTRIENTS_TO_TRACK.forEach((n) => (data[n.header] = 0));
  if (!nutrientsArray) {
    return data;
  }

  nutrientsArray.forEach((n) => {
    const name = (n.nutrient?.name || n.nutrientName || '').toLowerCase();
    const amount = n.amount ?? n.value ?? 0;
    const unit = n.nutrient?.unitName || n.unitName || '';
    NUTRIENTS_TO_TRACK.forEach((trackedItem) => {
      if (trackedItem.header === 'kcal' && name.includes('energy') && unit !== 'kcal') {
        return;
      }

      if (trackedItem.match.some((m) => name.includes(m))) {
        data[trackedItem.header] = amount;
      }
    });
  });

  return data;
};

async function runRobustBarcoder() {
  const rawData = fs.readFileSync(INPUT_FILE, 'utf8');
  const foodsArray = JSON.parse(rawData).FoundationFoods || [];

  let headers = ['Fnd ID', 'Fnd Name', 'Brnd ID', 'Brnd Name', 'Barcode', 'Match Quality'];
  NUTRIENTS_TO_TRACK.forEach((n) => {
    headers.push(`Fnd ${n.header}`, `Brnd ${n.header}`);
  });
  let csvContent = headers.join(',') + '\n';

  for (let i = 0; i < foodsArray.length; i++) {
    const fndFood = foodsArray[i];
    const searchTerm = simplifyName(fndFood.description);
    const fndN = extractNutrients(fndFood.foodNutrients);

    let bestMatch = null;
    let minDiff = Infinity;

    try {
      const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchTerm, dataType: ['Branded'], pageSize: SEARCH_LIMIT }),
      });
      const result = await res.json();

      if (result.foods) {
        for (const brndFood of result.foods) {
          const brndN = extractNutrients(brndFood.foodNutrients);

          // Calculate individual differences
          const dCal = Math.abs(fndN['kcal'] - brndN['kcal']);
          const dProt = Math.abs(fndN['Prot(g)'] - brndN['Prot(g)']);
          const dCarb = Math.abs(fndN['Carb(g)'] - brndN['Carb(g)']);
          const dFat = Math.abs(fndN['Fat(g)'] - brndN['Fat(g)']);

          // THE ROBUST FILTER: Must be within tolerance for ALL 4 core values
          if (
            // dCal <= CAL_TOLERANCE &&
            dProt <= TOLERANCE &&
            dCarb <= TOLERANCE &&
            dFat <= TOLERANCE
          ) {
            const totalDiff = dCal + dProt + dCarb + dFat;
            if (totalDiff < minDiff) {
              minDiff = totalDiff;
              bestMatch = { food: brndFood, nutrients: brndN, diff: totalDiff };
            }
          }
        }
      }
    } catch (e) {
      console.error(`Error searching ${searchTerm}`);
    }

    const row = [
      fndFood.fdcId,
      escapeCSV(fndFood.description),
      bestMatch ? bestMatch.food.fdcId : '',
      bestMatch ? escapeCSV(bestMatch.food.description) : 'NO MATCH FOUND',
      bestMatch ? bestMatch.food.gtinUpc : '',
      bestMatch ? `Diff: ${bestMatch.diff.toFixed(2)}` : 'N/A',
    ];

    NUTRIENTS_TO_TRACK.forEach((n) => {
      row.push(fndN[n.header]);
      row.push(bestMatch ? bestMatch.nutrients[n.header] : 0);
    });

    csvContent += row.join(',') + '\n';
    console.log(
      `[${i + 1}/${foodsArray.length}] ${searchTerm} -> ${bestMatch ? 'Matched!' : 'Skipped (No precise macro match)'}`
    );

    await delay(500);
  }

  fs.writeFileSync(OUTPUT_FILE, csvContent);
  console.log(`\nDone! Saved to ${OUTPUT_FILE}`);
}

runRobustBarcoder();
