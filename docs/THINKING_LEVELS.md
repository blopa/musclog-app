# Thinking levels, in plain words

A cheat sheet for when you forget how Off / Medium / High / Tokenmaxxing work. The code is the
authority; the files named below are where to look. Written 2026-11-24.

## The one idea

The setting is called **Thinking level** (`SETTINGS.thinkingLevel`, stored under the old key
`use_thinking_mode`; an old `'true'` reads as Medium). A level changes two separate things:

1. **How hard each request thinks.** The provider's own "reasoning effort" knob. One table:
   `AI_TASK_EFFORT` in `utils/aiEffort.ts`.
2. **How many requests a job makes.** Extra requests that check the first answer. One table:
   `THINKING_PIPELINE` in `utils/aiThinkingLevel.ts`.

Everything else is wiring. Nothing reads the stored level directly: every request asks
`thinkingLevelFor(config)` in `utils/coachAI.ts`, which goes through `effectiveThinkingLevel` (the
one place a level can be lowered).

## There are no tools and no agent loops

Every LLM request in Musclog is a plain question. The answer is either free text or JSON in a fixed
shape (a schema; the "function declarations" in `utils/prompts.ts` are only used as schemas, the
model never "calls" anything). The model never chooses to go again. **The app's code does all the
looping, and every loop has a fixed upper limit.** A level can make a job slower, never endless.

## The words used below

- **Request**: one call to the model.
- **Sample**: one independent answer to the same job. Several samples are combined by code
  (`runSamples` in `utils/aiPasses.ts`). Cloud providers run them together; the on-device model and a
  local server run them one after another (they have one engine).
- **Review round**: ask the model to check an answer it (or an earlier request) wrote, then let
  **code** decide if the corrected version replaces the old one (`reviewAndRevise`, same file). A
  round that is refused, empty or fails ends the loop and keeps the answer you had. Only Cancel
  stops everything.
- **Arbiter**: one extra request that is made only when samples disagree, told which fields are
  disputed (`extractWithConsensus` in `utils/coachAI.ts`).
- **Verified meal path**: read the recipe, check each food id the model claims against your
  database, estimate only the rest, recheck numbers that cannot be true.
- **First look** (Tokenmaxxing meals only): a structured note of what is in the meal, with no grams
  or macros (`observeMeal`, `utils/mealObservation.ts`). It is handed to the recipe request as
  notes beside the photo or description, which still win where they disagree.

## What each level is

| Level        | Effort per request | Extra requests                                                                                                                         |
| ------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Off          | per job (below)    | none                                                                                                                                   |
| Medium       | `high` everywhere  | meals take the verified path. Nothing else changes                                                                                     |
| High         | `high` everywhere  | Medium, plus 1 review round (meals, insights, plans), and 2 readings for labels and imports                                            |
| Tokenmaxxing | `max` everywhere   | Medium, plus 2 first looks and 4 meal samples, 2 review rounds, 3 readings for labels and imports, and chat replies drafted + reviewed |

Effort per job at **Off** (`AI_TASK_EFFORT`): reading something into fixed fields (a meal, a label,
an import) `minimal`; a chat reply `low`; an analysis of your data or a plan `medium`. Medium and
High both use `high`; they differ in how many requests are made, not in how hard each thinks.

The pipeline table (`THINKING_PIPELINE`) is exactly this:

| Level        | verifiedMeal | reviewRounds | samples | chatReview | mealLooks                   |
| ------------ | ------------ | ------------ | ------- | ---------- | --------------------------- |
| Off          | no           | 0            | 1       | no         | none                        |
| Medium       | yes          | 0            | 1       | no         | none                        |
| High         | yes          | 1            | 1       | no         | none                        |
| Tokenmaxxing | yes          | 2            | 3       | yes        | 2 looks, 2 samples per look |

Labels and imports use `extractionSamples`, which is 2 at High (two readings are what show where a
reading is unsure) and the table's `samples` otherwise. For meals, `mealLooks` replaces `samples`
when it is set (Tokenmaxxing), so `samples: 3` there is only what labels, imports and the
no-look fallback use.

## Every LLM job, one by one

Counts are for a cloud model or your own key. "+" means only when needed.

### Track a meal (text or photo)

Used by: the coach's Track meal, My Meals' generator, the camera's AI photo. Code: `trackMeal` and
`estimateNutritionFromPhoto` in `utils/coachAI.ts`.

