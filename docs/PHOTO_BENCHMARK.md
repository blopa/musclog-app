# Photo benchmark (gate G6): deferred, to run later

**Status, 2026-11-23.** Hosted vision (photos through Musclog Iron) is **on**, and the benchmark that the plan made a precondition (`docs/plans/musclog-premium.md`, gate G6) has **not been run**. The maintainer chose to ship with an estimate and to run the benchmark another day. This file is that "another day": what is live now, what is still a guess, how to run it, and what to change with the answers.

## 1. What is live now (and which parts are estimates)

| Setting                                  | Value                                                                                      | Where                                                                | Measured?                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `vision_enabled`                         | `true`                                                                                     | `AI_CONFIG_JSON` in `services/premium-worker/wrangler.toml` (4 envs) | n/a (a switch)                                                                                                 |
| `image.tokens_max` (IMAGE_TOKENS_MAX)    | **4096**                                                                                   | same                                                                 | **No.** Estimate: 1568 x 1568 px / 750 is about 3,300 tokens, plus margin. Used only to bound the reservation. |
| `image.max_px` / `max_bytes` / `quality` | 1568 / 400000 / 85                                                                         | same                                                                 | No. Ceilings the quality tiers are held to (the app clamps `max_bytes` to its 512 KB body cap).                |
| `image.max_images`                       | 1                                                                                          | same                                                                 | n/a                                                                                                            |
| Photo quality tiers (`ai_image_quality`) | low 512 px q0.70, **medium 768 px q0.75 (default)**, high 1024 px q0.80, max 1568 px q0.85 | `utils/aiImagePlan.ts` (`AI_IMAGE_TIERS`)                            | **No.** Chosen by judgement, not by accuracy results.                                                          |
| Allowance a photo costs                  | about $0.0007 to $0.0009 (0.04% to 0.05% of a $1.75 monthly cap)                           | estimate in the 2026-11-23 session                                   | **No.** Assumes the model bills an image as roughly pixels / 750 input tokens and 1,050 output tokens.         |
| Consent version                          | 3 (names meal photos)                                                                      | `utils/premium/premiumConsent.ts`                                    | n/a                                                                                                            |

The photo quality picker and the resize step apply to **every** provider, not just Iron (`utils/aiImage.ts`, applied in `generateWithImageStructured`). The benchmark below is about Iron's model, but its resolution findings also decide the default tier for own-key and free-tier photos.

## 2. What the benchmark would settle

1. **The real image token count per tier.** Replaces the 4096 estimate. It only needs the live run to record `prompt tokens - text-only baseline`; it needs no gold macros.
2. **Whether accuracy holds as the photo shrinks.** In particular, does `low` (512 px) or the default `medium` (768 px) lose kcal or macro accuracy against full resolution, and do nutrition labels stay legible? This is what needs photos with known macros.
3. **Optionally, whether `openai/gpt-6-luna` is the right model for photos.** The bench can compare it with `qwen/qwen3-vl-30b-a3b-instruct` and others on the same photos.

## 3. Safety net while it is pending

An under-estimated `tokens_max` cannot silently overspend. The reservation is `(input tokens x $0.10 + max_tokens x $0.50 per million) x 1.1`, and a vision request has `max_tokens` 2000, so the output term alone is about $0.001 of headroom. A request is an **overrun** only when the actual cost exceeds the reservation, which here would take roughly **7,000 or more image tokens** on one 1568 px photo, far above any estimate. An overrun is charged in full and counted; **3 overruns in 24 hours open the breaker, which stops hosted AI for everyone** (plan 8.2, `breaker.overruns_24h`). So the failure mode of a bad estimate is not money, it is an outage, and it is unlikely.

Watch for it: the Worker logs overrun lines at full rate (`overrun: true`, `services/premium-worker/src/log.ts`). If any appear after photos went live, raise `tokens_max` first.

## 4. Do this first: the device smoke test (free, 15 minutes)

These are not benchmark items; they were **not** verified before vision went on, and they are cheaper than the benchmark:

