# Fetching the G6 photo set

## Nutrition5k (plated meals, gold macros)

- **Source:** Nutrition5k, Google Research (Thames et al., CVPR 2021). https://github.com/google-research-datasets/Nutrition5k
- **License (verified, README):** "We release all Nutrition5k data under the Creative Commons V4.0 license. You are free to share and adapt this data for any purpose, even commercially." The README links https://creativecommons.org/licenses/by/4.0/, so this is CC BY 4.0: **keep attribution** (the manifest `source` field does, and the REPORT of any run that shows images should cite the paper). Do not commit the images (`data/` is gitignored).
- **Size:** the full tarball is 181.4 GB; do NOT download it. The bucket is public over plain HTTPS, so single files need no `gsutil`, no Google account and no credentials: `https://storage.googleapis.com/nutrition5k_dataset/nutrition5k_dataset/<path>`.
- **What we use (verified by listing the bucket on 2026-11-20):**
  - `metadata/dish_metadata_cafe1.csv` (2.2 MB). Columns: `dish_id, total_calories, total_mass, total_fat, total_carb, total_protein`, then 7 fields per ingredient. The README also lists a `num_ingrs` column; the published file does not have one.
  - `dish_ids/splits/rgb_test_ids.txt` (the official RGB test split; avoids the training-set overlap the authors warn about).
  - `imagery/realsense_overhead/<dish_id>/rgb.png` (about 0.4 MB each). **These are 640x480.** Only part of the dishes have overhead imagery (about 3.5k of 5k); the script skips dishes whose `rgb.png` is missing.
- **Limits you must know about:**
  - Cafeteria plates from a few Californian cafeterias, overhead, even light: **plated only**. No packaged foods, no labels, no restaurant or dim light, no non-US cuisine.
  - 640x480 means the 768/1024/1280/1568 long-edge settings are not upscaled (`withoutEnlargement`), so on this set they collapse to the full-resolution image. **Resolution conclusions need the maintainer photos (below).**
  - Gold values are cafeteria weighed ingredients through USDA tables (kcal, fat, carbs, protein; no fiber).

### Exact steps

```bash
cd spikes/premium-p0/bench
npm install
npx tsx scripts/fetch-nutrition5k.ts --n 60        # about 25 MB, ~65 requests, no key needed
# default is --n 10 (about 4 MB); --seed N picks a different random sample
```

The script selects dishes with 150-1200 kcal, at least 120 g and at least 2 ingredients from the RGB test split, shuffles with a fixed seed, downloads `rgb.png` and writes `data/manifest.json`.

## Manifest format (`data/manifest.json`)

```json
[
  {
    "image": "nutrition5k/images/dish_1564687046.png",
    "kcal": 374.8,
    "protein": 33.7,
    "carbs": 20.5,
    "fat": 29.1,
    "grams": 308,
    "kind": "plated",
    "source": "Nutrition5k dish_1564687046 (CC BY 4.0, Google Research)"
  }
]
```

- `image`: path relative to `data/`.
- `kcal`, `protein`, `carbs`, `fat`: gold totals for the whole photo (grams of macro; kcal).
- `kind`: `plated | packaged | label | restaurant | mixed`.
- `grams` (optional) and `source` (optional, free text).

## Maintainer photos still needed (about 20)

Nutrition5k cannot cover what Musclog users photograph. For G6 the maintainer adds ~20 photos to `data/own/` and appends rows to the manifest (`"image": "own/<file>"`):

- 6 packaged foods and 6 nutrition labels (gold = the label, per portion eaten; `kind` `packaged` / `label`; include a dim-light and a tilted label).
- 4 restaurant or home dishes in dim light (gold = weighed on a kitchen scale and computed with a food table; note the source).
- 4 mixed plates with several foods.
- Shoot at the phone's native resolution (so 1568/1280 settings are meaningful), not pre-resized. Do not include faces or other people's data.
