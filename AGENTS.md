# Musclog Guide

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
- `npm run build-android`: Production build for Android via EAS
- `npm run playwright`: Run Playwright E2E tests (Web)

## Testing Commands

- `npm test`: Run Jest tests (watch mode, two projects: `node` + `jsdom`)
- `npx jest --selectProjects node [path]`: Run specific unit tests in Node environment (avoids ESM/JSI issues)
- `npx jest --selectProjects jsdom [path]`: Run hook tests requiring DOM (e.g., hooks using `useColorScheme`)

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

- **Layered Structure**: Schema (`database/schema.ts`) -> Models (`database/models/`) -> Repositories (`database/repositories/`) -> Services (`database/services/`).
- **Repositories**: Complex queries live in `database/repositories/` (e.g., `WorkoutLogRepository`, `MenstrualCycleRepository`). Prefer repositories over direct model queries for non-trivial reads.
- **App Services**: Non-database services (AI, notifications, Health Connect sync) live in top-level `services/`.
- **Data Persistence**: Use WatermelonDB for local storage. Ensure models are registered in `database/database-instance.ts`.
- **Calendar day keys**: Fields that represent a calendar day (`nutrition_logs.date`, `user_metrics.date`, diary pickers) store **local** midnight ms. Use `utils/calendarDate.ts` (`localDayStartMs`, `localDayHalfOpenRange`, etc.); do not use `Date.UTC` or `setUTCHours(0, …)` for those stored values.
- **Encryption**: Sensitive metrics (weight, body fat) and nutrition logs must be encrypted/decrypted using helpers in `database/encryptionHelpers.ts`.
- **Unit system (metric / imperial)**: The database **always** stores metric values (kg, cm, g, kcal). Users choose metric or imperial in settings (`SettingsService.getUnits()`). Conversion helpers live in `utils/unitConversion.ts`:
  - **Saving user input → DB**: Convert display values to metric with `displayToKg`, `displayToCm`, `displayToGrams`, or the generic `displayValueToMetric(value, metricType, units)`.
  - **Reading DB → display**: Convert metric to display with `kgToDisplay`, `cmToDisplay`, `gramsToDisplay`, or the generic `metricValueToDisplay(value, metricType, units)`.
  - **Unit labels**: Use `getWeightUnit(units)`, `getHeightUnit(units)`, `getMassUnitLabel(units)`, or `metricDisplayUnit(metricType, units)` — never hardcode "kg", "lbs", "g", "oz" in UI.
  - **Type classification**: `isWeightMetricType(type)` (kg↔lbs: weight, muscle_mass, lean_body_mass) and `isLengthMetricType(type)` (cm↔in: height, chest, waist, hips, arms, thighs, calves, neck, shoulders).
  - **No conversion needed**: Macros (protein, carbs, fat, fiber) are always in grams, calories in kcal, body fat / BMI / FFMI are unitless — these stay the same in both systems.
  - **Food serving weights**: Stored in grams, displayed as g or oz. Use `gramsToDisplay`/`displayToGrams` and `getMassUnitLabel`. The `ServingSizeSelector` component handles this automatically.
  - **Every new feature** that displays or accepts weight, height, body measurements, or food serving sizes **must** use these conversion helpers. Test with imperial mode enabled.
- **Translation**: Check the `lang` directory for translation files. Any new feature implemented must use translation keys and add new keys to the translation files for all available languages.
- **User-visible numbers**: Format with `Intl` via `hooks/useFormatAppNumber.ts` (components) or `utils/formatAppNumber.ts` (pure code), using locale `i18n.resolvedLanguage ?? i18n.language`. Do not use `toFixed`, raw `{n}` in JSX, or `toLocaleString()` without an explicit locale for display. Keep `roundToDecimalPlaces` / DB math separate from display.

### WatermelonDB Usage

- **Transactions**: All writes must be wrapped in `database.write(async () => { ... })`.
- **Avoid Deadlocks**: Never nest `database.write()` calls. Methods decorated with `@writer` should not be called from within another write block.
- **Web Compatibility**: On web, `unsafeResetDatabase()` must also be wrapped in a write block.
- **JSON Fields**: Use the `@json` decorator for complex object fields (e.g., `@json('micros_json')`, `@json('week_days_json')`). Keep a plaintext date field alongside encrypted fields when the date is needed for DB queries.
- **Boot-time DB-ready gate**: `seedProductionData()` calls `unsafeResetDatabase()` on a fresh install, which temporarily swaps the real adapter for an `ErrorAdapter` that throws `"Cannot call database.adapter.underlyingAdapter while the database is being reset"` on any query. Any code that runs at app startup (e.g. inside a `useEffect` in `Migrations.tsx`) and touches the DB **must** await `waitForDbReady()` from `database/dbReady.ts` before issuing queries. `seedProductionData()` calls `markDbReady()` when it finishes (both the fast-path and the full reset+seed path).

### Component Design

- **Theme**: Use components from `components/theme/` and follow `theme.ts` conventions.
- **Charts**:
  - Always provide a `.web.tsx` counterpart for `victory-native` components to avoid Skia errors.
  - Use absolute positioning for axis labels to maintain consistency across platforms.
  - Use `ChartTooltipContext` (`context/ChartTooltipContext.tsx`) for coordinated tooltip behavior.
- **Segments**: Use `SegmentedControl` for mode switching (e.g., 7D/30D/90D).

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
- **Food Search Source**: Configurable via `FOOD_SEARCH_SOURCE_SETTING_TYPE`. Options include Open Food Facts, USDA, Musclog barcode DB, and local-only.
- **OCR Before AI**: When enabled (`USE_OCR_BEFORE_AI_SETTING_TYPE`), images are processed locally with OCR before being sent to the LLM, reducing data sent to external services.
- **Custom AI Prompts**: Users can create multiple context-specific system prompts (general, nutrition, exercise) and toggle which are active. Stored in the `ai_custom_prompts` table; appended in `utils/prompts.ts`.
- **iOS Health**: HealthKit integration via `@kingstinct/react-native-healthkit` (in addition to Health Connect on Android).

## QA (locale-aware numbers)

After changing number formatting, manually verify with app language **de** or **pt-BR**: food/daily summary, profile stats, nutrition check-in, workout history/volume, progress charts, and Android nutrition widget show locale-appropriate decimal and grouping separators.
