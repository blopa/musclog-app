# Exercise Goals — Technical Implementation Plan

## Overview

Add a first-class **exercise goal** concept alongside the existing nutrition goal system. Users can set specific, measurable targets for their training (e.g. "bench press 100 kg for 5 reps", "squat 140 kg 1RM", "work out 4 days/week") and track progress automatically from their logged workout history.

---

## Goal Types

| Type                  | Description                                                             | Example                     |
| --------------------- | ----------------------------------------------------------------------- | --------------------------- |
| **Strength**          | Max weight for a given rep count on a specific exercise                 | Bench press 100 kg × 5 reps |
| **One-rep max (1RM)** | Peak estimated or tested max for a specific exercise                    | Deadlift 180 kg 1RM         |
| **Volume**            | Total weekly volume (kg × reps) for a specific exercise or muscle group | 10 000 kg/week squat volume |
| **Consistency**       | Minimum workout sessions per week                                       | Work out 4×/week            |
| **Endurance**         | Cardio: target distance, time, or pace                                  | Run 5 km in < 25 min        |

For v1, **Strength** and **Consistency** cover 90 % of user intent and are well-supported by existing data. Volume, Endurance, and 1RM can be added incrementally.

---

## Database

### New Table: `exercise_goals`

Add to `database/schema.ts`, bump `DATABASE_VERSION`.

```ts
tableSchema({
  name: 'exercise_goals',
  columns: [
    // What exercise
    { name: 'exercise_id',            type: 'string',  isOptional: true },   // FK → exercises.id; null for consistency goals
    { name: 'exercise_name_snapshot', type: 'string',  isOptional: true },   // denormalised: exercise name at creation time

    // Goal type
    { name: 'goal_type',              type: 'string'  },                     // 'strength' | '1rm' | 'volume' | 'consistency' | 'endurance'

    // Strength / 1RM fields (metric, always kg/reps)
    { name: 'target_weight',          type: 'number',  isOptional: true },   // kg
    { name: 'target_reps',            type: 'number',  isOptional: true },   // rep count

    // Volume fields
    { name: 'target_volume_per_week', type: 'number',  isOptional: true },   // kg total volume per 7-day window
    { name: 'target_muscle_group',    type: 'string',  isOptional: true },   // if volume goal is muscle-group-level

    // Consistency fields
    { name: 'target_sessions_per_week', type: 'number', isOptional: true },

    // Endurance fields
    { name: 'target_distance_m',      type: 'number',  isOptional: true },   // metres
    { name: 'target_duration_s',      type: 'number',  isOptional: true },   // seconds

    // Shared
    { name: 'target_date',            type: 'string',  isOptional: true },   // ISO date string | null
    { name: 'notes',                  type: 'string',  isOptional: true },

    // Snapshot-based history (mirrors NutritionGoal pattern)
    { name: 'effective_until',        type: 'number',  isOptional: true },   // null = currently active

    // Soft-delete + timestamps (WatermelonDB convention)
    { name: 'created_at',             type: 'number'  },
    { name: 'updated_at',             type: 'number'  },
    { name: 'deleted_at',             type: 'number',  isOptional: true },
  ],
}),
```

**Why `exercise_name_snapshot`?** Exercises can be renamed or soft-deleted. Snapshotting the name at goal creation time ensures history cards still render correctly even if the exercise record later changes.

**Why no FK constraint?** WatermelonDB does not enforce foreign keys. Orphan handling is done in the service layer.

---

## Model

### `database/models/ExerciseGoal.ts`

Follow the `NutritionGoal` pattern exactly.

```ts
export type ExerciseGoalType = 'strength' | '1rm' | 'volume' | 'consistency' | 'endurance';

export default class ExerciseGoal extends Model {
  static table = 'exercise_goals';

  @field('exercise_id') exerciseId!: string | null;
  @field('exercise_name_snapshot') exerciseNameSnapshot!: string | null;
  @field('goal_type') goalType!: ExerciseGoalType;
  @field('target_weight') targetWeight!: number;
  @field('target_reps') targetReps!: number;
  @field('target_volume_per_week') targetVolumePerWeek!: number;
  @field('target_muscle_group') targetMuscleGroup!: string | null;
  @field('target_sessions_per_week') targetSessionsPerWeek!: number;
  @field('target_distance_m') targetDistanceM!: number;
  @field('target_duration_s') targetDurationS!: number;
  @field('target_date') targetDate!: string | null;
  @field('notes') notes!: string | null;
  @field('effective_until') effectiveUntil!: number | null;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @readonly @date('deleted_at') deletedAt!: Date | null;
}
```

