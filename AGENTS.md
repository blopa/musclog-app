# Musclog Guide

## Expo Skills

@.claude/skills/expo-tailwind-setup/SKILL.md
@.claude/skills/native-data-fetching/SKILL.md
@.claude/skills/upgrading-expo/SKILL.md

## Build and Development Commands

- `npm start`: Start Expo development server
- `npm run start-clear`: Start with cleared cache
- `npm run web`: Start for web development (http://localhost:8081)
- `npm run android`: Run on Android emulator
- `npm run android-device`: Run on physical Android device (no build cache)
- `npm run ios`: Run on iOS simulator/device
- `npm run prebuild`: Run Expo prebuild (clean)
- `npm run lint:all`: Run full linting, formatting, and typecheck suite
- `npm run lint:eslint`: Run ESLint check
- `npm run format`: Format code with Prettier and Tailwind plugin
- `npm run typecheck`: Run TypeScript type checking
- `npm run check-translations`: Validate i18n keys and locale consistency
- `npm run reset-project`: Reset project to initial state via script
- `npm run build-android`: Production build for Android via EAS (AAB for Google Play)
- `npm run build-android-apk`: Production build as an installable, release-signed APK (for direct download / GitHub release attachment); `build-android-apk-local` builds it locally
- `npm run playwright`: Run Playwright E2E tests (Web)
- `npm run gb:build`: Build the Game Boy Color ROM
- `npm run gb:lint`: Run `clang-tidy` on the Game Boy C sources
- `npm run gb:lint-fix`: Run `clang-tidy --fix` to auto-fix findings in the Game Boy C sources
- `npm run gb:format`: Format the Game Boy C sources with `clang-format`
- `npm run gb:format-check`: Check formatting without modifying files (exits 1 on violations)
- `npm run gb:copy-rom`: Copy the built Game Boy Color ROM into assets
- `npm run gb:gen-foods`: Regenerate Game Boy food C tables
- `npm run gb:gen-exercises`: Regenerate Game Boy exercise C table

## Testing Commands

- `npm test`: Run Jest tests (watch mode, two projects: `node` + `jsdom`)
- `npx jest --selectProjects node [path]`: Run specific unit tests in Node environment (avoids ESM/JSI issues)
- `npx jest --selectProjects jsdom [path]`: Run hook tests requiring DOM (e.g., hooks using `useColorScheme`)

## Repo Structure: Dual-Purpose (App + Website)

This repository serves two distinct purposes that share the same Expo Router project:

- **`app/app/`** — All mobile app screens (iOS & Android). These are the core product screens: nutrition, workout, profile, progress, settings, onboarding, etc.
- **`app/(website)/`** — The institutional/marketing website (landing page, privacy policy, etc.). This is only rendered on the web platform. Route group `(website)` keeps it isolated from the app routes.

**Key conventions for the website:**

- Files ending in `.web.tsx` inside `app/(website)/` are the web-specific implementations (e.g. `home.web.tsx`). Their non-web counterparts (e.g. `home.tsx`) exist as native stubs or redirects.
- Website components live in `components/website/` (e.g. `StoreButtons`, `WebsiteBackgrounds`, `WebsiteChrome`).
- Website SEO is mounted once by `app/(website)/_layout.web.tsx` via `components/website/WebsiteSeo.tsx`. When adding a public website route, add its path/key/metadata there so social previews, search descriptions, canonical URLs, and `assets/seo-image.png` / `/images/seo-image.png` stay consistent across public routes.
- The website uses standard HTML elements (`<div>`, `<section>`, `<a>`) and Tailwind/NativeWind utility classes — **not** React Native primitives.
- When working on website files, treat them as a standard React web app, not a React Native app.
- Website layout is in `app/(website)/_layout.web.tsx`; it wraps pages with the nav/footer chrome.

**When making changes:**

- Changes to `app/app/` affect the mobile app only.
- Changes to `app/(website)/` affect the public website only.
- Shared logic (services, database, utils) lives outside both and is used by both platforms.

## Tech Stack

- **Framework**: React Native (Expo SDK 54) with Expo Router
- **Styling**: NativeWind (Tailwind CSS)
- **Database**: WatermelonDB (SQLite for Native, LokiJS for Web)
- **Charts**: Victory Native (Skia) for Native, Victory (SVG) for Web
- **AI**: OpenAI & Google Gemini (Generative AI)
- **Localization**: i18next with `expo-localization`
- **Health Data**: Health Connect (Android) via `react-native-health-connect`
- **Error Tracking**: Sentry (`@sentry/react-native`)
- **Food Scanning**: OCR (tesseract.js / rn-mlkit-ocr) and barcode scanning (quagga2 / react-zxing)
- **Export**: xlsx + html-to-image for data export features

## Coding Guidelines

### Architecture

- **Keep documentation in sync (required)**: When a change alters behavior, architecture, file layout, or any invariant, update the docs in the same change — this `AGENTS.md`, the relevant files under `docs/`, `README.md`, and any code comments that name files/functions you moved or renamed. Treat a doc that names a file, function, flag, or approach that no longer matches the code as a bug to fix, not to leave. If a `docs/` plan describes an approach that was superseded, rewrite it to reflect what was actually built (or mark it superseded) rather than leaving the stale plan. Do not add docs for trivial changes, but never let an existing doc drift out of date.
- **Feature list sync (required)**: Whenever a new user-facing feature is added or an existing one is removed or significantly changed, update `FEATURES.md` to reflect it. If the change also affects the high-level summary in `README.md` (Key Features section), update that too. `FEATURES.md` is the source of truth for the complete feature list; `README.md` contains a curated subset — both must stay accurate.
- **Layered Structure**: Schema (`database/schema.ts`) -> Models (`database/models/`) -> Repositories (`database/repositories/`) -> Services (`database/services/`).
- **Repositories**: Complex queries live in `database/repositories/` (e.g., `WorkoutLogRepository`, `MenstrualCycleRepository`). Prefer repositories over direct model queries for non-trivial reads.
- **App Services**: Non-database services (AI, notifications, Health Connect sync) live in top-level `services/`.
- **Data Persistence**: Use WatermelonDB for local storage. Ensure models are registered in `database/database-instance.ts`.
- **Calendar day keys**: Fields that represent a calendar day (`user_metrics.date`, diary pickers) store **local** midnight ms. Use `utils/calendarDate.ts` (`localDayStartMs`, `localDayHalfOpenRange`, etc.); do not use `Date.UTC` or `setUTCHours(0, …)` for those stored values.
- **`nutrition_logs.date` is a consumed datetime**, not a day key: it stores the local **datetime** (day + time-of-day) the food was consumed in ms, so the time-of-day is preserved. Calendar-day grouping/filtering still goes through `utcNormalizedDayKey` / `dayKeyRange` (with `dayRangeClauses` from `database/dayKeyQuery.ts` for the widened DB clauses and `range.filterRecords` to trim the overscan), which re-apply the stored `timezone` offset and strip to Y/M/D, so day-based reads are unaffected. When writing it, combine the picked day + time with `combineLocalDateAndTime` (or `instantForDateTimeInTimezone` to anchor to a record's stored timezone); use `withCurrentTimeOnDay` for non-interactive "log now for this day" paths. Never floor it with `localDayStartMs`. `created_at` is strictly the record-creation instant and `updated_at` the last-update instant — do not read consumed time from them.
- **Encryption**: Sensitive metrics (weight, body fat) and nutrition logs must be encrypted/decrypted using helpers in `database/encryptionHelpers.ts`.
- **Unit system (metric / imperial)**: The database **always** stores metric values (kg, cm, g, kcal). Users choose metric or imperial in settings (`SettingsService.getUnits()`). Conversion helpers live in `utils/unitConversion.ts`:
  - **Saving user input → DB**: Convert display values to metric with `displayToKg`, `displayToCm`, `displayToGrams`, or the generic `displayValueToMetric(value, metricType, units)`.
  - **Reading DB → display**: Convert metric to display with `kgToDisplay`, `cmToDisplay`, `gramsToDisplay`, or the generic `metricValueToDisplay(value, metricType, units)`.
  - **Unit labels**: Use `getWeightUnit(units)`, `getHeightUnit(units)`, `getMassUnitLabel(units)`, or `metricDisplayUnit(metricType, units)` — never hardcode "kg", "lbs", "g", "oz" in UI.
  - **Type classification**: `isWeightMetricType(type)` (kg↔lbs: weight, muscle_mass, lean_body_mass) and `isLengthMetricType(type)` (cm↔in: height, chest, waist, hips, arms, thighs, calves, neck, shoulders).
  - **No conversion needed**: Macros (protein, carbs, fat, fiber) are always in grams, calories in kcal, body fat / BMI / FFMI are unitless — these stay the same in both systems.
- **Carbs vs fiber convention (critical)**: There are two conventions in the codebase — **do not mix them**:
  - **Food items / nutrition logs** (`NutritionLog`, `inferCaloriesFromMacros.ts`, `NutritionCharts.tsx`, food DB mappers): `carbs` = total carbohydrates **including** fiber, matching the US nutrition label standard. Digestible carbs = `carbs − fiber`. Use `digestibleCarbs(carbs, fiber)` from `utils/carbsConvention.ts` (never re-inline `Math.max(0, carbs - fiber)`) for energy and for comparing consumed carbs against the (net) carbs goal — the carbs progress bar must show digestible carbs so it doesn't double-count fiber, which has its own bar.
  - **Source carbs are not all "total" — normalize at ingestion** (`utils/carbsConvention.ts`): the "carbs = total incl. fiber" invariant is **established at ingestion**, not assumed. All food-source mappers **must** run `carbs` through `totalCarbsForFoodSource(source, …)` before storing (it looks the source's convention up in `FOOD_SOURCE_CARBS_CONVENTION`, so a convention change is a one-line edit). Per-source conventions, verified against the standards (June 2026):
    - **USDA** `Carbohydrate, by difference` (1005) already includes fiber → `'total'` (no transform, but still routed through the helper for a future-proof entry point). <https://fdc.nal.usda.gov/>
    - **US/Canada (FDA)** "Total Carbohydrate" is by-subtraction and includes fiber. [21 CFR 101.9(c)(6)](https://www.ecfr.gov/current/title-21/section-101.9)
    - **EU (Reg. 1169/2011, Annex I)** declares _available_ carbohydrate (fiber **excluded**, fiber counted at 2 kcal/g) → `'net'` (total = carbs + fiber). <https://eur-lex.europa.eu/eli/reg/2011/1169/oj> · [US-vs-EU explainer](https://blog.trustwell.com/how-carbs-are-calculated-in-different-countries)
    - **OpenFoodFacts** stores a single `carbohydrates` field without recording the convention, so it is mixed → `'off-mixed'`, resolved in three steps: (1) prefer `carbohydrates-total`; (2) else reconcile the **stated label energy** against both interpretations (they differ by exactly `4 × fiber` kcal/100g) and keep `carbs` as-is only when the energy clearly fits the total interpretation; (3) else assume EU/net and add fiber. Step 2 is conservative — pass the raw stated kcal, never an inferred one. [openfoodfacts-server#5675](https://github.com/openfoodfacts/openfoodfacts-server/issues/5675)
    - **Musclog REST API** scrapes EU (Dutch) supermarkets (Albert Heijn, Lidl, Jumbo, …) mapping the label "Koolhydraten" (available carbohydrate) → `carbs` → `'net'`. If its upstream ever changes, update the `musclog` entry in `FOOD_SOURCE_CARBS_CONVENTION`.
    - **AI / LLM estimates** (`'ai'` → `'net'`): the macro-estimation prompt's energy note (`kcal = 4·carbs + 2·fiber`, `utils/prompts.ts`) is the net convention, so the model returns net carbs. Every AI persistence path (`NutritionService.logCustomMeal`/`logCustomMealsBatch`, `nutritionAI.ts`, `MyMealsModal`) **must** run AI carbs through `totalCarbsForFoodSource('ai', …)` before storing.
    - **Manual entry** (`CreateCustomFoodModal`): the user picks, via the `INCLUDE_FIBER_IN_CARBS_SETTING_TYPE` setting (Advanced settings → Nutrition; seeded from units in `prod.ts` — imperial/US label = include fiber, metric/EU label = exclude), whether the typed carbs field already includes fiber. Convert with `totalCarbsFromSource(manualEntryCarbsConvention(includeFiberInCarbs), …)` before saving; the field label + hint copy follow the same setting.
  - **User nutrition goals** (`NutritionGoalsBody`, saved goal records, onboarding results): `carbs` = **net/digestible carbs only** (fiber is a separate, additive macro). Total calories = `protein * 4 + carbs * 4 + fats * 9 + fiber * 2`. Never subtract fiber from carbs in this context.
  - **Food serving weights**: Stored in grams, displayed as g or oz. Use `gramsToDisplay`/`displayToGrams` and `getMassUnitLabel`. The `ServingSizeSelector` component handles this automatically.
  - **Every new feature** that displays or accepts weight, height, body measurements, or food serving sizes **must** use these conversion helpers. Test with imperial mode enabled.
- **Translation**: Check the `lang` directory for translation files. Any new feature implemented must use translation keys and add new keys to the translation files for all available languages.
- **User-visible numbers**: Format with `Intl` via `hooks/useFormatAppNumber.ts` (components) or `utils/formatAppNumber.ts` (pure code), using locale `i18n.resolvedLanguage ?? i18n.language`. Do not use `toFixed`, raw `{n}` in JSX, or `toLocaleString()` without an explicit locale for display. Keep `roundToDecimalPlaces` / DB math separate from display.

### WatermelonDB Usage

- **Transactions**: All writes must be wrapped in `database.write(async () => { ... })`.
- **Avoid Deadlocks**: Never nest `database.write()` calls. Methods decorated with `@writer` should not be called from within another write block.
- **Web Compatibility**: On web, `unsafeResetDatabase()` must also be wrapped in a write block.
- **JSON Fields**: Use the `@json` decorator for complex object fields (e.g., `@json('micros_json')`, `@json('week_days_json')`). Keep a plaintext date field alongside encrypted fields when the date is needed for DB queries.
- **Raw SQL — never open expo-sqlite on `musclog.db` (critical, data loss)**: expo-sqlite and WatermelonDB bundle separate SQLite libraries, and POSIX locks never conflict within one process — so an expo-sqlite connection that **closes** always thinks it's the last connection and unlinks the live `-wal`/`-shm` files under WatermelonDB. WatermelonDB then keeps committing into the unlinked file and every commit since the unlink silently vanishes when the process is killed (June 2026 field incident: users lost nutrition logs, no tombstones). Any raw SQL while the app is running must go through `rawQueryViaWatermelon` in `database/wmdbRaw.ts` (reads/PRAGMAs) or `database.adapter.unsafeExecute` (writes). The only native exception that may open expo-sqlite on `musclog.db` is `preparePreMigrationBackupBeforeAdapter()` in `database/preMigrationCapture.ts` (a native-only module imported solely by `database/adapter.ts` before `new SQLiteAdapter`); it reads `user_version`, captures pre-migration rows synchronously, closes the raw connection, and only then lets WatermelonDB open the file. That isolation is deliberate — the runtime backup module `database/preMigrationBackup.ts` imports no expo-sqlite at all, so the invariant is structural. Do not open expo-sqlite during migration callbacks, after boot, or from new paths. Full incident write-up and root cause: `docs/DATABASE_DURABILITY.md` — read it before adding any raw SQLite access.
- **Boot-time DB-ready gate**: `seedProductionData()` calls `unsafeResetDatabase()` on a fresh install, which temporarily swaps the real adapter for an `ErrorAdapter` that throws `"Cannot call database.adapter.underlyingAdapter while the database is being reset"` on any query. Any code that runs at app startup (e.g. inside a `useEffect` in `AppBoot.tsx`) and touches the DB **must** await `waitForDbReady()` from `database/dbReady.ts` before issuing queries. `seedProductionData()` calls `markDbReady()` when it finishes (both the fast-path and the full reset+seed path).

### Component Design

- **Theme**: Use components from `components/theme/` and follow `theme.ts` conventions.
- **Charts**:
  - Always provide a `.web.tsx` counterpart for `victory-native` components to avoid Skia errors.
  - Use absolute positioning for axis labels to maintain consistency across platforms.
  - Use `ChartTooltipContext` (`context/ChartTooltipContext.tsx`) for coordinated tooltip behavior.
- **Segments**: Use `SegmentedControl` for mode switching (e.g., 7D/30D/90D).
- **Keyboard avoidance**: Any screen or modal that contains a `TextInput` (or any input component wrapping one) inside a scroll container **must** use `KeyboardAwareScrollView` from `react-native-keyboard-controller` instead of RN's plain `ScrollView`. `KeyboardProvider` is already mounted at the app root (`app/app/_layout.tsx`). Two patterns to apply:
  - **Full-screen layouts / screens** (`FullScreenModal` with `scrollable={true}`, plain screens): replace the outermost `ScrollView` with `KeyboardAwareScrollView` and add `bottomOffset={16}`.
  - **Bottom sheets** (`BottomPopUp`): the sheet itself lifts via `marginBottom` in `BottomPopUp.tsx` — no extra work needed for the default `scrollable={true}` case. If you use `scrollable={false}` and add your own inner `ScrollView` with inputs, replace that inner `ScrollView` with `KeyboardAwareScrollView bottomOffset={16}` (see `EditPastWorkoutDataModal.tsx` as an example).
  - Never use RN's `KeyboardAvoidingView` for new code — it has known issues with edge-to-edge on Android (Expo SDK 54+).

### AI & LLM Integration

- **Structured Output**: Use `makeSchemaStrict` in `utils/coachAI.ts` for OpenAI function calling to ensure `additionalProperties: false` and all fields are `required`.
- **Prompts**: System prompts are managed in `utils/prompts.ts`. Append custom user prompts from the `ai_custom_prompts` table.
- **Foundation foods in every prediction**: All LLM functions that predict food or meal macros (`trackMeal`, `generateMealPlan`, `estimateNutritionFromPhoto`, etc.) **must** read `SettingsService.getSendFoundationFoodsToLlm()` and pass the result to both the system prompt (`getFoundationFoodsPrompt()`) and the function schema (add `foodId` to ingredient properties). This applies to any new prediction feature too.
- **Foundation food matching**: When foundation foods are enabled, the LLM may match ingredients to existing DB foods and return their `foodId` with **zero macros** — it expects the caller to look up real values. Always call `NutritionService.normalizeAiMealIngredients(ingredients)` on the result before saving or displaying. For ingredients with a `foodId`, reuse the existing food record directly instead of calling `FoodService.createCustomFood`.

### Platform Specifics

- **Android**: Use namespace imports for image manipulation: `import * as ImageManipulator from 'expo-image-manipulator'`.
- **Web**: Target a mobile viewport (390x844) for correct layout rendering. Web-specific overrides use `.web.tsx` file extensions.
- **Widgets**: Android/iOS home screen widgets live in `widgets/` (e.g., `NutritionWidget`, `SmartCameraWidget`).

### Feature Highlights

- **Weekly Progress Check-ins**: Managed via `NutritionCheckinService`. Periodic targets are generated upon goal setting. Trends are analyzed based on 7-day rolling data (weight, calories, activity).
- **Exercise Reordering**: Workout log exercises have an `order` field. Use `ExerciseService.reorderWorkoutLogExercises()` to persist new order. Works on both in-progress and past workouts.
- **Superset / Exercise Grouping**: Workout log exercises and sets share a `group_id` (optional). Exercises with the same `group_id` are treated as a superset.
- **Meal Grouping**: Nutrition log entries share a `group_id` to display AI-generated or saved meals as a single meal item instead of individual ingredients.
- **Mood Tracking**: Daily mood prompt (configurable via `SHOW_DAILY_MOOD_PROMPT_SETTING_TYPE`). Mood is correlated with calories, workout volume, and macros in the progress charts.
- **Home Screen Widgets**: Android widgets live in `widgets/` (`NutritionWidget`, `SmartCameraWidget`). Widget data is refreshed via helpers in `widget-update-helpers.ts`.
- **Home summary card choice**: The top of the home screen shows either the `DailySummaryCard` or the `WeeklyStreakCard`, chosen via `HOME_SUMMARY_CARD_SETTING_TYPE` (`'daily_summary' | 'weekly_streak'`) in the Interface/Visual settings. The streak card's current streak counts consecutive calendar days with a logged food ending **yesterday** (the current day is excluded), computed timezone-aware via `NutritionService.getMacroLoggingStreak()`. The best streak is the longest current streak ever observed, persisted in the `MACRO_STREAK_STATE` AsyncStorage key and only ever grown (never recomputed historically). `utils/macroStreak.ts` (`getMacroStreak`, surfaced by the `useMacroStreak` hook) recomputes from the DB at most once per local day and caches both values for the rest of the day. `WeeklyStreakCard` gets workout progress from `useWeeklyWorkoutProgress`: completed workouts are counted by `completed_at` over the rolling 7 local calendar days ending today, and goal dots are shown only when the user has an active consistency exercise goal.
- **Food Search Source**: Configurable via `FOOD_SEARCH_SOURCE_SETTING_TYPE`. Options include Open Food Facts, USDA, Musclog barcode DB, and local-only.
- **OCR Before AI**: When enabled (`USE_OCR_BEFORE_AI_SETTING_TYPE`), images are processed locally with OCR before being sent to the LLM, reducing data sent to external services.
- **Custom AI Prompts**: Users can create multiple context-specific system prompts (general, nutrition, exercise) and toggle which are active. Stored in the `ai_custom_prompts` table; appended in `utils/prompts.ts`.
- **iOS Health**: HealthKit integration via `@kingstinct/react-native-healthkit` (in addition to Health Connect on Android).

## QA (locale-aware numbers)

After changing number formatting, manually verify with app language **de** or **pt-BR**: food/daily summary, profile stats, nutrition check-in, workout history/volume, progress charts, and Android nutrition widget show locale-appropriate decimal and grouping separators.
