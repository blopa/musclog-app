# Future Features

A product-level roadmap derived from researching two well-regarded apps in adjacent categories:
one built around adaptive nutrition coaching, one built around recovery and whole-health
presentation. Neither is named here — what matters is the pattern, not the source.

**Scope guard:** this app is workouts + nutrition, with sleep read only as an input that tells the
user whether to push hard today. Everything below respects that. Features that would drag the app
toward all-in-one health sprawl are listed in [Deliberately out of scope](#deliberately-out-of-scope)
rather than silently omitted.

**Related docs:**

- [NUTRITION_APP_COMPARISON_AND_IMPROVEMENTS.md](NUTRITION_APP_COMPARISON_AND_IMPROVEMENTS.md)
  — earlier competitor pass; its "weight smoothing" observation is picked up and expanded below.
- [../FEATURES.md](../FEATURES.md) — what actually ships today.

---

## The thesis

We are **deep where the researched apps are shallow**, and **shallow where they are polished**.

Reviewers of both apps consistently describe their training modules as thinner than
purpose-built training apps, and their nutrition as thinner than dedicated food trackers. Meanwhile
this app already computes muscle-group volume, PR detection, seven 1RM formulas with RIR awareness,
smart double progression, intra-session RIR adjustment, 40+ micronutrients, Nutri-Score/NOVA
normalization, empirical TDEE with Forbes-curve body-composition partitioning, streaks and check-ins.

So the opportunity is **not** to port their feature lists. It is to close two specific gaps:

1. **Credibility of the energy-balance math** — not the model itself (ours is more sophisticated),
   but its inputs, its stability, and whether the user can _see_ it working.
2. **Presentation** — most of what users praise in those apps is one glanceable, explained,
   non-punitive surface built on data we already compute and currently bury.

Almost every item below is a presentation or input-quality change, not a new data pipeline.

---

## Tier 1 — the five highest-value items

### 1. Trend weight, everywhere — shipped

**Implementation record:** see [TREND_WEIGHT_IMPLEMENTATION_PLAN.md](TREND_WEIGHT_IMPLEMENTATION_PLAN.md).

**Status:** shipped. `utils/trendWeight.ts` provides the canonical alpha-0.10 EWMA with same-day
averaging, interpolation between observations, and a 28-day warm-up for bounded reads. Progress,
nutrition charts, check-ins, and empirical-TDEE endpoints use it; raw readings remain visible.

**What good looks like:** the primary weight number the user sees is an exponentially-smoothed
trend, with raw weigh-ins as faint dots behind it. Daily fluctuation from water, sodium and gut
content stops reading as failure.

**Follow-up:** calibrate alpha against production outcomes if needed. A home card remains a separate
dashboard-information-architecture decision, and there is no user-facing smoothing control.

**Why it's first:** cheapest change with the largest perceived-quality jump, and it is a
prerequisite for items 2 and 3.

---

### 2. Fit the whole weight series, not two endpoints

**Gap:** [utils/historicalNutritionParams.ts](../utils/historicalNutritionParams.ts) derives
empirical TDEE from the **initial and final trend-weight endpoints**, discarding every point in
between. This is calmer than raw or weekly-average endpoints but still leaves information unused.

**What good looks like:** a weighted regression over trend weight across the full window. More
robust, and it yields the confidence interval that makes item 3 credible.

**Build:** extend `getHistoricalNutritionParams` to return a fitted rate-of-change plus a confidence
band instead of two scalar endpoints; `calculateTDEE` in
[utils/nutritionCalculator.ts:809](../utils/nutritionCalculator.ts#L809) consumes the fitted delta. The
thermodynamic model underneath — tissue coefficients, adaptive thermogenesis, drift correction — is
already strong and does not change.

---

### 3. Expenditure as a hero screen, not a hidden number

**Gap:** we compute a genuinely sophisticated TDEE and then bury it in a card.

**What good looks like:** expenditure plotted over time with a confidence band, visibly adapting
week to week. This is the single most-praised feature of the adaptive-nutrition app studied — it
converts an opaque number into a story the user watches unfold. It is also what makes metabolic
adaptation legible instead of scary.

**Build:** a dedicated expenditure chart in the progress area, with plain-language copy explaining
what moved and why. Depends on items 1 and 2 for the confidence band to be honest.

---

### 4. Muscular strain / per-muscle load map

**Gap:** no heatmap or body map exists anywhere in the repo.

**What good looks like:** a front/back body silhouette tinted by rolling-7-day working-set volume
per muscle group, plus a "freshest / most cooked" ranking. Reviewers rate this kind of
strength-specific strain as more useful than the cardio-biased strain scores in mainstream wearables
— and we already have the data layer that makes it accurate.

**Build:** `calculateMuscleGroupVolume` in
[database/services/WorkoutAnalytics.ts](../database/services/WorkoutAnalytics.ts) already produces the
numbers; `MuscleService` has the seed data. The work is purely an SVG component (native + web).

**Priority:** earlier workout-gap research placed this behind new logging mechanics. The broader
product research argues for promoting it: the data layer already exists, making this the highest
value-per-effort item in the workout tab and the one that makes it feel like a product rather than a
log.

---

### 5. Copy day / repeat meal from history — ✅ shipped

**Gap (resolved):** entries could be moved, copied, combined and grouped, but every one of those
actions _pushed_ a meal forward from the viewed day. There was no way to _pull_ a past day in.

**What shipped:** a source-day picker listing recent days that have logs (with kcal and item count),
a preview of that day's meals grouped by meal type with per-item checkboxes, and an additive copy.
Reachable from an inline prompt on any empty day and from the daily-summary menu.

**Where it lives:** `NutritionService.copyNutritionLogsPreservingMealType` and
`getRecentLoggedDays`; selection logic in [utils/copyDaySelection.ts](../utils/copyDaySelection.ts);
`components/modals/CopyDayFromHistoryModal.tsx` and `components/nutrition/CopyDayPromptCard.tsx`.

Two invariants that are load-bearing and easy to break:

- **`groupId` is preserved verbatim.** Nothing queries `nutrition_logs` by `group_id` globally and
  nothing assumes per-day uniqueness — logging the same saved meal on two days already produces the
  same id on both. Because `groupId` is sometimes a `meals.id`, minting fresh ids would break
  `MealService.getMealImageUrl` and the meal name on the copied day.
- **Each log keeps its own time-of-day.** `nutrition_logs.date` is a consumed datetime, so the copy
  re-anchors through `wallClockDateInTimezone` per log rather than calling `consumedDateTimeOnDay`
  once — otherwise a whole day collapses onto a single instant. `copyNutritionLogsToDate` (the
  single-meal path) still stamps "now" and that is correct for its use.

---

## Nutrition — energy balance and goals

- **Coaching modes: Coached / Collaborative / Manual.** The strongest UX idea in the
  adaptive-nutrition app, and nearly free for us. _Coached_ = the algorithm sets targets weekly and
  the user just logs. _Collaborative_ = the user picks a rate of change and the app computes macros.
  _Manual_ = the user types numbers. We already support multiple goals with switching; reframing
  that as an explicit **mode** removes the "is this thing overriding me?" anxiety that kills trust
  in adaptive apps.
- **Weekly automatic target updates with a narrated "here's why."** We already have check-ins and
  [utils/dynamicNutritionTarget.ts](../utils/dynamicNutritionTarget.ts). The port is making the update
  _scheduled and explained_ — "expenditure rose ~90 kcal, so your target moved" — rather than
  something the user must go looking for.
- **Adherence-neutral framing, stated out loud.** Because expenditure is inferred from weight change
  against logged intake, under-logging degrades the estimate gracefully rather than breaking it.
  Saying this in the UI is what makes people stop lying to their food log.
- **Rate-of-change goal setting (%BW/week) with a projected date**, plus a gentle flag when the
  chosen rate is aggressive. Strictly better than a "lose weight" dropdown.
- **Diet breaks / maintenance phases as first-class schedulable states**, so both the algorithm and
  the check-in copy know not to nag during a planned maintenance block.
- **Calorie cycling / weekly budget.** Different targets per weekday, or one weekly budget with a
  rolling remainder. The existing day-key infrastructure supports this cleanly.

---

## Nutrition — logging speed

The quietly decisive half. None of this is glamorous; all of it is felt daily.

- **Personal-history search ranking** — the user's own foods, ranked by frequency × recency, above
  database results, rather than in a separate "recent" list they must remember to open.
- **Remember the last-used serving per food** — re-logging the usual coffee should be one tap with
  the right amount already filled in.
- **Quick add** — calories/macros only, no food record. Restaurant meals, someone else's cooking.
  Its absence is what makes people abandon logging on hard days.
- **Multi-select from search** — tick four foods, add all at once, instead of four round trips.
- **Serving editor with fraction shortcuts** (½, 1, 1½, 2) and visible gram-equivalence per unit.
- **Let users correct bad database entries.** The adaptive-nutrition app built an entire curated
  database because public food data is frequently wrong. We can't fund that — but we _own a barcode
  database_. Letting a user fix an entry, having the correction stick locally, and optionally
  feeding it upstream is a differentiator a closed database cannot match.

---

## Nutrition — food quality and micronutrients

- **Daily nutrition quality score.** We are ~80% there:
  `getExternalProductDisplayQuality` already normalizes Nutri-Score / Eco-Score / NOVA into
  `FoodDisplayQuality` ([utils/foodDisplayQuality.ts](../utils/foodDisplayQuality.ts)), and
  `NutritionQualityData` renders it per food. Nothing rolls it up to a **day-level** figure weighted
  by gram or kcal contribution. Doing so lets the diary answer _"did I eat well?"_ and not only
  _"did I hit my numbers?"_ — which was the headline feature of the researched app's latest
  nutrition release.
- **Weekly micronutrient coverage, not per-food.** `MicronutrientsExpandableSection` shows micros on
  an individual food or meal. The valuable framing is the rollup: _"potassium under target 5 of the
  last 7 days"_ — and, critically, _"here are foods you already log that fix it."_ The `micros_json`
  data is already sitting there.
- **Micronutrient targets, not just tracking.** We track 40+ micros with nothing to compare against.
  A static RDA table by age/sex turns a data dump into a percentage.
- **Weekly nutrition report** — adherence %, average intake vs target, days logged, macro
  distribution. We have the charts; we lack the digest.

---

## Workouts

Musclog already has the foundation this backlog should build on: RIR-aware logging and 1RM
calculations, drop sets, supersets, partial reps, templates and programs, free sessions, exercise
reordering, history and charts, custom exercises, smart double progression, intra-session RIR
adjustment, goal projection, suggested starting weights, body metrics and mood tracking, AI
coaching, and Health Connect/HealthKit sync. The gaps below add mechanics or surface more value from
that existing data.

### High-value presentation and session improvements

- **Progressive-overload nudges at the point of entry.** We already have smart double progression,
  `getProgressiveOverloadData`, `getRecentFirstSetAverage1RM`, and previous-set display in
  `app/app/workout/workout-session.tsx`. Add the missing nudge at the moment of decision: "you hit
  the top of the rep range twice — try +2.5 kg."
- **e1RM trend per exercise as a headline strength metric.** It is calculated in
  `utils/workoutCalculator.ts` and used inside exercise goals, but never charted per lift. "Your
  bench e1RM is up 6 kg in 8 weeks" is the number lifters actually want.
- **Auto-start the rest timer on set completion.** There is no `autoStart` path today; the user taps
  twice for something that should be automatic.
- **Explicit PR highlights.** Volume and history exist, but post-workout summaries should call out
  new rep, weight, volume, and estimated-1RM records.
- **Smart in-session exercise swaps.** Exercise selection exists; use equipment, muscle group,
  session context, and history to suggest equivalent substitutions.

### Workout mechanics backlog

#### Plate calculator and gym profiles

A plate calculator should take the target total, subtract the bar, and show the plates needed per
side. It must respect the available denominations, flag weights that cannot be built exactly rather
than silently round, and allow non-standard bar weights per exercise. Put it in a modal or bottom
sheet reachable from set logging.

Named gym profiles (home, commercial, travel) should define bars, plate denominations, machines,
and achievable increments. A session chooses a profile; both the plate calculator and progression
algorithm consume it. This likely requires a `GymProfile` model, settings editor, and session-start
selector. The calculator can ship first with settings-level defaults, then adopt profiles.

#### Smart warm-up suggestions

Generate three or four removable warm-up sets from the working target (for example, 40%, 55%, 70%,
and 85% with decreasing reps). Mark warm-ups separately and exclude them from working-set and volume
analytics. Support a global toggle plus a per-session override; integrate generation into the
session start flow or `useWorkoutSessionState`.

#### Readiness and volume autoregulation

Combine sleep duration/quality from Health Connect or HealthKit, recent training load from
`WorkoutAnalytics`, and the existing daily mood input. Store the result as a daily metric, but make
the primary output an explained verdict — **push hard / normal / back off** — rather than an opaque
0–100 score. Show the two or three contributing reasons and keep the numeric score secondary.

Before a session, a low-readiness verdict can suggest trimming set count (for example, four sets to
three). The user must be able to accept, dismiss, or restore the sets in one tap. Store that choice
to support later calibration. The volume adjustment depends on the readiness model and should not
ship independently.

#### Left/right asymmetrical logging

For exercises marked unilateral, allow separate weight and reps for each side in the same set.
Add optional left/right fields to `WorkoutLogSet` while keeping current fields for backward
compatibility, expose the inputs in set details, and define volume aggregation explicitly. This
removes the current workaround of creating two exercises and makes imbalances visible.

#### Advanced set types

- **Myoreps / rest-pause clusters:** group one near-failure activation set and its short-rest
  mini-sets as a single visual unit with individual rep counts. Treat it distinctly in set-count and
  volume analytics instead of inflating normal-set totals.
- **Failure sets:** add an explicit failure designation rather than treating it as RIR 0. Intentional
  failure is analytically different from a hard-but-not-maximal set and should be programmable.

Model these as deliberate set-type semantics rather than accumulating unrelated booleans if the
schema can support a clean migration from the existing `is_drop_set` field.

#### Per-cycle program periodization

Allow each program week or cycle to vary sets, rep ranges, and RIR targets. This supports linear
periodization, rep ladders, intensity blocks, and deloads without duplicating templates. A
`cycle_config`-style structure on the template is one option, but normalize it if the editor and
query needs outgrow JSON. The session-start flow applies the active cycle.

#### Workout sections

Let users group exercises under named headings such as Main Work, Accessories, and Core. Add section
identity and ordering to template and log exercises, render headers in session/history, and expose
section assignment in the program editor. Avoid using only a free-text field if stable reordering or
renaming requires a first-class section record.

### Lower-priority workout backlog

| Feature                      | Current gap / direction                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| Session pause/resume         | Persist an in-progress session as a recoverable draft across app restarts.                         |
| Progress photos              | Verify the current body-metrics flow, then add a dedicated comparison experience if absent.        |
| Exercise technique videos    | `ViewExerciseModal` is a natural surface, but content hosting and licensing need a strategy first. |
| Spreadsheet program import   | Target a specific, validated format before building a generic importer.                            |
| Dashboard section reordering | Add only after the core dashboard/card structure stabilizes.                                       |

The muscle-group body map is specified in Tier 1 above. Wearable recovery input is part of the
readiness proposal rather than a separate feature.

---

## Cross-cutting UX — the actual differentiator

This section matters more than any individual feature above.

- **One glanceable number with a real drill-down.** The recovery app's most-loved surface is a
  single card that opens into its full derivation. The mechanism already exists here:
  `HOME_SUMMARY_CARD_SETTING_TYPE` picks between daily-summary and weekly-streak. A third option
  combining fueling + training load fits the existing seam exactly.
- **Explanations attached to metrics, not hidden in a chat.** We have
  `ProgressService.calculateInsights` and an AI coach. Put the one-line insight _on the card_, with
  "ask the coach" as the follow-up rather than the entry point. A chat you must open is a chat most
  users won't.
- **One card anatomy everywhere:** chart → stat row → plain-language why → history. The "clean,
  intuitive, well-organized" praise these apps receive is mostly this consistency, not any
  individual screen.
- **Explain every computed number.** The adaptive-nutrition app puts an ⓘ on everything, with a real
  explanation behind it. We compute _more_ sophisticated numbers than it does. Explaining them is
  how that sophistication converts into trust instead of suspicion.
- **Non-punitive framing throughout.** Reviewers specifically praise food logging that "skips the
  guilt-trip framing." Concretely: no red over-budget bars, neutral surplus/deficit wording, no
  all-or-nothing streak breaks. The fasted-days design already shows the right instinct — extend
  that tone to goal bars and check-in copy.
- **Reconsider streak loss language.** One researched app deliberately refuses gamification — no
  badges, no guilt — as positioning aimed at adults burned by mainstream trackers. We ship a
  **Weekly Streak card**. Not an argument to drop it, but "you broke your 47-day streak" is exactly
  the message that makes someone delete an app after one bad week. Best-streak framing with no loss
  language costs nothing and keeps people around.

---

## Deliberately out of scope

Listed so the decision is explicit and doesn't get relitigated:

- Biological age, health records, glucose, screen time, and general all-in-one health sprawl. That
  breadth is _precisely why_ reviewers call the researched apps' training and nutrition modules
  thin. Workouts + nutrition + sleep-as-an-input is the stronger position.
- A hard paywall on AI features. One researched app gates its intelligence layer behind a premium
  subscription and is criticized for it in nearly every review.
- Building a proprietary curated food database. Correct in principle, uneconomical for us — the
  user-correction path above captures most of the value at a fraction of the cost.

---

## Suggested build order

Ordered by value-per-effort, with dependencies respected.

1. ~~**Trend weight**~~ — ✅ shipped; it unblocks 2 and 3.
2. **Whole-series regression for empirical TDEE** — the next correctness improvement.
3. **Expenditure hero screen** — turns our best hidden asset into the reason people stay.
4. **Muscle-group body map** — data layer already exists; pure presentation work.
5. ~~**Copy day / repeat meal**~~ — ✅ shipped.
6. **Quick add + last-used serving + personal search ranking** — the logging-speed cluster; ship together.
7. **Daily nutrition quality score** — ~80% of the pipeline already exists.
8. **Non-punitive copy pass** — cheap, cross-cutting, no schema changes.
9. **Coaching modes (Coached / Collaborative / Manual)** — reframes existing multi-goal support.
10. **Overload nudges at point of entry + rest-timer auto-start** — small, high-frequency wins.
11. **Readiness verdict, then volume auto-adjustment** — combine existing mood, sleep, and training
    load; make the output actionable and explained.
12. **Weekly micro coverage, micro targets, weekly report** — the analytics digest cluster.
13. **Diet breaks, calorie cycling, rate-of-change goals** — the advanced-goal cluster.
14. **Plate calculator, then gym profiles** — ship the immediate set-logging utility before the
    larger multi-location equipment model.
15. **Smart warm-ups and explicit advanced set types** — add volume-exclusion semantics alongside
    the new logging mechanics.
16. **Asymmetrical logging, workout sections, and periodization** — valuable structural changes
    that each require coordinated schema, editor, session, history, and analytics work.
