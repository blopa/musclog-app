# Workout App Feature Gap Analysis

Comparing features from two well-regarded workout apps (researched from their marketing pages, help docs, newsletters, and user discussions) against what Musclog currently has.

---

## What Musclog Already Has

- **RIR logging** — `reps_in_reserve` stored per set, used in 1RM calculations, editable during/after sessions.
- **Drop sets** — `is_drop_set` flag in schema, model, and UI.
- **Supersets** — `group_id` groups exercises together.
- **Partial reps** — `partials` field tracked per set and displayed in workout history.
- **Workout templates and programs** — structured sessions with exercises and sets.
- **Rest timer** — dedicated screen (`app/workout/rest-timer.tsx`).
- **Custom exercises** — `CreateExerciseModal.tsx` lets users build their own.
- **Free/unstructured sessions** — `FreeSessionExerciseCompleteModal.tsx`.
- **Exercise reordering** — `ExerciseService.reorderWorkoutLogExercises()`.
- **Workout history** — with filtering and browsing.
- **1RM calculation** — seven formulas, RIR-aware, in `utils/workoutCalculator.ts`.
- **Goal projection** — weighted linear regression predicts when a strength goal is reached (`utils/exerciseGoalProjection.ts`).
- **Suggested starting weights** — `WorkoutTemplateService.getSuggestedWeightAndRepsForExercise` uses history and user profile.
- **Smart double progression** — RIR-aware between-session algorithm in `getSuggestedWeightAndRepsForExercise`; Weight-First and Reps-First modes configurable in settings.
- **Intra-session RIR adjustment** — after each set, remaining sets of the same exercise are recomputed using the RIR-adjusted 1RM; auto-adjusted sets flagged with `isAutoAdjusted` (`hooks/useWorkoutSessionState.ts`).
- **Volume and progress charts** — `components/progress/WorkoutCharts.tsx`.
- **Body metrics tracking** — weight, measurements.
- **Mood tracking** — daily prompt, correlated with performance.
- **AI-powered coaching** — OpenAI / Gemini for workout analysis and meal tracking.
- **Health Connect (Android) + HealthKit (iOS)** — fitness data sync.
- **Exercise equipment field** — used in exercise filtering and suggestions.
- **Muscle group field on exercises** — used in analytics.

---

## Missing Features Worth Adding

### 1. Plate Calculator

**What competitors do:** During an active workout, a calculator takes a target total barbell weight, subtracts the bar, and tells you exactly which plates to load per side. Respects available plate denominations (from gym profile) and the bar weight. Flags when the exact weight can't be built with available plates rather than silently rounding. Configurable per exercise for non-standard bars (safety squat bar, EZ bar, etc.).

**What Musclog does:** No plate calculator.

**Why it's valuable:** A very concrete, everyday friction point for barbell lifters. Mentally converting "85 kg on the bar" to plates every set is unnecessary work that this tool eliminates entirely.

**Where to build it:** A modal or bottom sheet accessible from the set-logging area in `app/workout/workout-session.tsx`. Inputs: target weight, bar weight (default from settings or exercise config), available plate denominations (from a gym equipment setting). Output: plate configuration per side.

---

### 2. Gym Profiles (Multi-Location Equipment Config)

**What competitors do:** Users create named profiles (home gym, commercial gym, travel gym) each specifying available bars, plate denominations, and machines. Smart Progression uses the active profile to know what weight increments are achievable. Different workout days in a program can use different profiles.

**What Musclog does:** Equipment is a field on exercises, but there's no per-location equipment inventory or progression-aware plate denomination config.

**Why it's valuable:** Many users train at multiple locations. The app currently can't know that the home gym only has 5 lb plate increments vs. the commercial gym with 2.5 lb. This affects what progression increments are realistic.

**Where to build it:** New `GymProfile` model in the database with name, bar weights, and plate sets. A settings screen to create/edit profiles. A profile selector when starting a session. The plate calculator and progression algorithm both read the active profile.

---

### 3. Smart Warm-Up Suggestions

**What competitors do:** Before working sets, the app auto-generates warm-up sets (labeled separately, excluded from volume totals) with calculated weights and rep counts based on the working set targets. Heavier working weights produce heavier, more graduated warm-up progressions. Can be toggled globally or per-session, and individual warm-up sets can be removed.

