# Musclog — Future Features

This is the product and engineering backlog. A feature belongs in
[CURRENT_FEATURES.md](CURRENT_FEATURES.md) only after it ships.

Musclog should stay focused on workouts, nutrition, and the recovery signals that make those two
areas more useful. The strongest opportunities are not more disconnected trackers; they are better
inputs, clearer explanations, faster logging, and more useful presentation of data the app already
collects.

## Near-term priorities

1. **Fit empirical TDEE over the whole trend-weight series.**
   `utils/historicalNutritionParams.ts` currently uses the trend-weight endpoints. A weighted fit
   over the complete window would use more information and provide a defensible confidence band.
2. **Make energy expenditure a first-class progress view.**
   Plot estimated expenditure and its confidence over time, with plain-language explanations for
   meaningful changes.
3. **Add a muscle-load body map.**
   Render rolling working-set volume from `WorkoutAnalytics` on front/back body silhouettes, with
   the most- and least-trained muscle groups called out.
4. **Make repeat nutrition logging faster.**
   Build a Saved Meals hub with recent, frequent, and favorite items; rank personal history in
   search; remember the last serving; support quick macro-only entries and multi-select add.
5. **Improve AI capture before adding more AI surfaces.**
   Support a bounded multi-photo draft, editable review, deterministic retry/cancel behavior, and
   share-to-Musclog entry points that reuse the existing crop and review pipeline.

## Nutrition and coaching

### Energy balance and goals

- Coaching modes: **Coached**, **Collaborative**, and **Manual**, so users understand whether the
  app or the user owns target changes.
- Explained weekly target updates based on the existing check-in and dynamic-target logic.
- Rate-of-change goals expressed as percentage of body weight per week, with a projected date and
  warnings for aggressive choices.
- Planned maintenance phases, diet breaks, calorie cycling, and weekly calorie budgets.
- A daily nutrition-quality score derived from normalized Nutri-Score, Eco-Score, NOVA, and label
  data, weighted by the food's contribution to the day.
- Weekly micronutrient coverage and age/sex-appropriate targets instead of isolated per-food values.
- A weekly nutrition report covering adherence, average intake, logged days, and macro balance.

### Faster capture and correction

- A first-class Saved Meals hub with search, favorites, frequency/recency ranking, and one-tap log.
- Last-used and custom named servings, while keeping grams as the stored source of truth.
- Quick-add calories/macros without creating a reusable food.
- Multi-select food search and serving shortcuts such as ½, 1, 1½, and 2.
- Local corrections for inaccurate provider data, with optional upstream submission where the
  Musclog API supports it.
- Multi-photo AI analysis with an optional context note and a recoverable draft.
- Editable AI nutrition results before save, including macros, micros, serving, meal type, and time.
- Persistent notes on logs plus explicit AI reprocessing that preserves the log's identity and date.
- A non-blocking “what if?” preview showing how a proposed meal changes today's totals.
- iOS Share Extension and Android share target for routing images into the existing analysis flow.

### Optional adjacent tools

- Water logging with goals, quick amounts, history, widgets, and optional local reminders.
- Explicit timed fasting sessions. These must remain separate from the current intentional
  fasting-day flag and must never be inferred from missing nutrition logs.

## Workouts and recovery

### High-value session improvements

- Progressive-overload nudges at set entry using the existing recent-set and 1RM calculations.
- Per-exercise estimated-1RM trend charts and explicit post-workout PR highlights.
- Optional automatic rest-timer start when a performed set is completed.
- Contextual exercise substitutions based on equipment, muscle group, session, and history.
- A plate calculator, followed later by named gym profiles with bars, plates, machines, and minimum
  increments.
- Smart, removable warm-up sets that are excluded from working-set volume.

### Readiness and programming

- An explained **push hard / normal / back off** readiness verdict combining sleep, recent training
  load, and mood. A numeric score should be secondary to the reasons.
- User-approved volume reduction when readiness is low, with a one-tap restore path.
- Left/right values for unilateral work, with explicit aggregation rules.
- First-class advanced set types such as rest-pause clusters and intentional failure sets.
- Named workout sections and per-cycle program periodization.
- Reliable persistence and recovery of an in-progress session across app restarts.
- Progress-photo comparison after the existing body-metrics flow is audited.

### Exercise goals v2

The schema reserves `steps_per_day`, `distance_per_session`, `pace`, and `duration`, but the UI
currently disables them. Implement them only with matching service logic, unit conversion,
history/progress calculation, localization, and tests. Keep one active consistency goal invariant
and the existing 1RM/consistency behavior intact.

## AI, platform automation, and continuity

- Inline voice input for Loggy that uses the same send path as typed messages and preserves image
  attachments and armed intentions.
- Ordered AI-provider failover with shared error classification, bounded retry, and precise
  credential guidance. Do not fail over malformed requests as if they were transient outages.
- Optional on-device food-description fallback on supported Apple hardware, clearly gated by
  runtime availability and language.
- Siri/App Intents for log food, calories today, and log weight, using the same validation and sync
  paths as the app.
- Spotlight indexing for user-owned foods, meals, exercises, and templates, with one privacy toggle
  that also purges the index.
- Read-only Apple Watch snapshots and complications before adding mutations from the watch.
- iOS widget parity and more focused widgets backed by versioned snapshots rather than direct
  database access.
- Health-backed reinstall recovery once stable cross-source deduplication identifiers exist.

## Cross-cutting UX

- Put concise explanations next to computed metrics; use the coach as a follow-up, not the only
  place where the reasoning is visible.
- Standardize card anatomy: chart, key stats, plain-language explanation, then history.
- Use neutral over/under-target language and avoid punitive streak-loss messaging.
- Every numeric editor must accept the active locale's decimal separator and every bottom action
  must be tested with gesture navigation, three-button navigation, safe areas, and the keyboard.
- Implement a real light palette before exposing light/system theme choices as distinct visuals.
- Add high-contrast and reduced-motion audits after both palettes are complete.

## Engineering backlog

- Finish the remaining source TODOs in `GenericEditModal`, `WorkoutSummaryCelebration`,
  `NotificationCard`, and the skipped edit-mode test in `useWorkoutForm.test.ts`.
- Revisit navigation loading work that remains unfinished: skeleton shimmer, progress-screen
  skeletons, parallel daily nutrition queries, and a shared boot-time user subscription.
- Consider NativeWind-to-Uniwind only as a deliberate migration. Re-check package compatibility,
  web/native output, safe-area utilities, Tailwind formatting, and every patched NativeWind bug at
  the versions used when the work starts; the deleted step-by-step proposal was version-specific.
- On the next Expo upgrade, test whether the exact `@babel/plugin-transform-react-jsx` pin and the
  patches listed in [FIXES.md](FIXES.md) can be removed.

## Deliberately out of scope

- General health-record, glucose, screen-time, or “biological age” tracking.
- A proprietary curated food database; user correction and source normalization are the better
  investment for this project.
- A hard AI paywall or a requirement to configure AI before the core app works.
- Game Boy-to-Game Boy receive support. Musclog GB remains sender-only.
