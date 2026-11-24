# AI effort evaluation: deferred, to run later

**Status, 2026-11-23.** The per-job effort table (`utils/aiEffort.ts`), the meal refinement (`refineTrackedMeals`, `utils/mealPlausibility.ts`) and Musclog Iron's per-request effort with `max_tokens_by_effort` are live in the code, and **nothing has measured whether they make answers better**. The values are product choices (`docs/RESEARCH.md` → Reasoning effort per job). This document is how to measure them. No harness exists yet: section 5 says what to build.

## 1. What it would settle

1. **Does effort pay for itself?** For each kind of job (`chat`, `extraction`, `insight`, `planning`), is a higher effort better by more than the noise, and is the gain worth the extra latency and tokens? Today the table says extraction `minimal`, chat `low`, insight and planning `medium` at the Off level, `high` everywhere at Medium and High, `max` at Tokenmaxxing. Any row could be wrong.
2. **Is the meal refinement worth its extra requests?** It re-estimates ingredients with an invented food id or implausible numbers. Does it reduce calorie and macro error, and how often does it fire for nothing (alcohol, oils)?
3. **Are Iron's token limits right?** `max_tokens_by_effort` (chat 1500/3000/4500, structured 4000/6000/9000, vision 2000/3500/5000) are estimates. The run measures how much a model really spends thinking at each effort, and how often an answer is cut off (`finish_reason: length`).
4. **Which thinking level is worth recommending?** Medium (`high` plus the verified meal path), High (one review round for meals, insights and plans, two readings of a label or an import) and Tokenmaxxing (two first looks and four verified samples per meal, two review rounds, three readings of a label or an import, a coach reply drafted and reviewed) each cost more than the last, and Iron users pay with their allowance. `docs/THINKING_LEVELS.md` lists every request each level makes.

## 2. What to compare

Run every case under each variant, on the same model, with the same prompts and data. The variants named after a level are that level exactly as `THINKING_PIPELINE` (`utils/aiThinkingLevel.ts`) and `AI_TASK_EFFORT` (`utils/aiEffort.ts`) define it.

| Variant        | Effort                                                                                       | Extra requests                                                                                                                                         | What it stands for                      |
| -------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `flat-low`     | `low` for every job                                                                          | none; a meal is one request, with no refinement                                                                                                        | roughly the behavior before 2026-11-23  |
| `off`          | `AI_TASK_EFFORT[task].off` (extraction `minimal`, chat `low`, insight and planning `medium`) | a meal is one request plus the refinement (`refineTrackedMeals`)                                                                                       | the Off thinking level                  |
| `off-no-fix`   | the same as `off`                                                                            | a meal is one request, refinement skipped                                                                                                              | isolates the refinement from the effort |
| `medium`       | `high` for every job                                                                         | a meal takes the verified path once (`trackMealVerified`)                                                                                              | the Medium thinking level               |
| `high`         | `high` for every job                                                                         | `medium`, plus one review round (meals, insights, plans) and two readings of a label or an import                                                      | the High thinking level                 |
| `tokenmaxxing` | `max` for every job                                                                          | two first looks and four verified samples per meal, two review rounds, three readings of a label or an import, a coach reply drafted and then reviewed | the Tokenmaxxing thinking level         |