**What Musclog does:** No warm-up set generation. Users add warm-up sets manually.

**Why it's valuable:** Proper warm-ups reduce injury risk and are easy to skip when they require mental effort. Auto-generation removes the friction.

**Where to build it:** A function that takes working set weight and generates 3–4 warm-up sets (e.g., 40%, 55%, 70%, 85% of working weight × decreasing reps). Integrate into `useWorkoutSessionState` or the session start flow. Warm-up sets use a separate flag so they're excluded from `WorkoutAnalytics` volume calculations.

---

### 4. Daily Readiness Score

**What competitors do:** A 0–100 composite score generated each morning from sleep quality, recent training load, and subjective feel. Low readiness → app suggests reducing set count (e.g., 4 → 3). User can override either way.

**What Musclog does:** Mood tracking and Health Connect / HealthKit integration exist separately but are not combined into a composite readiness signal, and neither currently affects session volume.

**Why it's valuable:** Autoregulation is backed by sports science. Overtraining leads to plateaus; undertraining when recovered is a missed opportunity. Bridging the collected data (mood, sleep, training load) into an actionable score is the missing step.

**Where to build it:** New `ReadinessService` that reads:

- Sleep duration/quality from Health Connect / HealthKit (already integrated)
- Recent training load from `WorkoutAnalytics` (last 3–5 sessions)
- Daily mood input (already collected)

Score stored as a daily user metric. Surfaced before a session starts with a suggested set count delta (accept/override).

---

### 5. Readiness-Based Volume Auto-Adjustment

**What competitors do:** If readiness is below a threshold, the session automatically trims sets. The user can add them back with one tap.

**What Musclog does:** Set counts come from the workout template and are not dynamically adjusted.

**Why it's valuable:** Natural follow-on to the readiness score — makes the score actionable rather than just informational.

**Where to build it:** Pre-session screen or prompt in `app/workout/workout-session.tsx`. Check today's readiness and, if below a configurable threshold (e.g., 40), show a "Low readiness — reduce to N sets?" banner with accept/dismiss. Store the decision to inform future readiness calibration.

---

### 6. Left/Right Asymmetrical Logging

**What competitors do:** For unilateral exercises (single-arm rows, Bulgarian split squats, etc.), users can log different weights and different reps for each side independently within the same set entry.

**What Musclog does:** A single weight and rep count per set with no side distinction.

**Why it's valuable:** Strength imbalances between sides are common and important to track for injury prevention and programming decisions. Currently users have to approximate or use workarounds (two separate exercises).

**Where to build it:** Add optional `weight_left`, `reps_left`, `weight_right`, `reps_right` fields to `WorkoutLogSet` (alongside the existing single-value fields for backward compatibility). In the set-logging UI (`EditSetDetailsModal`), show side inputs when the exercise is flagged as unilateral. Volume calculations aggregate both sides.

---

### 7. Myoreps / Rest-Pause Cluster Sets

**What competitors do:** A tracked set type (labeled separately from normal, failure, drop, and partial sets) that implements the rest-pause protocol: one near-failure set, then multiple mini-sets with very short rest at the same weight. All mini-sets are grouped as one entry with individual rep counts logged.

**What Musclog does:** Drop sets are supported, but myoreps are not a distinct type. Users would need to log them as separate sets manually.

**Why it's valuable:** Myoreps are a popular advanced hypertrophy technique. First-class support means they show up correctly in volume analytics rather than inflating set counts.

**Where to build it:** Add `is_myo_rep` boolean to `WorkoutLogSet` schema (similar to `is_drop_set`). In the session UI, offer it as a set type option. Group the mini-sets visually and log them under the parent set entry.

---

### 8. Per-Cycle Program Periodization

**What competitors do:** Programs support per-week/cycle configuration — you can set different sets, rep ranges, and RIR targets for each cycle of the program. This enables linear periodization (ramp weight, constant reps), rep ladders, intensity blocks, and deload weeks all within a single program structure, without duplicating workouts manually.

**What Musclog does:** Templates have fixed sets/reps. No concept of cycles or per-week variation within a program.

**Why it's valuable:** Without periodization, users either plateau (same stimulus forever) or have to manually edit their program repeatedly. Cycles are the standard structure for intermediate-to-advanced programming.

