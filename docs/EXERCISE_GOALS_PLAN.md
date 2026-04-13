# Exercise Goals — Technical Implementation Plan

## Overview

Add a first-class **exercise goal** concept that is smarter than a simple target. Because `WorkoutAnalytics.getProgressiveOverloadData()` already produces a full time series of estimated 1RMs per exercise, we can:

1. **Auto-detect the user's current estimated 1RM** from their workout history at goal creation time — no manual entry needed.
2. **Compute a weekly progression rate** via linear regression over that series.
3. **Project a realistic timeline** ("At your current rate, ~14 weeks") shown on the goal card and updated after every workout.

v1 focuses on **lifting goals only** because that is the data we have. Cardio goals (steps/day, distance, pace) are planned in the schema for future implementation once the data source (Health Connect, dedicated cardio log) is available.

---

## Goal Types

### v1 — Implemented

| Type            | Description                                          | Data source                                     |
| --------------- | ---------------------------------------------------- | ----------------------------------------------- |
| **1RM target**  | Target estimated one-rep max for a specific exercise | `workout_log_sets` via `calculateAverage1RM`    |
| **Consistency** | Min workout sessions per week                        | `workout_logs` where `completed_at IS NOT NULL` |

### v2 — Planned (schema-ready, not implemented)

| Type                     | Description                    | Data source                                     |
| ------------------------ | ------------------------------ | ----------------------------------------------- |
| **Steps per day**        | Daily step count target        | Health Connect / HealthKit                      |
| **Distance per session** | Target run/walk distance       | Health Connect / HealthKit or future cardio log |
| **Pace**                 | Target pace (min/km or min/mi) | Future cardio log                               |
| **Duration**             | Target session duration        | Future cardio log                               |

---

## How the Smart 1RM Projection Works

### Current 1RM detection

When the user selects an exercise in the creation flow, call `WorkoutAnalytics.getProgressiveOverloadData(exerciseId)`. The last data point's `estimated1RM` is the user's current baseline. Show it immediately in the UI: _"Your estimated current 1RM: 82.5 kg"_.

### Weekly progression rate (linear regression)

```
inputs: ProgressiveOverloadDataPoint[] sorted by date
         each point: { date: ms, estimated1RM: number }

n = points.length
sumX = Σ date_i          (in weeks from first point)
sumY = Σ estimated1RM_i
sumXY = Σ (date_i × estimated1RM_i)
sumX2 = Σ date_i²

slope (kg/week) = (n·sumXY − sumX·sumY) / (n·sumX2 − sumX²)
```

This lives in a new `utils/exerciseGoalProjection.ts` helper — pure function, no DB access, easy to test.

### Projection

```
weeksToGoal = (targetWeight - currentEstimated1RM) / slope

projectedDate = today + weeksToGoal weeks
```

Edge cases:

- `slope <= 0` — stalling or declining; don't show a projected date, show a warning instead.
- `n < 3` data points — too few for reliable regression; show "Log at least 3 sessions to see a projection."
- `targetWeight <= currentEstimated1RM` — goal already met at creation time; show "You may already be there — verify with a max test."
- Projection > 2 years — cap display at "over 2 years" to avoid absurd numbers.

### Re-projection after each workout

The goal card always re-runs the projection from the latest data. The projected date is **not stored** — it is computed on-the-fly so it stays accurate as the user's rate changes. This means a user who suddenly stalls will see their projected date push out automatically.

---

## Database

### New Table: `exercise_goals`

Add to `database/schema.ts`, bump `DATABASE_VERSION`, add corresponding migration in `database/migrations/index.ts`.