Register in `database/database-instance.ts` alongside the other models.

---

## Service

### `database/services/ExerciseGoalService.ts`

Mirror `NutritionGoalService`. Key methods:

```
getActiveGoals()             → ExerciseGoal[]          // all where effective_until IS NULL
getGoalHistory(limit, offset)→ ExerciseGoal[]          // paginated, most-recent-first
saveGoal(data)               → ExerciseGoal            // marks any conflicting active goal done, creates new
updateGoal(id, data)         → void
deleteGoal(id)               → void                    // soft-delete + promote previous if active
getGoalForExercise(exerciseId) → ExerciseGoal | null   // latest active goal for that exercise
```

**Conflict detection in `saveGoal`:** If an active goal for the same `exercise_id` (or same `goal_type` for consistency goals) already exists, call `markSuperseded(old, newGoal.createdAt)` — set `effective_until = now` on the old record before inserting the new one. This preserves history automatically.

**Multiple active goals allowed:** Unlike nutrition goals (one active at a time), a user can have multiple active exercise goals simultaneously — one per exercise (for strength) and one consistency goal. The service must only reject duplicates within the same `(exercise_id, goal_type)` combination.

---

## Progress Calculation

Progress is derived on-the-fly from `workout_log_sets`. No separate checkins table needed for v1.

### Strength / 1RM

```ts
async function getStrengthProgress(goal: ExerciseGoal): Promise<{ best: number; percent: number }> {
  // Query workout_log_sets joined through workout_log_exercises where exercise_id matches
  // Filter: reps >= goal.targetReps (user must achieve reps at or above target count)
  // Find: max(weight) from qualifying sets since goal.createdAt
  // Percent = Math.min(100, (best / goal.targetWeight) * 100)
}
```

For **1RM** goals, apply the Epley formula to all sets (regardless of rep count):
`estimated1RM = weight × (1 + reps / 30)`
Use the highest `estimated1RM` from all sets since goal creation.

### Volume (weekly)

Sum `reps × weight` across all sets in the last 7 days for the target exercise (or muscle group).
Compare against `goal.targetVolumePerWeek`.

### Consistency

Count distinct `workout_logs` completed in the last 7 days (where `completed_at IS NOT NULL`).
Compare against `goal.targetSessionsPerWeek`.

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

- Subscribe reactively to `exercise_goals` table changes (same pattern as `useCurrentNutritionGoal`).
- Pause subscription when `visible = false` to avoid wasted renders.
- Active mode returns only goals where `effective_until IS NULL`.

---

## UI Layer

### Entry Point — GoalsManagementModal Tab Strip

Modify `components/modals/GoalsManagementModal.tsx` to add a tab strip at the top:

```
[ Nutrition Goals ]  [ Exercise Goals ]
```

When the **Exercise Goals** tab is active, render `<ExerciseGoalsPanel />` instead of the current nutrition content. This avoids creating a separate top-level modal and keeps goal management in one place.

Alternatively (simpler for v1): add an "Exercise Goals" button/card in the management modal that opens a separate `ExerciseGoalsManagementModal`. This is lower-risk and avoids touching existing nutrition goal UI.

**Recommended approach: separate modal for v1, tab strip in v2.**

---

### New Components

#### `components/modals/ExerciseGoalsManagementModal.tsx`

Mirrors `GoalsManagementModal`:

- Header: title + "New Goal" button
- Active goals section: list of `<CurrentExerciseGoalCard />` components (one per active goal)
- History section: paginated list of `<ExerciseGoalHistoryCard />`
- Empty state: prompt to add first goal
- Opens `ExerciseGoalCreationModal` for new/edit

#### `components/modals/ExerciseGoalCreationModal.tsx`

Step-based form (single or multi-step):

**Step 1 — Goal type selector**

- Cards for: Strength, Consistency (v1); Volume, Endurance (v2)

**Step 2 — Exercise picker** (Strength / Volume only)