**Where to build it:** Add a `cycle_config` JSON field to `WorkoutTemplate`. In the program editor, add a "Periodization" toggle that reveals per-cycle set/rep/RIR configuration. The session start flow reads the current cycle and applies the appropriate targets.

---

### 9. Body Map / Muscle Group Volume Visualization

**What competitors do:** An anatomical body illustration where each muscle group is color-coded by training volume in the current week/cycle. Provides an immediate visual summary of training balance and neglected areas.

**What Musclog does:** `WorkoutCharts.tsx` has volume charts, and exercises have muscle group fields. But there is no body-map-style visualization.

**Why it's valuable:** Charts require interpretation; a color-coded body silhouette communicates muscle balance instantly, especially useful for spotting neglected groups.

**Where to build it:** A new component using an SVG body silhouette with muscle regions mapped to color intensity. Data source: aggregate sets/volume per muscle group over the selected period from `WorkoutAnalytics`. Works on both native (via Skia/SVG) and web.

---

### 10. Workout Sections

**What competitors do:** A single workout can be divided into named sections (e.g., "Main Work," "Accessory Work," "Core"). Exercises are grouped under sections, giving the workout a clear structure when it contains many exercises.

**What Musclog does:** All exercises in a session are in a flat list (ordered by the `order` field). No sections.

**Why it's valuable:** Programs with 8–12 exercises per session benefit significantly from sectioning. It also maps directly to how coaches write programs.

**Where to build it:** Add a `section` string field to `WorkoutLogExercise` and `WorkoutTemplateExercise`. Render section headers in the session and history views. The program editor allows naming sections and assigning exercises to them.

---

### 11. Failure Sets as an Explicit Set Type

**What competitors do:** "Failure set" is a distinct set type, separate from RIR 0. Logging to failure explicitly is tracked and can be programmed (e.g., "last set of block uses failure sets").

**What Musclog does:** RIR 0 approximates this but isn't a formal "to failure" designation. No distinct failure set type.

**Why it's valuable:** Training to failure is meaningfully different from RIR 0 (which implies one could do one more rep but didn't). Explicit tracking lets analytics distinguish intentional failure from hard-but-not-maximal sets.

**Where to build it:** Add `is_failure` boolean to `WorkoutLogSet` (alongside `is_drop_set`). Surface it as a set type chip in the logging UI.

---

## Lower Priority / Already Partially Covered

| Feature                           | Musclog Status                                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Estimated 1RM tracking            | Calculated in `workoutCalculator.ts`; could be surfaced more prominently as a PR tracker                               |
| Smart exercise swap               | Exercise selection exists; "smart" context-aware swap during a session is missing                                      |
| PR tracking                       | Volume/history exists; explicit PR highlighting in post-workout summary is missing                                     |
| Progress photos                   | Body metrics exist; dedicated photo comparison flow is unclear — worth verifying                                       |
| Session pause/resume              | Workout sessions don't persist state across app restarts — could be added via WatermelonDB draft records               |
| Wearable integration for recovery | Android: Health Connect already integrated; iOS: HealthKit integrated — data flows in but isn't used for readiness yet |
| Exercise technique videos         | `ViewExerciseModal` exists; video content would require a content strategy (hosting, licensing)                        |
| Spreadsheet program import        | Not present; likely low ROI unless a specific program format is targeted                                               |
| Dashboard section reordering      | No modular dashboard; add after core features are solid                                                                |

---

## Suggested Build Order

1. **Plate calculator** — concrete everyday value for barbell users; self-contained UI.
2. **Smart warm-up suggestions** — reduces pre-set friction; straightforward algorithm with clear volume-exclusion rules.
3. **Left/right asymmetrical logging** — schema addition + UI; strong value for unilateral training.
4. **Failure sets as an explicit type** — small schema change, high semantic value.
5. **Myoreps** — niche but loyal audience; schema mirrors existing drop set pattern.
6. **Workout sections** — adds structure to complex sessions; schema + UI change.
7. **Daily readiness score** — requires combining existing data sources (mood + Health Connect sleep + training load).
8. **Volume auto-adjustment** — depends on readiness score; natural follow-on.
9. **Gym profiles** — foundational for accurate plate calculator and progression; more complex schema + settings UI.
10. **Per-cycle periodization** — significant schema and UX work; high value for intermediate/advanced users.
11. **Body map visualization** — SVG illustration work; compelling visual but not blocking progress.