```ts
tableSchema({
  name: 'exercise_goals',
  columns: [
    // Exercise reference
    { name: 'exercise_id',              type: 'string',  isOptional: true, isIndexed: true },
    // Denormalised name — survives exercise rename/soft-delete
    { name: 'exercise_name_snapshot',   type: 'string',  isOptional: true },

    // Goal classification
    { name: 'goal_type', type: 'string', isIndexed: true },
    // '1rm' | 'consistency' | 'steps_per_day' | 'distance_per_session' | 'pace' | 'duration'

    // --- 1RM / Strength fields ---
    { name: 'target_weight',            type: 'number',  isOptional: true }, // kg (metric always)
    // Baseline 1RM at goal creation — used for progress % and regression anchor
    { name: 'baseline_1rm',             type: 'number',  isOptional: true }, // kg

    // --- Consistency fields ---
    { name: 'target_sessions_per_week', type: 'number',  isOptional: true },

    // --- Future cardio fields (TBA) ---
    { name: 'target_steps_per_day',     type: 'number',  isOptional: true },
    { name: 'target_distance_m',        type: 'number',  isOptional: true }, // metres
    { name: 'target_duration_s',        type: 'number',  isOptional: true }, // seconds
    { name: 'target_pace_ms_per_m',     type: 'number',  isOptional: true }, // ms per metre

    // Shared
    { name: 'target_date',              type: 'string',  isOptional: true }, // ISO date, user-overridable
    { name: 'notes',                    type: 'string',  isOptional: true },

    // Snapshot-based history (same pattern as nutrition_goals)
    { name: 'effective_until',          type: 'number',  isOptional: true }, // null = currently active

    { name: 'created_at',              type: 'number' },
    { name: 'updated_at',              type: 'number' },
    { name: 'deleted_at',              type: 'number',  isOptional: true },
  ],
}),
```

**`baseline_1rm`** is stored at creation time so the goal card can show:

- Progress % = `(current1RM - baseline1RM) / (target - baseline1RM) × 100`
- Delta since start: "+7.5 kg since you started"

This is more meaningful than raw `current / target` which would always start around 80–90% and feel fake.

---

## Model

### `database/models/ExerciseGoal.ts`

```ts
export type ExerciseGoalType =
  | '1rm'
  | 'consistency'
  | 'steps_per_day' // TBA
  | 'distance_per_session' // TBA
  | 'pace' // TBA
  | 'duration'; // TBA

export default class ExerciseGoal extends Model {
  static table = 'exercise_goals';

  @field('exercise_id') exerciseId!: string | null;
  @field('exercise_name_snapshot') exerciseNameSnapshot!: string | null;
  @field('goal_type') goalType!: ExerciseGoalType;

  @field('target_weight') targetWeight!: number;
  @field('baseline_1rm') baseline1rm!: number;

  @field('target_sessions_per_week') targetSessionsPerWeek!: number;

  // TBA cardio fields
  @field('target_steps_per_day') targetStepsPerDay!: number;
  @field('target_distance_m') targetDistanceM!: number;
  @field('target_duration_s') targetDurationS!: number;
  @field('target_pace_ms_per_m') targetPaceMsPerM!: number;

  @field('target_date') targetDate!: string | null;
  @field('notes') notes!: string | null;
  @field('effective_until') effectiveUntil!: number | null;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @readonly @date('deleted_at') deletedAt!: Date | null;
}
```

Register in `database/database-instance.ts`.

---

## New Pure Utility

### `utils/exerciseGoalProjection.ts`

Pure functions — no DB access, fully testable.

```ts
export interface ProjectionResult {
  currentEstimated1RM: number;        // kg
  weeklyProgressionRate: number;      // kg/week (can be negative)
  projectedWeeks: number | null;      // null if rate <= 0 or insufficient data
  projectedDate: Date | null;
  progressPercent: number;            // 0–100, clamped, baseline-anchored
  deltaFromBaseline: number;          // kg gained since goal started
  status: 'on_track' | 'stalling' | 'declining' | 'achieved' | 'insufficient_data';
}

export function projectGoal(
  dataPoints: ProgressiveOverloadDataPoint[],  // from WorkoutAnalytics
  baseline1rm: number,
  targetWeight: number,
): ProjectionResult { ... }

export function linearRegressionSlope(
  points: Array<{ x: number; y: number }>  // x in weeks, y in kg
): number { ... }
```

---

## Service

### `database/services/ExerciseGoalService.ts`

```ts
class ExerciseGoalService {
  // Return all goals where effective_until IS NULL
  static async getActiveGoals(): Promise<ExerciseGoal[]>;

  // Paginated history (effective_until IS NOT NULL), newest first
  static async getGoalHistory(limit?: number, offset?: number): Promise<ExerciseGoal[]>;

  // Save a new goal; marks any existing active goal for the same
  // (exercise_id, goal_type) pair as superseded in the same DB write transaction
  static async saveGoal(data: ExerciseGoalInput): Promise<ExerciseGoal>;

  static async updateGoal(id: string, data: Partial<ExerciseGoalInput>): Promise<void>;

  // Soft-delete; if goal was active, promotes the most-recent superseded goal back to active
  static async deleteGoal(id: string): Promise<void>;

  // Fetch active goal for a specific exercise + type combination
  static async getActiveGoalForExercise(
    exerciseId: string,
    goalType: ExerciseGoalType
  ): Promise<ExerciseGoal | null>;
}
```