- Searchable list backed by `ExerciseService.getAllExercises()`
- Show muscle group badge next to each exercise
- Allow "any" for volume/muscle-group goals

**Step 3 — Target values**

- Strength: weight input (respects units setting) + rep count stepper
- Consistency: sessions/week stepper (1–7)
- Optional: target date picker
- Optional: notes field

**Step 4 — Summary + Save**

#### `components/cards/CurrentExerciseGoalCard.tsx`

Displays one active goal:

- Exercise name + muscle group chip
- Goal type badge (Strength / Consistency / …)
- Target: "100 kg × 5 reps" or "4×/week"
- **Progress bar** with current best vs. target
- "X% there" label + current best value
- Three-dot menu: Edit / Delete
- If goal has `targetDate`: days remaining pill

#### `components/cards/ExerciseGoalHistoryCard.tsx`

Timeline-style card (mirrors `GoalHistoryCard`):

- Date range achieved
- Exercise + type badge
- Final best value vs. target
- Outcome chip: "Achieved" (green) / "Superseded" (grey) / "Deleted"

---

### Where to Open ExerciseGoalsManagementModal

Add a touchable entry point in `GoalsManagementModal` (e.g. a banner at the bottom of the screen labelled "Exercise Goals →"). Alternatively, surface it from:

- `app/progress.tsx` — alongside nutrition progress charts, add an "Exercise Goals" section
- `app/settings.tsx` — under a "Goals" settings group
- Post-workout summary screen (`app/workout/workout-session.tsx` completion flow) — "You set a new PR! Set a strength goal?" prompt

---

## Translation Files

New file `lang/locales/en-us/exerciseGoals.json`:

```json
{
  "exerciseGoals": {
    "title": "Exercise Goals",
    "newGoal": "New Goal",
    "active": "Active",
    "currentGoals": "Current Goals",
    "history": "History",
    "emptyStateMessage": "Set your first exercise goal to track strength progress.",
    "deleteGoal": "Delete Goal",
    "deleteGoalMessage": "This goal and its history will be permanently deleted.",
    "goalTypes": {
      "strength": "Strength",
      "1rm": "One-Rep Max",
      "volume": "Weekly Volume",
      "consistency": "Consistency",
      "endurance": "Endurance"
    },
    "creation": {
      "title": "New Exercise Goal",
      "chooseType": "What do you want to track?",
      "chooseExercise": "Choose an Exercise",
      "searchExercises": "Search exercises...",
      "targetWeight": "Target Weight",
      "targetReps": "Target Reps",
      "sessionsPerWeek": "Sessions per Week",
      "targetDate": "Target Date (optional)",
      "notes": "Notes (optional)",
      "save": "Save Goal",
      "summary": "Goal Summary"
    },
    "progress": {
      "noDataYet": "Log a workout to see progress",
      "percentComplete": "{{percent}}% there",
      "currentBest": "Best: {{value}}",
      "daysLeft": "{{days}} days left",
      "achieved": "Achieved!",
      "overdue": "Target date passed"
    }
  }
}
```

Add parallel keys to `pt-br` and `ru-ru` locale files.

---

## Happy Path

1. User opens GoalsManagementModal → taps "Exercise Goals →" banner.
2. `ExerciseGoalsManagementModal` opens; shows empty state on first use.
3. Taps "New Goal" → `ExerciseGoalCreationModal` opens.
4. Selects "Strength" → searches for "Bench Press" → enters 100 kg, 5 reps → picks a target date → saves.
5. Goal is written to `exercise_goals` with `effective_until = null`.
6. `CurrentExerciseGoalCard` renders immediately with 0% progress.
7. User completes a workout with 90 kg × 5 reps bench press.
8. Next time the management modal opens, the card recalculates and shows 90% progress.
9. User eventually logs 100 kg × 5 reps → card shows "Achieved! 100%".
10. User sets a new goal (120 kg) → old goal's `effective_until` is set to now, new goal created → old goal appears in history as "Superseded → Achieved".

---

## Unhappy Paths

