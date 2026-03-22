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
- **Icons**: Lucide React Native
- **Animations**: React Native Reanimated 4
- **Health Data**: Health Connect (Android) via `react-native-health-connect`
- **Error Tracking**: Sentry (`@sentry/react-native`)
- **Food Scanning**: OCR (tesseract.js / rn-mlkit-ocr) and barcode scanning (quagga2 / react-zxing)
- **Export**: xlsx + html-to-image for data export features

## Repository Structure

```
musclog/
├── app/                        # Expo Router screens
│   ├── _layout.tsx             # Root layout
│   ├── index.tsx               # Dashboard / home
│   ├── onboarding/             # Onboarding flow
│   ├── workout/                # Workout screens
│   ├── nutrition/              # Nutrition/food screens
│   ├── cycle.tsx               # Menstrual cycle tracking
│   ├── progress.tsx            # Analytics & charts
│   ├── profile.tsx             # User profile & metrics
│   ├── settings.tsx            # App settings
│   ├── chat.tsx                # AI coach chat
│   └── aiSettings.tsx          # AI configuration
├── components/                 # Reusable UI components
│   ├── NavigationMenu.tsx      # Custom bottom nav bar
│   ├── MasterLayout.tsx        # Root layout wrapper
│   ├── CoachModal.tsx          # AI coach chat modal
│   ├── SmartCameraModal.tsx    # AI photo analysis modal
│   └── theme/                  # Themed base components
├── context/                    # React contexts (e.g., ChartTooltipContext)
├── database/                   # WatermelonDB models & services
│   ├── models/                 # Database models
│   ├── repositories/           # Complex query logic
│   ├── services/               # Service layer (CRUD + business logic)
│   ├── migrations/             # DB schema migrations
│   ├── seeders/                # Initial data seeding
│   ├── schema.ts               # DB schema definition
│   ├── database-instance.ts    # Model registration
│   └── encryptionHelpers.ts    # AES encrypt/decrypt helpers
├── hooks/                      # Custom React hooks
├── services/                   # Non-DB app services (AI, notifications, Health Connect)
├── lang/locales/en-us/         # Localization strings (JSON per feature)
├── constants/                  # App-wide constants (settings keys, enums)
├── utils/                      # Utility functions (coachAI, prompts, etc.)
├── assets/                     # Images, icons, exercise photos
└── widgets/                    # Android/iOS home screen widgets
```

## Design System

Full details in `DESIGN.md`. Key values for component development:

### Colors

- **Primary Background** (`#0a1f1a`): `swampGreen` — main app background
- **Card Surface** (`#141a17`): `charcoalGreen` — default card/section background
- **Elevated Surface** (`#1a2420`): `gunmetalGreen` — higher-priority cards
- **Performance Gradient**: Indigo 600 (`#4f46e5`) → Emerald 400 (`#34d399`) — primary actions, progress
- **Success** (`#22c55e`), **Warning** (`#f97316` / `#f59e0b`), **Error** (`#ef4444`)

**Macro semantic colors** (use consistently — do not substitute):
- Protein: Indigo (`#6366f1`)
- Carbs: Emerald (`#10b981`)
- Fat: Amber (`#f59e0b`)
- Fiber: Pink (`#ec4899`)

### Spacing & Layout

- **Grid**: 4px base unit. Scale: 4 / 8 / 12 / 16 / 20 / 24 / 32px
- **Border radius**: 12px (standard inputs/components), 16px (primary cards), 9999px (badges/avatars)
- **Touch targets**: Minimum 48×48dp on all mobile interfaces

### Typography

- **Lexend**: Data displays and headings (numeric stats, hero values)
- **Inter / Manrope**: Body text and labels

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