**Supersede logic** (inside a single `database.write()` block):

```
1. Find existing active goal with same (exercise_id, goal_type)
2. If found: set effective_until = Date.now() on the old record
3. Create new goal with effective_until = null
```

Both steps happen atomically — no window where two active goals exist.

---

## Hook

### `hooks/useExerciseGoals.ts`

```ts
type Mode = 'active' | 'history';

function useExerciseGoals(options: { mode: Mode; visible: boolean }): {
  goals: ExerciseGoal[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => Promise<void>;
};
```

Subscribes reactively to `exercise_goals` table. Pauses when `visible = false`.

### `hooks/useExerciseGoalProgress.ts`

Per-goal hook. Called by each goal card individually.

```ts
function useExerciseGoalProgress(goal: ExerciseGoal): {
  projection: ProjectionResult | null;
  isLoading: boolean;
};
```

Internally:

1. Calls `WorkoutAnalytics.getProgressiveOverloadData(goal.exerciseId)` — filtered from `goal.createdAt` onward.
2. Passes result + `goal.baseline1rm` + `goal.targetWeight` to `projectGoal()`.
3. Re-runs whenever `workout_log_sets` changes (observable subscription, debounced 500 ms).

---

## UI Layer

### Creation Flow — `ExerciseGoalCreationModal.tsx`

**Step 1 — Goal type**
Two cards (v1): "Lift Goal (1RM)" and "Workout Consistency".
v2 cards shown as "Coming soon" / disabled.

**Step 2 — Exercise picker** (1RM only)

- Searchable list from `ExerciseService.getAllExercises()`
- Muscle group badge per row
- On selection: immediately call `WorkoutAnalytics.getProgressiveOverloadData(exerciseId)` and show the user's current estimated 1RM inline: _"Your estimated current 1RM: 82.5 kg — we'll use this as your starting point."_
- If no data: _"No workout history for this exercise yet. You can still set a goal — we'll start tracking from your first session."_

**Step 3 — Target & projection preview**

- Weight input (respects `getWeightUnit(units)`) with `displayToKg` conversion on save
- As user types, re-run `projectGoal()` client-side and show live: _"At your current rate, you'd reach this in ~14 weeks (approx. July 2026)"_
- Optional: target date override — if user sets a date, show whether it's realistic: _"That's faster than your current rate — you'd need to progress 15% quicker."_
- Consistency: sessions/week stepper 1–7

**Step 4 — Summary + confirm**
Shows: exercise, target, current baseline, projected timeline. Tap "Set Goal" to save.

### Goal Card — `CurrentExerciseGoalCard.tsx`

```
┌──────────────────────────────────────────────────────┐
│ Bench Press                          [1RM]  [⋮ menu] │
│                                                      │
│  Target: 100 kg                                      │
│  Current est. 1RM: 87.5 kg  (+5 kg since start)     │
│                                                      │
│  [████████████░░░░░░░░░░░░░░]  52%                  │
│                                                      │
│  At your current rate: ~6 weeks  (≈ Jun 2026)        │
│  Logging Bench Press every 4.5 days on average       │
└──────────────────────────────────────────────────────┘
```

State variants:

- **Stalling** (`weeklyProgressionRate ≈ 0`): orange warning: _"No recent progress detected. Consider adjusting your programming."_
- **Declining**: red warning: _"Your estimated 1RM has trended down recently."_
- **Achieved**: green banner: _"You've reached your goal! 🎉 Set a new one?"_
- **Insufficient data**: grey: _"Log at least 3 Bench Press sessions to see a projection."_
- **No history at all**: grey: _"No sessions logged yet. Start tracking to see progress."_

Three-dot menu: Edit / Delete.

### History Card — `ExerciseGoalHistoryCard.tsx`

Timeline style (mirrors `GoalHistoryCard`):

- Date range, exercise, type badge
- Final estimated 1RM achieved vs. target
- Outcome chip: **Achieved** (green) / **Superseded** (grey) / **Expired** (yellow, past target date)

### Entry Point

Add an "Exercise Goals" row to `GoalsManagementModal` below the nutrition content — a simple tappable card/button that opens `ExerciseGoalsManagementModal`. No tab strip needed for v1; avoids touching nutrition goal rendering.