| Scenario                                                    | Handling                                                                                                                                                         |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User picks an exercise that has never been logged           | Progress shows "No workouts yet — log a session to track progress." Zero state, no crash.                                                                        |
| Target weight = 0 or negative                               | Client-side validation in form; Save button disabled.                                                                                                            |
| User deletes an exercise that is a goal target              | Goal becomes orphaned (`exercise_id` points to soft-deleted record). Use `exerciseNameSnapshot` for display; add a warning badge "Exercise deleted" on the card. |
| Duplicate active goal for same exercise                     | Service detects existing active goal for `(exercise_id, strength)` and shows confirmation: "You already have a strength goal for Bench Press. Replace it?"       |
| User tries to set a consistency goal with 0 or > 7 sessions | Validated in form (stepper clamped 1–7).                                                                                                                         |
| Target date already in the past                             | Allow but show "overdue" badge; do not block creation.                                                                                                           |
| No exercises in DB (fresh install)                          | ExerciseService seeds app exercises in `prod.ts` seeder — should always have data. Show a "No exercises found" message as fallback.                              |
| Network offline (irrelevant)                                | All data is local WatermelonDB — no network dependency.                                                                                                          |
| Very large `workout_log_sets` table → slow progress query   | Add an index on `exercise_id` in the `workout_log_sets` schema column. Consider caching last-computed progress in the model with a TTL.                          |
| Multiple concurrent writes during goal save + workout log   | WatermelonDB write queue serialises writes — no race condition possible.                                                                                         |

---

## Potential Bugs to Watch

### 1. Unit Mismatch on Input

**Risk:** User types "100" in lbs mode, but the DB expects kg. Goal is stored as 100 kg (~220 lbs) instead of 45 kg.
**Fix:** Wrap all weight inputs in the exercise goal form with `displayToKg(value, units)` before saving, and `kgToDisplay(value, units)` when reading back. Use `getWeightUnit(units)` for labels. Mandatory — same rule as the rest of the app.

### 2. Rep-Count Mismatch in Progress Calculation

**Risk:** Goal is "5 reps at 100 kg." User logs 1 rep at 105 kg (a heavy single). Should that count as achieving the 5-rep goal? No — but naively filtering `weight >= targetWeight` without checking `reps` would count it.
**Fix:** Filter sets where `reps >= goal.targetReps` before finding max weight. For 1RM goals, always apply Epley across all sets regardless of rep count.

### 3. Estimated 1RM Confusion

**Risk:** User sets a "1RM" goal of 180 kg. Their actual tested max is 170 kg, but Epley estimates 185 kg from a 160 kg × 5 set. The card shows "achieved" even though they've never actually lifted 180 kg.
**Fix:** Clearly label 1RM as "estimated" in the UI. Add a tooltip or info icon explaining the formula. Do not use the word "achieved" for estimated 1RM — use "estimated max reached".

### 4. Progress Regression After Workout Deletion

**Risk:** User deletes a workout where they hit 95 kg × 5. Progress card drops from 95% back to 80% unexpectedly.
**Fix:** This is correct behaviour — progress is always computed from current data. Document it. Optionally, store a `best_achieved` snapshot field on the goal to prevent regression for completed milestones.

### 5. Schema Version Bump Forgetting

**Risk:** Developer adds the new table but forgets to bump `DATABASE_VERSION` in `schema.ts` → WatermelonDB does not run the migration → table doesn't exist → crash.
**Fix:** The migration must also be added to `database/migrations.ts` with the exact same column definitions. CI typecheck won't catch this — add a note in the PR review checklist.

### 6. Missing `.web.tsx` for Skia/Victory Charts

**Risk:** If progress is shown as a Victory Native chart component (Skia), the web build will crash with a missing `react-native-skia` error.
**Fix:** Any chart used in the exercise goals UI must have a `.web.tsx` counterpart using the SVG-based Victory library — same pattern as existing chart components.

### 7. Orphaned `exercise_id` after Exercise Soft-Delete

**Risk:** `exercises` table entries can be soft-deleted. If a goal references a deleted exercise, `ExerciseService.getById(goal.exerciseId)` will return null.
**Fix:** Always fall back to `goal.exerciseNameSnapshot` for display. In `ExerciseGoalService.saveGoal()`, always write `exerciseNameSnapshot` at creation time.

### 8. Multiple Goals for Same Exercise Shown as "Active"

