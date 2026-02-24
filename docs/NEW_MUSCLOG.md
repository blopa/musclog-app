
Here’s a concise comparison and what’s still missing in **musclog-new**.

---

## Architecture (as you noted)

- **musclog-app**: Two DB layers — **mobile** `utils/database.ts` (expo-sqlite) and **web** `utils/database.web.ts` (Dexie), with shared logic in `utils/databaseCommon.ts`.
- **musclog-new**: Single **WatermelonDB** layer (`database/schema.ts`, `adapter.ts` / `adapter.web.ts`) for web and mobile. Schema and services are shared; only the adapter is platform-specific.

---

## What’s implemented in musclog-new (and where it lives)

| Area | musclog-new status |
|------|--------------------|
| **Workouts** | Workout list, session, rest timer, summary, create/edit template, add/replace exercise, history modals, analytics (volume, estimated 1RM, PRs). |
| **Nutrition** | Daily food log by date (`/nutrition/food`), meal sections, add food, search, barcode scan, custom food, my meals, nutrition goals (onboarding + modal). |
| **User & body** | Profile, edit personal/fitness, body metrics (weight, body fat, height, etc.) via `UserMetricService`, add/edit in modals, BodyMetricsHistoryModal, DataLogModal (metrics + food data). |
| **Exercises** | Exercise library in modals (ExercisesModal, AddExerciseModal, CreateExerciseModal, ReplaceExerciseModal, DataLogModal). No standalone “list exercises” screen. |
| **Settings** | Basic, advanced (export/import, account deletion), AI settings (API keys, models). Export/import use `database/exportImport.ts` and `utils/file` (platform-specific). |
| **Onboarding** | Landing, personal info, fitness info, Health Connect, Google connect, set goals, nutrition goals + results. |
| **Health Connect** | Hooks and sync services exist; onboarding step for connecting. |

---

## Gaps in musclog-new (features from musclog-app not yet there)

### 1. **Progress screen (missing route)**

- **musclog-app**: No dedicated “progress” screen in the drawer; dashboard and user metrics charts cover progress.
- **musclog-new**: `UserMenuModal` has `onProgressPress={() => router.push('/progress')}` but there is **no** `app/progress.tsx`, so the link leads to a missing route.

**Suggestion:** Add `app/progress.tsx` (e.g. weight/body metrics over time, workout volume, nutrition summary) or point “Progress” to an existing screen (e.g. profile/body metrics).

---

### 2. **Dedicated “User metrics charts” screen**

- **musclog-app**: Full-screen `userMetricsCharts.tsx` with weight line chart, nutrition charts, bar charts, filters, TDEE, weekly averages, etc.
- **musclog-new**: Body metrics are in profile (latest values, “View history” → BodyMetricsHistoryModal) and in Advanced Settings (UserMetricDataModal). No dedicated **charts** screen (weight over time, nutrition vs goals, etc.).

**Suggestion:** Add a “Progress” or “Charts” screen that uses `UserMetricService` / `useUserMetrics(mode: 'history')` and existing chart components to replicate the old app’s metrics/charts experience.

---

### 3. **One-rep max (1RM) management screen**

- **musclog-app**: `oneRepMaxes.tsx` — list exercises and set/view 1RM per exercise; used for suggested weights when creating workouts.
- **musclog-new**: `WorkoutAnalytics` computes **estimated** 1RM (Epley) and uses it for PR detection. There is **no** screen to **set or view** 1RM per exercise, and no stored “one rep max” table in the schema.

**Suggestion:** Either add a dedicated “One rep maxes” screen (and, if you want parity with the old app, a small 1RM store or reuse of existing analytics), or at least expose current estimated 1RMs somewhere (e.g. profile or exercise detail).

---

### 4. **AI chat and workout generation**

- **musclog-app**: Full **Chat** screen: real backend (`sendChatMessage`, `generateWorkoutPlan`), custom render (workout cards, actions), unread badge, workout generation success flow.
- **musclog-new**: **CoachModal** uses GiftedChat with **mock messages**; `onSend` only appends locally. No `sendChatMessage`, no `generateWorkoutPlan`, no persistence. Locale: “AI workout generation coming soon!”. Gemini/utils exist but are not wired to the coach.

**Suggestion:** Connect CoachModal to your AI backend (e.g. `sendChatMessage`), add optional workout generation (e.g. `generateWorkoutPlan`) and a success flow similar to the old app.

---

### 5. **AI nutrition: photo/label and retrospective**

- **musclog-app**: `estimateNutritionFromPhoto`, `extractMacrosFromLabelPhoto`, `parseRetrospectiveNutrition`; RetrospectiveFoodTrackingModal; Health Connect sync for nutrition.
- **musclog-new**: **SmartCameraModal** has barcode working; for **AI meal photo** and **AI label scan** there is a TODO and placeholder (e.g. “Implement actual AI processing here”). No `parseRetrospectiveNutrition` or retrospective food-tracking flow.