Also a natural secondary entry point: the **post-workout PR detection** flow. When `WorkoutAnalytics.detectPersonalRecords()` fires, if the PR is relevant to an active exercise goal, show a nudge on the post-workout summary screen: _"You set a new bench press PR! You're now at 87 kg — 13 kg from your goal."_

---

## Translation File

New `lang/locales/en-us/exerciseGoals.json`:

```json
{
  "exerciseGoals": {
    "title": "Exercise Goals",
    "newGoal": "New Goal",
    "active": "Active",
    "currentGoals": "Current Goals",
    "history": "History",
    "emptyState": "Set your first exercise goal to start tracking strength progress.",
    "deleteGoal": "Delete Goal",
    "deleteGoalMessage": "This goal and its progress history will be permanently deleted.",
    "goalTypes": {
      "1rm": "Lift Goal",
      "consistency": "Consistency",
      "steps_per_day": "Daily Steps",
      "distance_per_session": "Distance",
      "pace": "Pace",
      "duration": "Duration"
    },
    "creation": {
      "title": "New Exercise Goal",
      "chooseType": "What do you want to track?",
      "comingSoon": "Coming soon",
      "chooseExercise": "Choose an Exercise",
      "searchPlaceholder": "Search exercises…",
      "currentEstimated1RM": "Your estimated current 1RM: {{value}} {{unit}}",
      "noHistoryForExercise": "No workout history yet — we'll start tracking from your first session.",
      "targetWeight": "Target {{unit}}",
      "sessionsPerWeek": "Sessions per Week",
      "targetDate": "Target Date (optional)",
      "notes": "Notes (optional)",
      "save": "Set Goal",
      "projectionPreview": "At your current rate, ~{{weeks}} weeks (≈ {{date}})",
      "projectionFaster": "That's {{percent}}% faster than your current rate.",
      "projectionSlower": "You're ahead of schedule by {{weeks}} weeks.",
      "summaryTitle": "Goal Summary"
    },
    "card": {
      "target": "Target",
      "currentEstimate": "Current est. 1RM",
      "deltaSinceStart": "+{{value}} {{unit}} since start",
      "projectedDate": "At your current rate: ~{{weeks}} weeks (≈ {{date}})",
      "averageFrequency": "Logging every {{days}} days on average",
      "stalling": "No recent progress detected. Consider adjusting your programming.",
      "declining": "Your estimated 1RM has trended down recently.",
      "achieved": "You've reached your goal! Set a new one?",
      "insufficientData": "Log at least 3 sessions to see a projection.",
      "noHistory": "No sessions logged yet. Start tracking to see progress.",
      "daysLeft": "{{days}} days left",
      "overdue": "Target date passed"
    }
  }
}
```

Add the same structure to `pt-br` and `ru-ru`.

---

## Happy Path (1RM Goal)

1. User opens GoalsManagementModal → taps "Exercise Goals →".
2. ExerciseGoalsManagementModal opens; empty state on first use.
3. Taps "New Goal" → creation modal → selects "Lift Goal".
4. Searches for "Bench Press"; modal immediately shows _"Your estimated current 1RM: 82.5 kg"_.
5. Enters target: 100 kg. Modal shows live projection: _"~14 weeks at your current rate."_
6. (Optional) sets a target date. Taps "Set Goal".
7. Service saves goal with `baseline_1rm = 82.5`, `target_weight = 100`, `effective_until = null`.
8. Goal card appears with progress bar at 0% (anchored to baseline) and the projected timeline.
9. User trains over the coming weeks. After each workout, `useExerciseGoalProgress` re-runs and the progress bar and projected date update automatically.
10. When estimated 1RM crosses 100 kg: card flips to "Achieved" state with a prompt to set a new goal.
11. User sets 120 kg → old goal's `effective_until` stamped → old goal moves to history as "Achieved → Superseded".

---

## Unhappy Paths

