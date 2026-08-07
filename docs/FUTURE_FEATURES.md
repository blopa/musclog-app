# Future Features

A product-level roadmap derived from researching two well-regarded apps in adjacent categories:
one built around adaptive nutrition coaching, one built around recovery and whole-health
presentation. Neither is named here — what matters is the pattern, not the source.

**Scope guard:** this app is workouts + nutrition, with sleep read only as an input that tells the
user whether to push hard today. Everything below respects that. Features that would drag the app
toward all-in-one health sprawl are listed in [Deliberately out of scope](#deliberately-out-of-scope)
rather than silently omitted.

**Related docs — read these first, they are not repeated here:**

- [docs/workout-feature-gap.md](docs/workout-feature-gap.md) — the workout _mechanics_ backlog
  (plate calculator, warm-ups, myoreps, periodization, body map, readiness score, gym profiles…).
  Still accurate; this document adds the framing and presentation layer on top of it, and does not
  restate its items.
- [docs/NUTRITION_APP_COMPARISON_AND_IMPROVEMENTS.md](docs/NUTRITION_APP_COMPARISON_AND_IMPROVEMENTS.md)
  — earlier competitor pass; its "weight smoothing" observation is picked up and expanded below.
- [FEATURES.md](FEATURES.md) — what actually ships today.

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

### 1. Trend weight, everywhere

**Gap:** there is no weight smoothing anywhere in the codebase — no EMA, no filter, no Kalman.
Raw scale weight is what the user sees and what feeds every downstream calculation.

**What good looks like:** the primary weight number the user sees is an exponentially-smoothed
trend, with raw weigh-ins as faint dots behind it. Daily fluctuation from water, sodium and gut
content stops reading as failure.

**Build:** a `utils/trendWeight.ts` (Hacker's-Diet style EMA, α ≈ 0.25/day, or a small Kalman
filter). Feed it into the home card, [app/app/progress.tsx](app/app/progress.tsx), the check-in, and
the TDEE input path.

**Why it's first:** cheapest change with the largest perceived-quality jump, and it is a
prerequisite for items 2 and 3.

---

### 2. Fit the whole weight series, not two endpoints

**Gap:** [utils/historicalNutritionParams.ts:113](utils/historicalNutritionParams.ts#L113) derives
empirical TDEE by comparing the **first week's average** to the **last week's average**, discarding
every week in between. It is better than raw endpoints, but a user who weighed in once during week 1
has their entire expenditure estimate anchored to a single reading.

**What good looks like:** a weighted regression over trend weight across the full window. More
robust, and it yields the confidence interval that makes item 3 credible.

**Build:** extend `getHistoricalNutritionParams` to return a fitted rate-of-change plus a confidence
band instead of two scalar endpoints; `calculateTDEE` in
[utils/nutritionCalculator.ts:809](utils/nutritionCalculator.ts#L809) consumes the fitted delta. The
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
[database/services/WorkoutAnalytics.ts](database/services/WorkoutAnalytics.ts) already produces the
numbers; `MuscleService` has the seed data. The work is purely an SVG component (native + web).

**Note:** also listed as item 9 in [docs/workout-feature-gap.md](docs/workout-feature-gap.md), where
it sits last in the build order. This research argues for promoting it — it is the highest
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
`getRecentLoggedDays`; selection logic in [utils/copyDaySelection.ts](utils/copyDaySelection.ts);
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
  [utils/dynamicNutritionTarget.ts](utils/dynamicNutritionTarget.ts). The port is making the update
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
  `FoodDisplayQuality` ([utils/foodDisplayQuality.ts](utils/foodDisplayQuality.ts)), and
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

The mechanics backlog lives in [docs/workout-feature-gap.md](docs/workout-feature-gap.md) and is not
repeated. What this research adds is framing:

- **Readiness should output a verdict, not a score.** The readiness item is already specced as a
  0–100 composite. The most-cited complaint across every health app in this space is _opaque
  scores_. Ship the **verdict** — "push hard / normal / back off" — with the two or three reasons
  listed beneath it, and let the number be secondary or hidden. We have no readiness code yet, so
  this is a chance to get it right the first time rather than retrofit an explanation onto a number.
- **Progressive-overload nudges at the point of entry.** We already have smart double progression,
  `getProgressiveOverloadData`, `getRecentFirstSetAverage1RM`, and previous-set display in
  [app/app/workout/workout-session.tsx:1315](app/app/workout/workout-session.tsx#L1315). What's
  missing is the _nudge_: "you hit the top of the rep range twice — try +2.5 kg." The computation
  exists; it just isn't in front of the user at the moment of decision.
- **e1RM trend per exercise as a headline strength metric.** Calculated in
  [utils/workoutCalculator.ts](utils/workoutCalculator.ts) and used inside exercise goals, but never
  charted per lift. "Your bench e1RM is up 6 kg in 8 weeks" is the number lifters actually want.
- **Auto-start the rest timer on set completion.** There is no `autoStart` anywhere in the codebase
  — the user currently taps twice for something that should be automatic.

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

1. **Trend weight** — unblocks 2 and 3; smallest diff on this list.
2. **Whole-series regression for empirical TDEE** — correctness improvement, not just a feature.
3. **Expenditure hero screen** — turns our best hidden asset into the reason people stay.
4. **Muscle-group body map** — data layer already exists; pure presentation work.
5. ~~**Copy day / repeat meal**~~ — ✅ shipped.
6. **Quick add + last-used serving + personal search ranking** — the logging-speed cluster; ship together.
7. **Daily nutrition quality score** — ~80% of the pipeline already exists.
8. **Non-punitive copy pass** — cheap, cross-cutting, no schema changes.
9. **Coaching modes (Coached / Collaborative / Manual)** — reframes existing multi-goal support.
10. **Overload nudges at point of entry + rest-timer auto-start** — small, high-frequency wins.
11. **Readiness as a verdict** — coordinate with items 4/5 in
    [docs/workout-feature-gap.md](docs/workout-feature-gap.md).
12. **Weekly micro coverage, micro targets, weekly report** — the analytics digest cluster.
13. **Diet breaks, calorie cycling, rate-of-change goals** — the advanced-goal cluster.