**Suggestion:** Implement AI meal/label handlers (using your existing Gemini/API) and, if you want parity, a retrospective nutrition flow similar to the old app.

---

### 6. **Fitness goals as a separate history**

- **musclog-app**: **FitnessGoals** table and screens: list + create fitness goals (macro targets, goal type, etc.) with history.
- **musclog-new**: **Fitness goal** is a **user profile** field (`User.fitnessGoal`) and **nutrition_goals** table holds calorie/macro targets. GoalsManagementModal exists. There is no separate “list/create fitness goals” **history** like the old app.

**Suggestion:** If you need “fitness goal history” (multiple past goals with dates), add a small goals history model/screen; otherwise the current single current goal + nutrition goals may be enough.

---

### 7. **Workout schedule / upcoming workouts**

- **musclog-app**: `getRecurringWorkouts`, dashboard shows “upcoming workouts”; drawer had ScheduleWorkout (commented out).
- **musclog-new**: **Schedule** model and `ScheduleRepository.getForDay(dayOfWeek)` exist (template + day + reminder_time). There is **no** UI to assign templates to days, set reminder times, or show “upcoming workouts” on home or elsewhere.

**Suggestion:** Add a “Schedule” or “Upcoming” section (e.g. on home or workout tab) that uses `Schedule` and optionally expo-notifications for reminders.

---

### 8. **Scheduled notifications**

- **musclog-app**: `configureNotifications.ts` + `configureDailyTasks` / `configureWeeklyTasks`: expo-notifications for nutrition/workout insights at set times.
- **musclog-new**: Settings has a **notifications** toggle and **NotificationsModal** (UI only, mock data). Comment in `index.tsx`: “No notification system yet”. No expo-notifications scheduling.

**Suggestion:** When you’re ready, add notification scheduling (e.g. workout reminders from `Schedule.reminder_time`, optional weekly/daily insights) using expo-notifications and respect the settings toggle.

---

### 9. **Standalone “list foods” / “list meals” screens (optional)**

- **musclog-app**: Dedicated **listFoods** and **listMeals** screens in the drawer.
- **musclog-new**: Foods are reached via search, create custom food, and DataLogModal “manage food library”; meals via **MyMealsModal**. No dedicated full-screen “list all my foods” or “list all my meals”.

**Suggestion:** Only add if you want exact parity; the current search + modals may be enough.

---

### 10. **Standalone “list exercises” screen (optional)**

- **musclog-app**: **listExercises** as its own drawer screen.
- **musclog-new**: Exercises are in **modals** (workout creation, replace exercise, data log). No dedicated “Exercises” tab/screen.

**Suggestion:** Add a top-level “Exercises” screen only if you want a single place to browse/edit the full library like the old app.

---

## Summary table

| Feature | musclog-app | musclog-new |
|--------|-------------|-------------|
| Progress route | — | **Missing** (link exists, no screen) |
| User metrics **charts** screen | ✅ userMetricsCharts | ❌ (only profile + modals) |
| One-rep max **screen** | ✅ oneRepMaxes | ❌ (only estimated 1RM in analytics) |
| AI Chat (real backend) | ✅ Chat + sendChatMessage | ❌ CoachModal mock only |
| AI workout generation | ✅ generateWorkoutPlan | ❌ “Coming soon” |
| AI meal/label photo | ✅ | ❌ TODO in SmartCameraModal |
| Retrospective nutrition | ✅ | ❌ |
| Fitness goals **history** | ✅ list/create screens | ⚠️ User goal + nutrition goals only |
| Schedule / upcoming workouts | ✅ (data + dashboard) | ❌ Schema only, no UI |
| Scheduled notifications | ✅ expo-notifications | ❌ Toggle + UI only |
| List foods / list meals screens | ✅ | ⚠️ Via search/modals (optional) |
| List exercises screen | ✅ | ⚠️ In modals only (optional) |

---

## Suggested order of work

1. **Add `/progress`** (or reuse another route) so the user menu doesn’t 404.
2. **Progress/Charts screen** using existing `UserMetricService` and chart components.
3. **1RM screen** (and optional 1RM storage) if you want to match the old app’s “set 1RM per exercise” flow.
4. **Wire CoachModal to AI** (chat API + optional workout generation).
5. **AI for camera** (meal + label) and optional retrospective nutrition.
6. **Schedule UI** (assign templates to days, reminder time) and **upcoming workouts** on home.
7. **Notification scheduling** when you’re ready to use the existing toggle.

If you tell me which of these you want to implement first (e.g. progress route + charts, or AI chat), I can outline concrete steps and file changes next (still in ask mode — no edits).