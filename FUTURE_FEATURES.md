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
- Extend Weekly Review with richer expenditure visualization and longitudinal decision comparisons.
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
- Editable AI nutrition results before save, including macros, micros, and serving. (Meal type, date, time and portion are already editable.)
- An opt-in setting to save the photo of an AI-scanned meal to the device gallery automatically after it is logged. Today a photo can be saved or shared by hand from the full-screen viewer through the share sheet; automatic saving needs `expo-media-library` configured write-only (`savePhotosPermission`, no read permission — diff the committed `android/` manifest and `ios/` Info.plist after prebuild, since the plugin adds READ_MEDIA_* by default) and `utils/galleryImagePickerArchitecture.test.ts` kept green.
- A community server link: `DISCORD_INVITE_URL` in `constants/projectLinks.json` is null, so the website's Discord card and the app's "Join the community" menu item stay hidden until an invite exists.
- Persistent notes on logs plus explicit AI reprocessing that preserves the log's identity and date.
- A non-blocking “what if?” preview showing how a proposed meal changes today's totals.
- iOS Share Extension and Android share target for routing images into the existing analysis flow.

### Optional adjacent tools

- Water logging with goals, quick amounts, history, widgets, and optional local reminders.
- Explicit timed fasting sessions. These must remain separate from the current intentional
  fasting-day flag and must never be inferred from missing nutrition logs.

## Workouts and recovery

### High-value session improvements

- A look-ahead nudge before a set is logged, in the same one-sentence style as the between-sets and
  start-of-workout explanations.
- Name the records in the post-workout summary. `detectPersonalRecords` already returns each PR
  with its exercise and previous value, but the celebration screen shows only a count and any
  1RM-goal progress the PRs happen to touch.
- Ask about the user's equipment during onboarding and offer a one-tap gym profile from it, so the
  plate calculator and equipment-aware suggestions work before anyone opens Workout Settings.
- Per-gym machine stacks (different increments per machine) on top of the gym-wide increment.
- Typo-tolerant (edit-distance) exercise search. Today's search is exact-substring over normalized,
  stemmed words plus abbreviations and aliases; add edit distance only if real queries show it is
  still missing exercises.

### Readiness and programming

- An **adaptive** autonomy level: today the app only suggests (and explains) where a workout starts;
  adaptive would also update the plan's own prescriptions within bounds the user sets.
- Extend explicit progression rules to pyramids and drop sets; top-set back-offs already ship. Automatic progression rewrites only
  blocks of straight sets, because one number from last time cannot say how to move each of them.
- An explained **push hard / normal / back off** readiness verdict combining sleep, recent training
  load, and mood. A numeric score should be secondary to the reasons.
- User-approved volume reduction when readiness is low, with a one-tap restore path.
- Left/right values for unilateral work, with explicit aggregation rules.
- First-class advanced set types such as rest-pause clusters and intentional failure sets.
- Named workout sections and per-cycle program periodization.
- Reliable persistence and recovery of an in-progress session across app restarts.
- Progress-photo comparison after the existing body-metrics flow is audited.

### Cycle tracking follow-ups

