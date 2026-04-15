# Feature Gap Analysis: Workout App vs Musclog

Comparing the features described in the Workout App Reddit post against what Musclog currently has.

---

## What Musclog Already Has

- **RIR logging** — `reps_in_reserve` field is stored per set, used in 1RM calculations, and editable during/after sessions.
- **Drop sets** — `is_drop_set` flag exists in schema, model, and UI.
- **Supersets** — `group_id` groups exercises into supersets.
- **Mood tracking** — daily mood prompt, correlated with performance metrics.
- **Suggested weights** — `WorkoutTemplateService.getSuggestedWeightAndRepsForExercise` suggests starting weights for new exercises based on user profile and history.
- **Goal projection** — `utils/exerciseGoalProjection.ts` uses weighted linear regression on historical data to project when a strength goal will be achieved.

---

## Missing Features Worth Adding

### 1. RIR-Based Intra-Session Weight Adjustment

**What Workout App does:** After you log a set with an RIR rating, the app recalculates the target weight and/or reps for the *remaining sets of the same exercise* in real time. RIR 5+ → bumps weight up. RIR 0 → scales weight down.

**What Musclog does:** RIR is logged and factored into 1RM calculations, but it has no effect on the current session's upcoming sets.

**Why it's valuable:** This is the clearest UX win — turning passive RIR data into active, session-level coaching. The data and the math (`calculateAverage1RM` with RIR) are already in place; what's missing is the feedback loop that propagates the result back to unfilled sets.

**Where to build it:** `hooks/useWorkoutSessionState.ts` and `app/workout/workout-session.tsx`. After a set is saved, recompute target weight for remaining sets of the same exercise using the RIR-adjusted 1RM estimate.

---

### 2. Daily Readiness Score

**What Workout App does:** Generates a 0–100 score each morning based on sleep quality, recent training load, and subjective feel. Low readiness → automatically reduces planned sets (e.g., 4 → 3). The user can override if they feel good anyway.

**What Musclog does:** Has mood tracking and Health Connect (Android) integration, but these are not combined into a composite readiness signal, and they have no direct effect on session volume.

**Why it's valuable:** Autoregulation is backed by sports science. Users who overtrain plateau faster. A readiness score bridges the gap between data collection (mood, Health Connect sleep/HRV) and actionable training adjustments.

**Where to build it:** New `ReadinessService` that reads:
- Sleep duration/quality from Health Connect / HealthKit
- Recent training load (volume from last 3–5 sessions via `WorkoutAnalytics`)
- Daily mood input (already collected)

Output: a 0–100 score stored as a daily metric, surfaced before the workout session starts with a suggested set count adjustment.

---

### 3. Smart Between-Session Progression (Double Progression)

**What Workout App does:** Between sessions, uses the *average RIR from the last session* to decide whether to add reps, add weight, or hold. Pre-fills the next session's sets with exact targets. Not "you hit 12 reps → +2.5 kg" but a RIR-aware decision.

**What Musclog does:** The suggested weight for a new session comes from history, but there is no RIR-aware double-progression algorithm. The goal projection (`exerciseGoalProjection.ts`) predicts *when* you'll hit a goal but doesn't *prescribe* next session's targets.

**Why it's valuable:** This closes the loop between logging and planning — the app becomes prescriptive, not just descriptive. The average RIR across sets is already computable from stored data.

**Where to build it:** Extend `WorkoutTemplateService.getSuggestedWeightAndRepsForExercise` to:
1. Compute average RIR from the last session for this exercise.
2. If avg RIR ≥ 3 and reps are at the top of the target range → increase weight, reset reps to bottom of range.
3. If avg RIR 1–2 → add reps (stay in range).
4. If avg RIR 0 → hold weight, possibly reduce reps.
5. Pre-fill template/session sets with the result.

---

### 4. Readiness-Based Volume Auto-Adjustment

**What Workout App does:** If readiness is low, automatically reduces the number of sets for the day. The user can add them back manually.

**What Musclog does:** Set counts come from the workout template and are not adjusted dynamically.

**Why it's valuable:** Complements feature #2 — once readiness is computed, the natural next step is surfacing a "reduced volume mode" suggestion at the start of a session with one-tap accept/override.

**Where to build it:** In `app/workout/workout-session.tsx` (or a pre-session screen), check today's readiness score and offer to trim sets if it's below a threshold (e.g., < 40). Store the user's decision so it feeds back into future readiness calibration.

---

## Lower Priority / Already Partially Covered

| Workout App Feature | Musclog Status |
|---|---|
| Apple Watch recovery data | Android covered via Health Connect; iOS via HealthKit integration — data already flows in, just not used for readiness yet |
| Animated exercise guides | Out of scope for now |
| Social / gamification | Intentionally absent in both apps |

---

## Suggested Build Order

1. **Smart double progression** — highest leverage, builds on existing RIR data and suggestion infrastructure, no new data collection needed.
2. **Intra-session RIR adjustment** — high UX impact, math already exists, scope is contained to the session screen.
3. **Daily readiness score** — requires combining existing data sources (mood + Health Connect sleep + training load) into a new service.
4. **Volume auto-adjustment** — depends on readiness score; natural follow-on once #3 exists.