- [ ] **A real photo through Iron, on a release or TestFlight/internal build, at each tier.** Log a meal from a photo with Musclog Iron on, at low, medium, high and max. Each must return a result, not "unavailable".
- [ ] **OpenRouter routes with `max_price.image: 0`.** The Worker sends `max_price: { prompt, completion, image: 0 }` (`src/proxy/allowlist.ts`). `openai/gpt-6-luna` has no per-image price (`imagePerImage: null` in `fixtures/models.snapshot.json`), so it should route, but this was never tried live. If the photo request fails with a "no endpoints" style error, that is the cause: drop `image` from `max_price` when `image_per_image` is 0.
- [ ] **`expo-image-manipulator` accepts the `data:` URI on a real device** (the plan's open item; unit tests mock it). Check the logs for "Image preparation failed; sending the original image."
- [ ] **Read the usage bar before and after one photo.** A photo should move it by a small fraction of a percent. Note the actual `usage.cost` if you can see it in the Worker logs, and compare with section 1.
- [ ] **Old app builds.** A 2.17.0 to 2.17.7 build reads `vision_enabled: true` and resizes with the older rule (the quality percent was mis-read as 0.95, then stepped down to fit). Confirm one photo from an old build still goes through.
- [ ] **Store forms.** `docs/GOOGLE_PLAY.md` (Photos row) and `docs/APP_STORE.md` (User Content row) say Photos are already declared; open Play Console and App Store Connect and confirm, before the release that ships this.

## 5. Preparing the photos

The pass bar needs the **gold** macros of each photo, so the benchmark needs photos you can score. The format and the Nutrition5k set are in `spikes/premium-p0/bench/fetch-dataset.md`; the short version:

- **Nutrition5k, plated cafeteria meals (free, no key):** `npx tsx scripts/fetch-nutrition5k.ts --n 60`. These are 640 x 480, so they cannot tell 768 from 1568 px apart.
- **About 20 of your own photos** at the phone's native resolution, with `kind` and gold values added to `data/manifest.json` (`"image": "own/<file>"`):
  - 6 packaged foods and 6 nutrition labels (the **gold is printed on the pack**, per portion eaten; include one dim-light and one tilted label),
  - 4 dishes in dim light (weigh on a kitchen scale, compute with a food table, note the source),
  - 4 mixed plates.
- **Faster option.** Labels and packaged foods give exact gold values for free. 12 to 15 of them plus a few plates you weigh is enough to answer the one question that matters most (does `low` or `medium` blur small print?). Do not include faces or other people's data.

## 6. Running it

```bash
cd spikes/premium-p0/bench
npm install
export OPENROUTER_API_KEY=...   # a throwaway key with a $5 limit, read from the environment only; never paste it into a chat or a file
# Tier-aligned grid: 4 edges x 4 qualities (the app's tiers are the diagonal: 512@70, 768@75, 1024@80, 1568@85), plus full resolution
npx tsx scripts/bench-images.ts --live --max-usd 2 \
  --models openai/gpt-6-luna,qwen/qwen3-vl-30b-a3b-instruct \
  --edges 512,768,1024,1568 --qualities 70,75,80,85 --photos 40
```

- **Cost:** about $1.3 for 2 models x 40 photos x 17 settings (scaled from the $0.76 estimate for 10 settings in `bench/REPORT.md`, section 4). `--max-usd` stops the run if it would pass the cap, and writes a partial report. Buying $5 of OpenRouter credit costs $5.80 (5.5% fee, $0.80 minimum).
- The OpenRouter account and key must have **"ZDR only"** set (Settings, Privacy), the same as production.
- Dry run (free, mock numbers, proves only the pipeline): `npm run dry-run`.
- Outputs land in `results/images.{json,md}`. Do not quote `results/*-dryrun.*`: those numbers are invented.

## 7. Reading the results and what to change

| Result                                                                            | Change                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The report's `IMAGE_TOKENS_MAX` (max observed x 1.25) is **below 4096**           | Optional: lower `image.tokens_max` in `AI_CONFIG_JSON`, in all four envs of `wrangler.toml`. Keeping 4096 is safe; it only makes the reservation more pessimistic.                                                        |
| It is **above 4096**                                                              | Raise `image.tokens_max` to the reported value, in all four envs, and deploy the Worker (first, before anything else).                                                                                                    |
| A tier's kcal or macro error is **more than 2 points worse than full resolution** | Raise that tier's `maxPx` or `quality` in `AI_IMAGE_TIERS` (`utils/aiImagePlan.ts`; the unit test checks the tiers still only go up). If `medium` is the one that fails, raise the default (`DEFAULT_AI_IMAGE_TIER`) too. |
| Labels are not legible at `low` or `medium`                                       | Say so in that tier's hint (`settings.aiSettings.photoQuality.tier.*.hint`, ten locales) or raise the tier.                                                                                                               |
| A tier is indistinguishable from the next one up                                  | Merge or retune the tiers, and keep the hints true.                                                                                                                                                                       |
| Another model clearly beats luna on photos at similar cost                        | Photos use the model in `AI_CONFIG_JSON` (`model`), not a per-feature one; changing it affects chat as well. That is a decision for `docs/plans/musclog-premium.md` section 7.                                            |
| `max_bytes` is hit often at `max` (the loop steps quality down)                   | Lower the `max` tier's quality or raise `image.max_bytes` (it cannot go past the 512 KB body cap).                                                                                                                        |

After changing anything: `npm --prefix services/premium-worker test` and `npx jest utils/__tests__/aiImagePlan.test.ts utils/__tests__/aiImage.test.ts`, then update section 1 of this file and the G6 row in `docs/plans/musclog-premium.md`, and mark the status line at the top "run on <date>".

## 8. Known gaps that are not part of the benchmark

- **Consent re-ask for existing Iron users: not needed.** `PREMIUM_CONSENT_VERSION` is 3 (it names meal photos) and is asked only when someone turns Iron on. As of 2026-11-23 nobody has Iron yet, so every subscriber sees the version 3 wording. If Iron ships to people before a later consent change, remember that a bump is not re-asked for people who already have it on.
- **The free tier and own keys now resize photos too** (default 768 px), where before they sent the full camera image. If accuracy complaints appear from those routes, the cheapest fix is to raise the default tier, which the benchmark's section 2 result informs.
- **Web does not resize** (the image codec is native), so the quality picker is hidden there.