- **Off**: one request returns the meal and its ingredients. Then code fixes it: ingredients that
  named a food id your database does not have and came with no numbers get +1 request to estimate
  them (`refineTrackedMeals`); ingredients whose numbers cannot be true get +1 request to re-estimate
  (`recheckImplausibleIngredients`, which keeps the new numbers only if they have fewer problems).
  Usually 1 request, at most 3.
- **Medium**: the verified path. (1) read the recipe, (2) estimate the foods your database did not
  match, (3) recheck implausible numbers. Usually 2 to 3.
- **High**: the verified path once, then 1 review round per meal: the model sees the estimate next
  to your text or photo and lists what is missing or off, code applies it, +1 to estimate what was
  added, +1 recheck. The review replaces the estimate only if it has no more implausible numbers.
- **Tokenmaxxing**: first, 2 independent first looks (`observeMeal`, run together on a cloud model).
  Then the verified path 4 times: 2 samples read each look. The samples are combined by
  `consensusMeals(samples, groups)` (`utils/mealConsensus.ts`): an ingredient stays only if it was
  seen under **both** looks (so a mistake inside one look cannot be outvoted into the result by that
  look's own two samples), and grams and macros are the median of all samples. Then up to 2 review
  rounds. Roughly 12 to 20 requests for one meal. Each look is a separate request on purpose: one
  shared look would put the same perception mistake into every sample and the vote would hide it.
  If one look fails or reads as nothing, the other still feeds its 2 samples; if both fail, it falls
  back to 3 plain samples with no look. The photo is still sent with every sample, so a wrong look
  can be corrected. A typed meal gets a look too: it lists what you said plus the usual hidden parts
  (cooking fat, dressing) as low-confidence assumptions. The on-device model skips the looks. The
  progress line says "Taking a careful first look at your photo…" while they run.

On the phone (on-device model), a meal **photo** is its own path
(`estimateMealFromPhotoOnDevice`): the photo is read once (Off, Medium), twice (High) or three times
(Tokenmaxxing), a food stays if at least half of the readings name it, names are matched to your
foods, the rest is estimated, then the usual recheck. No first look and no review rounds. A broken reply gets a warmer
retry and then one text-only repair request, whatever the level.

### Read a nutrition label (photo or text)

`extractMacrosFromLabelPhoto` / `extractMacrosFromLabelText`, through `extractWithConsensus`.

- Off, Medium: 1 request.
- High: 2 readings. `combineExtractions` (`utils/extractionConsensus.ts`) settles each field by
  majority or median; only if some field is disputed, +1 arbiter request.
- Tokenmaxxing: 3 readings, same combining, same arbiter.

### Import workouts, a food log or a past day written in words

`parsePastWorkouts`, `parsePastNutrition`, `parseRetrospectiveNutrition`: exactly the same as the
label (1 / 1 / 2 + arbiter / 3 + arbiter).

### Chat with the coach

`sendCoachMessage`. Effort: `low` at Off, `high` at Medium and High, `max` at Tokenmaxxing.

- Off, Medium, High: 1 request, streamed.
- Tokenmaxxing: 2. The first reply is written unseen, then a review request (same system prompt and
  history) checks it against the conversation and your app data. Only the review is streamed, with
  "Double-checking my answer…" until text arrives. If the review fails or comes back empty, you get
  the draft. This is the only job where the second answer is not judged by a code rule: it is kept
  unless it is empty or failed.

The chat's "armed" intentions reuse the jobs on this page: Track meal is the meal job, Meal plan and
Workout plan are plans, Analyze progress is a workout insight, Nutrition check is a nutrition insight.
On the phone only the last three work; the two plans need a cloud model.

### Insights (written analyses)

`generateInsight`: nutrition check, progress analysis, meal critique, feedback on a finished workout
and the daily background insights.

- Off, Medium: 1 request.
- High: the answer is drafted unseen, then 1 fact-check round. Code lists the figures in the answer
  that are not in the data the model was given (`ungroundedFigures`, `utils/numberGrounding.ts`) and
  the model returns a corrected version. It replaces the draft only if it is not empty and has no
  more ungrounded figures. The final text reaches the screen once.
- Tokenmaxxing: up to 2 fact-check rounds; the second also tightens the wording.
- **The daily background insights never go above Medium** (`BACKGROUND_THINKING_CEILING`), so they
  are always 1 request.

### Workout plan and meal plan

`generatePlan`, used by `generateWorkoutPlan` and `generateMealPlan`. Effort is `planning`.

- Off, Medium: 1 request.
- High: +1 critique round. The same request again, plus the current plan and the problems code found
  in it (`utils/planFindings.ts`: an exercise twice in a workout, sets or reps that make no sense, a
  meal-plan day more than 10% off the calories or protein asked for, ingredient numbers that do not
  add up). The critique always runs, even when the list says "none". The revision is kept only if it
  has no more problems than the plan it replaces.
- Tokenmaxxing: up to 2 critique rounds.

`calculateNextWorkoutVolume` is built the same way, but no screen calls it today (checked
2026-11-24). Same for `getWorkoutInsights` and `getWorkoutVolumeInsights`.

### The AI setup chat (onboarding)

`sendStructuredChatTurn` (`utils/structuredChat.ts`), task `chat`. It only gets the **effort**
(`low` / `high` / `high` / `max`). It never makes extra requests, at any level.

### Requests that ignore the level

- The JSON **repair** request for a local server or the on-device model, after a reply fails to
  parse and fails the schema. It only happens after the cheap fixes fail.
- On-device fiber estimate (+1 when fiber is tracked) after the labels request.

## Who gets which level (`effectiveThinkingLevel`)

| Provider / situation                  | What happens                                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Your own key (Gemini, OpenAI, Claude) | all four levels. Tokenmaxxing asks for each provider's highest setting                                                                       |
| Local server                          | all four levels. No effort knob, so only the extra requests matter                                                                           |
| AI on your phone                      | all four levels. No effort knob; extra requests only. Costs time, not money                                                                  |
| Musclog Iron                          | all four levels. Moving up to High shows a note; Tokenmaxxing shows a note and asks for fingerprint, face or PIN (`thinkingLevelChangeGate`) |
| Free Musclog AI tier (`gateway`)      | always Off. The daily quota is shared by every free user. The stored level is kept for when you switch provider                              |
| Daily background insights             | capped at Medium                                                                                                                             |

On Musclog Iron the effort is also clamped by the Worker's config (`docs/PREMIUM_WORKER.md`), so the
table holds only as far as the deployed config allows.

## How the effort reaches each provider

`resolveEffort(config, task)` returns `minimal | low | medium | high | max`, then each provider
translates it:

- Claude: `output_config.effort` (`claudeEffort` in `utils/claude.ts`).
- Gemini: `buildGeminiGenerationConfig` in `utils/gemini.ts` (`max` is the highest thinking level or
  a dynamic budget).
- OpenAI-compatible: `reasoning_effort` as `low` / `medium` / `high` (`max` is sent as `high`),
  only where `ProviderPolicy.reasoningEffort` allows it (`utils/providerPolicy.ts`).
- On-device: nothing to send.

## Rules that hold everywhere

1. **Code decides whether a second answer wins**, except the Tokenmaxxing chat review. Meals: fewer
   implausible numbers. Plans: fewer findings. Insights: fewer ungrounded figures.
2. **An extra request can only help, never fail the answer.** A failed or empty review keeps what
   you had. A failed sample is dropped; if every sample fails, the first error is shown as it would
   be for one request.
3. Review prompts quote model output between `--- ANSWER ---` style markers, never angle brackets.
4. Progress lines (`food.aiProgress.*`) only describe a step the code is really taking, never a
   guess at what the model is thinking.

## Where to change things

| I want to…                                            | Edit                                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| make a level think harder or softer                   | `AI_TASK_EFFORT` in `utils/aiEffort.ts`                                                                       |
| change how many requests a level makes                | `THINKING_PIPELINE` / `extractionSamples` in `utils/aiThinkingLevel.ts`                                       |
| change what a level asks for on Iron                  | `thinkingLevelChangeGate` in the same file                                                                    |
| change which jobs the free tier or background can use | `providerAllowsThinking`, `BACKGROUND_THINKING_CEILING`, same file                                            |
| add a review step to a new job                        | use `runSamples` / `reviewAndRevise` from `utils/aiPasses.ts`, with a code `accept` rule                      |
| add a new kind of job                                 | name its task (`chat`, `extraction`, `insight`, `planning`) when calling `requestStructured` / `generateText` |

Tests: `utils/__tests__/{aiThinkingLevel,aiPasses,mealConsensus,mealObservation,coachAIMealLooks,mealReview,extractionConsensus,numberGrounding,planFindings,coachAIExtractionConsensus,coachAIReviewPasses,coachAIStreaming,coachAITrackMealThinking,aiEffort,coachAIEffort}.test.ts`.
The reasoning behind the choices is in `docs/RESEARCH.md` (Reasoning effort per job). Nobody has
measured yet whether the extra requests improve the answers; the numbers are product choices.