- Native parsers for proprietary Clue/Flo archives and Apple Health XML, beyond the current CSV column-mapping wizard.
- Optional automatic client-encrypted backup to user-owned storage (WebDAV, Google Drive or iCloud) and conflict-aware multi-device sync. Backups remain manual for now, per user preference.
- Automatic wearable integrations for additional sleep/HR/HRV/skin-temperature signals; imported basal temperature remains distinct from skin temperature.
- On-device natural-language history queries beyond the current local all-word search.
- Clinically reviewed condition-specific modules and validated PMS/PMDD questionnaires; the current presets are general diaries, not validated diagnostic instruments.
- Full pregnancy care and postpartum/breastfeeding journeys, beyond the current quiet life-stage contexts, symptom diary and authoritative education links.
- Revocable live partner access with per-field permission controls, beyond current selected-field file sharing.
- A decoy screen and auto-delete for high-risk threat models, beyond the existing app lock.
- Cycle data in the AI coach, only as an explicit opt-in per conversation and never by default.
- Rotating-plan reminders ("next up: X" on the user's usual training days) and a "fully logged" check that skips the nightly nutrition overview.
- A live PR callout during the session (in-app, not a push), and a per-workout or per-weekday mute that survives past the global pause. The "Why did I get this?" sheet on a workout reminder can pause everything for a week or turn workout reminders off, but cannot silence one workout, and a plan membership has no editable reminder time (it uses the 08:00 default; only a standalone schedule stores `reminder_time`).
- Quiet hours for cycle reminders, if wanted: they honour the cycle pause today but not the workout quiet-hours window (`isSuppressed`), by design for the pill, which is an adherence tool.
- Ring, patch and injection schedules for the contraception reminder, beyond daily pill packs.
- Wearable sync status alerts ("no temperature data received today") once automatic wearable imports exist.

### Notification follow-ups

Three notification items that are designed but not built. Each lists what exists today, the intended shape, and what to check first. The research behind them is summarised in `RESEARCH.md` (competitor notification review); nothing below changes the offline-only rule — every one of these is a local schedule or a local native surface.

**Live workout surface (iOS Live Activity / Dynamic Island, Android chronometer notification).** A persistent, glanceable session state on the lock screen: current exercise, next set, a rest countdown, and +15 s / Skip actions. This is the highest-impact item of the three and the only one that needs native work.

- _Today:_ `NotificationService.updateActiveWorkoutNotification` posts a text-only ongoing notification, refreshed every `activeWorkoutUpdateSeconds` (5–60 s) from `activeWorkoutClock` in `utils/notificationPolicy.ts`. The rest end time is already persisted by `setRestTimerEndAt` (`utils/activeWorkoutStorage.ts`), so a native surface can recompute the countdown without waking JavaScript.
- _Shape:_ give the OS an **end timestamp** and let it count down (`Text(timerInterval:)` in SwiftUI, `setChronometerCountDown(true)` + `setWhen(endAt)` on Android) instead of pushing a per-second update. Update only on state changes: set completed, rest started/adjusted/stopped, exercise changed, workout finished or discarded — the same places `useWorkoutSessionController` already calls `startRest` / `adjustRest` / `stopRest` / `discard`. Compute what the surface shows in one pure function (`liveSurfaceState(sets, restEnd, now, lockScreenDetail)`) so it is unit-testable in the Jest `node` project; the native side only renders it.
- _iOS:_ ActivityKit needs a widget extension and `NSSupportsLiveActivities`. Check first whether `expo-widgets` (already used for Home widgets, `widgets/`) can host a Live Activity in this SDK; if not, add a local module like `modules/theme-app-icon`. The +15 s / Skip buttons are `LiveActivityIntent`s that write the same storage keys the in-app timer reads. Run `check-version-sync` after prebuild — the extension's version must match the app's (see the widget versioning note in `AGENTS.md`).
- _Android:_ an ongoing notification on the existing `workout-active` channel with a chronometer, or Android 16 Live Updates (`ProgressStyle`) where available; actions are `PendingIntent`s handled natively (the JS response handler is not guaranteed to be alive).
- _Must keep:_ the live session stays exempt from quiet hours and pause; the `lockScreenDetail` (`full` / `minimal`) choice must apply to what the surface shows; discarding or finishing must end it (a surface that outlives its workout is the "notifications after the workout was deleted" bug Strong fixed repeatedly). An Apple Watch / Wear OS rest haptic is a separate follow-up that depends on this one.
- _Verify on a release build_ (`npm run build-android-apk-local`, device logcat) — the project's history is that timer behaviour differs between dev and release.

**Per-category lock-screen levels for cycle reminders.** Let a person keep, for example, a detailed pill reminder but private period reminders. Today one setting (`cycleNotificationStyle`: `discreet` / `subtle` / `detailed`) styles every kind through `cycleReminderContent` in `utils/cycle/cycleReminderCopy.ts`.

- _Shape:_ an optional per-kind override stored in the encrypted cycle config — `reminders.styles?: Partial<Record<CycleReminderKind, CycleNotificationStyle>>` — falling back to the global setting. It is optional JSON, so no schema migration (add it to `cycleConfigSchema` in `utils/cycle/preferences.ts` and `CycleReminderPreferences`; check the schema is not rejecting unknown keys on restore). Resolve it in **one** pure function (`styleFor(kind, global, prefs)`) that both `CycleNotificationService` (scheduling) and `cycleReminderPreviews` (the settings preview) call, so the preview cannot promise wording the lock screen does not use.
- _UI:_ per-row style chips in `components/cycle/CycleReminderSettings.tsx`, with the live preview already there.
- _Careful:_ the pill buttons are deliberately neutral (Done / Later / Skip) and must stay so whatever the level; a snoozed copy carries the content it was scheduled with, so changing a level does not rewrite pending snoozes (acceptable, but say so in the docs if it matters). Cover the resolver, the preview/scheduling parity and a backup round-trip in tests.

**Android exact-alarm status in the delivery check.** `SCHEDULE_EXACT_ALARM` is declared in the manifest, but on Android 14+ it is denied by default for most apps, so reminders can arrive minutes late — mostly in Doze — with nothing in the app saying why.

- _Shape:_ add `exactAlarms: 'granted' | 'denied' | 'unsupported'` to both delivery statuses (`NotificationService.getDeliveryStatus` and `CycleNotificationService.getCycleDeliveryStatus`), a line in the notification settings' Delivery section and the cycle delivery sentence, and a button that opens `Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM`. Reading it needs `AlarmManager.canScheduleExactAlarms()`: a few lines in a local module (or an existing one), not a new dependency. iOS and web report `unsupported`. In `utils/cycle/cycleReminderStatus.ts` this is one more state of `cycleDeliveryState` (the status sentence and its tests are pure there).
- _Verify first:_ whether the installed `expo-notifications` already schedules with `setExactAndAllowWhileIdle` when the permission is held and falls back otherwise — that decides whether this is a status line or also a behaviour change.
- _Scope:_ the rest alert and the work timer are the only reminders where minutes of lateness matter; workout and cycle reminders are fine inexact. Never ask for the permission at launch — only from this status line.

### Exercise goals v2

The schema reserves `steps_per_day`, `distance_per_session`, `pace`, and `duration`, but the UI
currently disables them. Distance and duration of a logged walk/run are now stored on
`workout_logs` (`distance_m`, `activity`), so the data these goals need exists; what is missing is
the goal logic and UI. Implement them only with matching service logic, unit conversion,
history/progress calculation, localization, and tests. Keep one active consistency goal invariant
and the existing 1RM/consistency behavior intact.

## AI, platform automation, and continuity

- Inline voice input for Loggy that uses the same send path as typed messages and preserves image
  attachments and armed intentions.
- Ordered AI-provider failover on top of the shared error classification, bounded retry and
  credential guidance that now exist (`utils/aiErrors.ts`). Do not fail over malformed requests as
  if they were transient outages, and never fail over an invalid-key error to another provider
  silently.
- Optional on-device food-description fallback on supported Apple hardware, clearly gated by
  runtime availability and language.
- Siri/App Intents for log food, calories today, and log weight, using the same validation and sync
  paths as the app.
- Spotlight indexing for user-owned foods, meals, exercises, and templates, with one privacy toggle
  that also purges the index.
- Watch companion, in two steps: first a read-only snapshot (a watchOS target over WatchConnectivity
  and a Wear OS tile showing today's workout, the current set and the rest timer), then writes from
  the watch once a conflict policy exists (see RESEARCH.md, "Watch companion").
- Notes per set, and editing a finished workout's note from its detail view (today the workout note
  is written when finishing, and exercise notes in the session).
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