| Scenario                                        | Handling                                                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exercise has no workout history                 | Show "No sessions yet" state on card; progress = 0; no projection                                                                                                              |
| Fewer than 3 data points                        | Show "Log at least 3 sessions to see a projection"; progress bar still shown based on raw best weight                                                                          |
| Current rate ≤ 0 (stalling / declining)         | Show warning; omit projected date; still show progress %                                                                                                                       |
| Target ≤ current estimated 1RM at creation      | Warn: "You may already be at this level — verify with a max test." Still allow saving                                                                                          |
| Target date in the past                         | Allow creation; show "overdue" badge on card                                                                                                                                   |
| Duplicate active goal for same (exercise, type) | Service supersedes old goal automatically (in same DB transaction); no user prompt needed — this is the expected flow when upgrading a goal                                    |
| Exercise soft-deleted after goal created        | Fall back to `exerciseNameSnapshot` for display; add "Exercise deleted" warning chip on card                                                                                   |
| DB write fails mid-supersede                    | Transaction rolls back; both old and new goal remain unchanged. Surface generic error snackbar                                                                                 |
| User has imperial units                         | Weight input takes lbs, stored as kg via `displayToKg`; all display values use `kgToDisplay` + `getWeightUnit`; 1RM estimates from DB already in kg                            |
| Very large `workout_log_sets` table             | `getProgressiveOverloadData` queries by `exercise_id` through `workout_log_exercises` — ensure `exercise_id` column is indexed in the schema (check existing schema for index) |

---

## Potential Bugs

### 1. Unit conversion on save

**Risk:** User types 100 in lbs-mode; saved as 100 kg (~220 lbs). Goal immediately appears "achieved."
**Fix:** Every weight field in the creation form must use `displayToKg(value, units)` before writing to DB, and `kgToDisplay` + `getWeightUnit` when reading back. Same rule applies to `baseline_1rm` (which comes from `calculateEstimated1RMForSet` — already in kg from the DB — so only the target input needs conversion).

### 2. `baseline_1rm` not updated when editing goal

**Risk:** User edits an existing goal (changes target weight). The baseline stays at the original creation value, which is correct for progress tracking — but if the user edits months later, the baseline may be stale and show misleading progress %.
**Fix:** On edit, do not touch `baseline_1rm`. Document this. If the user wants a fresh baseline, they should create a new goal (which supersedes the old one).

### 3. Regression slope calculated over all history, not since goal start

**Risk:** User had a period of rapid progress 2 years ago. The regression over all history looks optimistic. Or: user just recovered from injury and the recent trend is the opposite.
**Fix:** Filter `getProgressiveOverloadData` to `createdAt` of the goal onward, so the projection reflects recent performance. Also offer a "last 12 weeks" cap for users with very long histories.

### 4. Missing migration causes crash on upgrade

**Risk:** Developer adds the table to `schema.ts` but forgets `database/migrations/index.ts` → WatermelonDB throws on existing installs.
**Fix:** The migration must mirror the schema exactly. Add a CI check or document in PR template. The `DATABASE_VERSION` bump alone is not sufficient — the migration entry is required.

### 5. Progress bar showing > 100% before "achieved" state

**Risk:** User blows past their target (e.g., 1RM jumps to 110 kg against a 100 kg target). Progress bar renders at 120% and breaks layout.
**Fix:** Clamp `progressPercent = Math.min(100, rawPercent)`. When `rawPercent >= 100`, switch to "Achieved" card state regardless of whether the user has explicitly acknowledged it.

### 6. Missing `.web.tsx` for charts

**Risk:** The progress bar is likely a Skia/Victory Native component. Web build crashes.
**Fix:** Use a plain `View`-based progress bar (NativeWind `bg-accent-primary`, fixed height, `width: ${percent}%`) — no chart library needed. If a sparkline of 1RM over time is added later, it needs a `.web.tsx` counterpart.

### 7. Race condition between PR detection and goal progress re-render

**Risk:** Post-workout: `detectPersonalRecords` runs, emits a PR event, and the goal card's `useExerciseGoalProgress` subscription also fires at the same time, causing duplicate re-fetches.
**Fix:** `useExerciseGoalProgress` debounces its refetch (500 ms). PR detection is a separate code path that only triggers UI in the post-workout summary — no shared state conflict.

### 8. Consistency goal — week boundary ambiguity

**Risk:** "Sessions in last 7 days" count shifts by 1 depending on when exactly the query runs relative to midnight.
**Fix:** Use `localDayStartMs` from `utils/calendarDate.ts` to anchor the window to `localDayStartMs(today) - 6 * 86_400_000`, i.e. the start of 7 full local calendar days. Same pattern the app uses everywhere else for calendar-day math.

### 9. Multiple active goals after failed transaction

**Risk:** `saveGoal` writes the supersede but crashes before the new goal insert → old goal gets `effective_until` set but no new active goal exists. Next call to `saveGoal` doesn't find an active goal and creates a second one without superseding → two goals, both `effective_until = null`.
**Fix:** Both writes happen inside a single `database.write()` block. WatermelonDB atomically queues all writes in the block — if anything throws, the whole block is rolled back. Verified: `database.write()` is transactional in both SQLite (native) and LokiJS (web).