**Risk:** A bug in `saveGoal` fails to mark the previous goal as superseded (e.g. a DB write error mid-transaction), leaving two active goals for the same exercise.
**Fix:** Wrap the supersede + create in a single `database.write()` transaction. Add a uniqueness guard in `getActiveGoals()` — if two active goals exist for the same exercise, surface only the newest one and auto-fix the older one's `effective_until`.

### 9. Consistency Goal Progress — Week Boundary

**Risk:** Progress is measured as "workouts in the last 7 days." If the query runs at Monday 00:01, it covers Mon–Sun of the prior week plus the first minute of Monday, potentially double-counting or missing sessions depending on timezone.
**Fix:** Use `localDayStartMs` from `utils/calendarDate.ts` to anchor the 7-day window to local midnight boundaries, consistent with how nutrition data handles calendar dates.

### 10. Infinite Re-render on Progress Recalculation

**Risk:** The hook subscribes to `workout_log_sets` to reactively update progress. Every set log triggers a re-render of all active goal cards simultaneously.
**Fix:** Debounce the progress recalculation (300 ms) or batch updates via the WatermelonDB observable. For v1, recalculate only when the management modal is visible (gate on `visible` prop, same as `useCurrentNutritionGoal`).

---

## File Map

### New Files

| File                                                 | Purpose                            |
| ---------------------------------------------------- | ---------------------------------- |
| `database/models/ExerciseGoal.ts`                    | WatermelonDB model                 |
| `database/services/ExerciseGoalService.ts`           | CRUD + business logic              |
| `hooks/useExerciseGoals.ts`                          | Reactive hook for active + history |
| `hooks/useExerciseGoalProgress.ts`                   | Per-goal progress computation hook |
| `components/modals/ExerciseGoalsManagementModal.tsx` | Top-level management modal         |
| `components/modals/ExerciseGoalCreationModal.tsx`    | Multi-step creation/edit form      |
| `components/cards/CurrentExerciseGoalCard.tsx`       | Active goal display card           |
| `components/cards/ExerciseGoalHistoryCard.tsx`       | Historical goal card               |
| `lang/locales/en-us/exerciseGoals.json`              | English strings                    |
| `lang/locales/pt-br/exerciseGoals.json`              | Portuguese strings                 |
| `lang/locales/ru-ru/exerciseGoals.json`              | Russian strings                    |

### Modified Files

| File                                         | Change                                              |
| -------------------------------------------- | --------------------------------------------------- |
| `database/schema.ts`                         | Add `exercise_goals` table; bump `DATABASE_VERSION` |
| `database/migrations.ts`                     | Add migration for the new table                     |
| `database/database-instance.ts`              | Register `ExerciseGoal` model                       |
| `database/services/index.ts`                 | Export `ExerciseGoalService`                        |
| `components/modals/GoalsManagementModal.tsx` | Add "Exercise Goals →" entry point                  |
| `lang/locales/en-us/goalsManagement.json`    | Add exercise goals entry point label                |

---

## Out of Scope (v1)

- **AI-suggested goals** — e.g. "Based on your progress, we think you could bench 110 kg in 3 months." Can be added later using the existing AI infrastructure.
- **Goal sharing / social** — not in this app's feature set.
- **PR notifications** — "You hit a new PR!" push notification on workout completion. Depends on workout completion event hook.
- **Exercise goal check-ins** — mid-term milestones (parallel to `nutrition_checkins`). Not needed for v1 since progress is computed live.
- **Volume and Endurance goal types** — deferred to v2; schema already accommodates them.
- **Progress chart over time** — sparkline of best weight per week. Great v2 addition using existing Victory chart infrastructure.

---

## Implementation Order

1. `database/schema.ts` + `database/migrations.ts` (DB first, required for everything else)
2. `database/models/ExerciseGoal.ts` + register in `database-instance.ts`
3. `database/services/ExerciseGoalService.ts`
4. `hooks/useExerciseGoals.ts` + `hooks/useExerciseGoalProgress.ts`
5. Translation files (all three locales)
6. `ExerciseGoalCreationModal` (form — most complex piece)
7. `CurrentExerciseGoalCard` + `ExerciseGoalHistoryCard`
8. `ExerciseGoalsManagementModal` (composes the above)
9. Wire entry point into `GoalsManagementModal`
10. QA: unit tests in imperial mode, delete-exercise edge case, orphaned ID fallback