Add `flat-medium` if `off` and `medium` differ a lot and you want to know whether the middle is enough. Run each provider that matters separately (Gemini default model, OpenAI default model, Claude default model, and Iron's `openai/gpt-6-luna` through OpenRouter): a result on one does not transfer.

## 3. The cases

Use only synthetic or public data. **Never use a real user's logs, chats or photos**, and keep your own photos out of the repo.

**Meal text (about 40).** Build from the foods the app already bundles (`data/usda_foundation_foods.json`, `data/common_foundation_foods.json`): write a description such as "200 g cooked white rice, 150 g grilled chicken breast, 1 tbsp olive oil" and compute the gold by summing the database values (kcal, protein, carbs, fat, fiber). Include on purpose: foods in the database (tests id matching), foods not in it, a branded product, a drink with alcohol, an oil, a very small amount (a pinch of salt), a mixed dish without weights, a description in each app language you care about. Run with `sendFoundationFoodsToLlm` on and off.

**Meal photos (about 60).** The set and the fetch script already exist: `spikes/premium-p0/bench/fetch-dataset.md` (Nutrition5k, plated cafeteria meals with gold macros, 640 x 480, so it cannot tell photo resolutions apart) plus about 20 of your own at native resolution with gold from the pack or a kitchen scale (`docs/PHOTO_BENCHMARK.md` section 5). The photo benchmark (G6) can share this run: it adds the image-token measurement and the resolution question.

**Coaching replies (the 20 scenarios in `utils/__tests__/fixtures/coachReplay/scenarios.json`, plus about 20 more).** Each has `history`, `userMessage`, an optional `snapshot` and a `replyRubric` of yes/no questions. Add scenarios whose right answer depends on numbers in the snapshot (today's intake, a weight trend) and scenarios that should be refused or redirected (pain, an eating-disorder signal, a request for a diagnosis).

**Insights and plans (about 20).** An insight prompt over a fixed fake week of data, and workout and meal plan requests with constraints (days per week, equipment, an injured exercise from `exercise_restrictions`, a calorie target).

## 4. What to measure

Record for every call: variant, case, repetition, wall-clock latency, time to first token when streamed, input, cached, output and reasoning tokens (`utils/llmUsage.ts` already extracts them; `getRecentLlmUsage()`), number of requests the task made, `finish_reason`, and cost (usage times the model's price, or the `cost` field OpenRouter returns).

Score by job, preferring a check in code to a judge:

| Job              | Code-scored (primary)                                                                                                                                                                                                                                                                                            | Judged (secondary)                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Meal text, photo | Absolute kcal error of the whole meal (median and 90th percentile), per-macro error, ingredient recall and precision (name match after normalizing), share of ingredients logged at 0 kcal that should not be, `foodId` accuracy (claimed ids that resolve), requests per estimate, refinement fired for nothing | none                                            |
| Plans            | Valid exercise slugs, days per week respected, restricted exercises absent, calorie target hit within 5%, schema valid                                                                                                                                                                                           | whether the plan is sensible                    |
| Coaching reply   | Under the length the rubric asks for, no list when it says no list, in the person's language, no figure that is not in the snapshot                                                                                                                                                                              | the `replyRubric` questions, answered yes or no |
| Insights         | Every number quoted appears in the data you gave it                                                                                                                                                                                                                                                              | whether the advice follows from the data        |
| Truncation       | Share of answers with `finish_reason: length`, and for each effort the p50, p95 and maximum of reasoning tokens and of answer tokens                                                                                                                                                                             | none                                            |

**The judge.** Use a different model family from the one being judged, hide the variant, shuffle the order of the two answers, ask for a yes/no per rubric line, and have a person re-read about one in five. A judge prefers longer and more confident answers: do not let a judged score alone move a table row.

## 5. How to run it

There is no harness. Build the smallest thing that runs the **shipped code path**, not a copy of it:

1. A Jest project that is excluded from the default run (for example `evals/`, selected by `--selectProjects eval` and refusing to start unless `MUSCLOG_EVAL=1` and a key are set). It reuses the mock layer the existing AI tests use (`utils/__tests__/coachAIEffort.test.ts` and `coachAITrackMealRefine.test.ts` show it: `SettingsService`, `NutritionService`, debug dump) but a real provider client. Calling `trackMeal`, `estimateNutritionFromPhoto`, `sendCoachMessage` and `requestStructured` tests the real prompts, refinement and effort wiring.
2. The variants are imposed by mocking `utils/aiEffort` (return one flat effort for `flat-low` and `thinking`) and `SettingsService.get(SETTINGS.thinkingLevel)` (add `high` and `tokenmaxxing` variants by returning those levels). For `table-no-fix` add a throwaway local patch that skips `refineTrackedMeals`; do not commit it.
3. For Iron's token limits, extend the existing OpenRouter bench instead (`spikes/premium-p0/bench`, `bench-models.ts`, which already records latency, tokens and cost and takes `--max-usd`): send the same bodies the Worker would (`provider.zdr`, `reasoning: { effort }`, the feature's `max_tokens`) for `low`, `medium` and `high`, and record `finish_reason` and reasoning tokens. Set each `max_tokens_by_effort` entry to about the p99 of reasoning plus the p99 of the answer, then add 20% headroom.
4. Write one results row per call to a git-ignored folder (`evals/results/`), then a small script that prints the tables in section 4 per job and variant.

**Noise.** Run each case 3 to 5 times per variant (`temperature` left at the default, as the app does). Compare variants **per case** (paired), report the median and the spread, and use a bootstrap interval on the difference. Treat a change under about 10% as noise unless it is consistent across providers.

**Cost.** Estimate before running: `cases x repetitions x variants x (input tokens x input price + output tokens x output price)`. Photos add image tokens. Use a throwaway key with a spend limit (OpenRouter keys have a `limit`, see `spikes/premium-p0/bench/REPORT.md`), never the Premium Worker's key, never a key that ships in a bundle. Start with 5 cases and 1 repetition to check the harness, then scale.

## 6. Reading the result

- **Move a table row up** only if the higher effort beats the current one on the code-scored primary metric by more than the noise, on at least two providers, at no more than about 1.5 times the latency. Otherwise leave it.
- **Move a row down** if the lower effort is within the noise: that saves tokens, time and Iron allowance.
- **Keep the refinement** if it lowers the median or p90 calorie error or removes the 0 kcal ingredients, and fires for nothing on fewer than about 1 case in 10. If it fires for nothing mostly on one food type (alcohol), narrow `ingredientMacroProblems` for it instead of removing the refinement.
- **Recommend a higher thinking level** only if `thinking` beats `table` on a metric a person would feel. Otherwise say in its subtitle that it is slower and costs more, which it already does for Iron.
- **Raise or lower `max_tokens_by_effort` and `reasoning_max`** (`services/premium-worker/wrangler.toml`, then the Worker deploy in `docs/PREMIUM_WORKER.md`) from the truncation numbers, not from a feeling.

Record what you ran and decided in `docs/RESEARCH.md` → Reasoning effort per job (variants, models, dates, the numbers that moved a row), and change `AI_TASK_EFFORT` only together with its test (`utils/__tests__/aiEffort.test.ts`).

## 7. Traps

- **Model updates change results.** Note the exact model ids and the date, and rerun after `GEMINI_MODELS`, `OPENAI_MODELS` or `CLAUDE_MODELS` change (the `update-ai-models` skill does that monthly).
- **Nutrition5k is cafeteria food.** It says nothing about packaged foods, labels, restaurants or non-US cooking; do not average it with the rest.
- **Gold is also an estimate** (weighed ingredients through food tables). A kcal error under about 10% is within the gold's own error.
- **Mocks hide the provider.** A result from a fake client says nothing about effort; the point of the run is the real provider.
- **Do not tune the prompt and the effort at once.** Change one thing between runs.
- **Privacy.** No real user data, no keys in the repo, no results with personal photos committed.

## 8. Deliberately not part of it

A product A/B test (the app has no product analytics, by design), user ratings of replies, and a training or fine-tuning set built from user conversations.
