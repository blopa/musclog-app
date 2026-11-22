// Fetches a sample of Nutrition5k overhead RGB images + gold macros over plain HTTPS (no gsutil, no auth).
// Data: Nutrition5k, Google Research (Thames et al., CVPR 2021), CC BY 4.0. See fetch-dataset.md for attribution.
//   tsx scripts/fetch-nutrition5k.ts --n 10          (default 10; 60 for the real G6 run)
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, parseArgs } from './lib/core.ts';

const BASE = 'https://storage.googleapis.com/nutrition5k_dataset/nutrition5k_dataset';
const a = parseArgs();
const n = a.num('n', 10);
const seed = a.num('seed', 5);
const dir = join(ROOT, 'data', 'nutrition5k');
mkdirSync(join(dir, 'images'), { recursive: true });

function rng(s: number) {
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

const csv = await (await fetch(`${BASE}/metadata/dish_metadata_cafe1.csv`)).text();
const rgbTest = new Set(
  (await (await fetch(`${BASE}/dish_ids/splits/rgb_test_ids.txt`)).text())
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
);
type Dish = {
  id: string;
  kcal: number;
  mass: number;
  fat: number;
  carb: number;
  protein: number;
  ingrs: number;
};
const dishes: Dish[] = [];
for (const line of csv.split('\n')) {
  const c = line.split(',');
  if (c.length < 13 || !c[0].startsWith('dish_')) continue;
  // The published CSV has NO num_ingrs column (the README lists one): columns are
  // dish_id, total_calories, total_mass, total_fat, total_carb, total_protein, then 7 fields per ingredient.
  const d = {
    id: c[0],
    kcal: +c[1],
    mass: +c[2],
    fat: +c[3],
    carb: +c[4],
    protein: +c[5],
    ingrs: Math.floor((c.length - 6) / 7),
  };
  // Meal-sized dishes only (the app logs meals, not a single garnish); official RGB test split avoids train-set bias.
  if (rgbTest.has(d.id) && d.kcal >= 150 && d.kcal <= 1200 && d.mass >= 120 && d.ingrs >= 2)
    dishes.push(d);
}
const r = rng(seed);
dishes.sort(() => r() - 0.5);
const manifest: any[] = [];
for (const d of dishes) {
  if (manifest.length >= n) break;
  const res = await fetch(`${BASE}/imagery/realsense_overhead/${d.id}/rgb.png`);
  if (!res.ok) continue; // overhead images exist only for part of the dishes
  const file = `images/${d.id}.png`;
  if (!existsSync(join(dir, file)))
    writeFileSync(join(dir, file), Buffer.from(await res.arrayBuffer()));
  manifest.push({
    image: `nutrition5k/${file}`,
    kcal: d.kcal,
    protein: d.protein,
    carbs: d.carb,
    fat: d.fat,
    grams: d.mass,
    kind: 'plated',
    source: `Nutrition5k ${d.id} (CC BY 4.0, Google Research)`,
  });
}
writeFileSync(join(ROOT, 'data', 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(
  `wrote ${manifest.length} dishes to data/manifest.json (images under data/nutrition5k/images)`
);