### 10. `exerciseNameSnapshot` stale after exercise rename

**Risk:** User renames "Bench Press" to "Barbell Bench Press." History cards still show old name. That's actually fine for history — but active goal card shows stale name too.
**Fix:** Active goal card should prefer `exercise.name` (live lookup by `exercise_id`) over `exerciseNameSnapshot`. Only fall back to `exerciseNameSnapshot` when the exercise lookup returns null (deleted). History cards always use snapshot — intentional.

---

## File Map

### New Files

| File                                                 | Purpose                                     |
| ---------------------------------------------------- | ------------------------------------------- |
| `database/models/ExerciseGoal.ts`                    | WatermelonDB model                          |
| `database/services/ExerciseGoalService.ts`           | CRUD + supersede logic                      |
| `utils/exerciseGoalProjection.ts`                    | Pure projection + regression functions      |
| `hooks/useExerciseGoals.ts`                          | Reactive list hook (active + history modes) |
| `hooks/useExerciseGoalProgress.ts`                   | Per-goal projection hook                    |
| `components/modals/ExerciseGoalsManagementModal.tsx` | Top-level management modal                  |
| `components/modals/ExerciseGoalCreationModal.tsx`    | Multi-step creation/edit form               |
| `components/cards/CurrentExerciseGoalCard.tsx`       | Active goal card with progress + projection |
| `components/cards/ExerciseGoalHistoryCard.tsx`       | Historical goal card                        |
| `lang/locales/en-us/exerciseGoals.json`              | English strings                             |
| `lang/locales/pt-br/exerciseGoals.json`              | Portuguese strings                          |
| `lang/locales/ru-ru/exerciseGoals.json`              | Russian strings                             |

### Modified Files

| File                                         | Change                                                        |
| -------------------------------------------- | ------------------------------------------------------------- |
| `constants/database.ts`                      | Bump `CURRENT_DATABASE_VERSION` (currently `7` → new version) |
| `database/schema.ts`                         | Add `exercise_goals` table                                    |
| `database/migrations/index.ts`               | Add migration for new table                                   |
| `database/database-instance.ts`              | Register `ExerciseGoal` model                                 |
| `database/models/index.ts`                   | Export `ExerciseGoal`                                         |
| `database/services/index.ts`                 | Export `ExerciseGoalService`                                  |
| `components/modals/GoalsManagementModal.tsx` | Add "Exercise Goals →" entry point                            |
| `lang/locales/en-us/goalsManagement.json`    | Add entry point label keys                                    |
| `lang/locales/pt-br/goalsManagement.json`    | Add entry point label keys (pt-br)                            |
| `lang/locales/ru-ru/goalsManagement.json`    | Add entry point label keys (ru-ru)                            |

---

## Implementation Order

1. `database/schema.ts` + `database/migrations/index.ts` — bump version, add table
2. `database/models/ExerciseGoal.ts` + register in `database-instance.ts`
3. `utils/exerciseGoalProjection.ts` + unit tests (`npx jest --selectProjects node`)
4. `database/services/ExerciseGoalService.ts`
5. `hooks/useExerciseGoals.ts` + `hooks/useExerciseGoalProgress.ts`
6. Translation files (en-us, pt-br, ru-ru)
7. `ExerciseGoalCreationModal.tsx` — exercise picker + live projection preview
8. `CurrentExerciseGoalCard.tsx` + `ExerciseGoalHistoryCard.tsx`
9. `ExerciseGoalsManagementModal.tsx`
10. Wire entry point into `GoalsManagementModal`
11. Wire PR nudge into post-workout summary screen (optional, v1.5)
12. QA: imperial mode, <3 sessions state, stalling state, exercise deletion edge case

---

## Out of Scope (v1)

- **Cardio goals** (steps, distance, pace) — schema is ready; implementation deferred until Health Connect data is surfaced in the local DB or a dedicated cardio log table exists.
- **AI-suggested goals** — e.g. "Based on your data, we think you could hit 110 kg in 3 months."
- **Push notifications** on PR hits or goal achievement.
- **Shared / social goals**.
- **Sparkline chart** of 1RM progression over time on the goal card — great v2 addition using existing `getProgressiveOverloadData` data already computed.
