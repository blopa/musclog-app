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
- **Encryption**: Sensitive metrics (weight, body fat) and nutrition logs must be encrypted/decrypted using helpers in `database/encryptionHelpers.ts`.

### WatermelonDB Usage

- **Transactions**: All writes must be wrapped in `database.write(async () => { ... })`.
- **Avoid Deadlocks**: Never nest `database.write()` calls. Methods decorated with `@writer` should not be called from within another write block.
- **Web Compatibility**: On web, `unsafeResetDatabase()` must also be wrapped in a write block.
- **JSON Fields**: Use the `@json` decorator for complex object fields (e.g., `@json('micros_json')`, `@json('week_days_json')`). Keep a plaintext date field alongside encrypted fields when the date is needed for DB queries.

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

### Platform Specifics

- **Android**: Use namespace imports for image manipulation: `import * as ImageManipulator from 'expo-image-manipulator'`.
- **Web**: Target a mobile viewport (390x844) for correct layout rendering. Web-specific overrides use `.web.tsx` file extensions.
- **Widgets**: Android/iOS home screen widgets live in `widgets/` (e.g., `NutritionWidget`, `SmartCameraWidget`).

### Feature Highlights

- **Weekly Progress Check-ins**: Managed via `NutritionCheckinService`. Periodic targets are generated upon goal setting. Trends are analyzed based on 7-day rolling data (weight, calories, activity).
