# Musclog Guide

## Build and Development Commands

- `npm start`: Start Expo development server
- `npm run web`: Start for web development (http://localhost:8081)
- `npm run android`: Run on Android emulator/device
- `npm run ios`: Run on iOS simulator/device
- `npm run prebuild`: Run Expo prebuild (clean)
- `npm run lint:all`: Run full linting, formatting, and typecheck suite
- `npm run format`: Format code with Prettier and Tailwind plugin

## Testing Commands

- `npm test`: Run Jest tests (watch mode)
- `npx jest --selectProjects node [path]`: Run specific unit tests in Node environment (avoids ESM/JSI issues)
- `node scripts/demo-recording.js`: Generate promotional feature recordings (requires web server)

## Tech Stack

- **Framework**: React Native (Expo SDK 54) with Expo Router
- **Styling**: NativeWind (Tailwind CSS)
- **Database**: WatermelonDB (SQLite for Native, LokiJS for Web)
- **Charts**: Victory Native (Skia) for Native, Victory (SVG) for Web
- **AI**: OpenAI & Google Gemini (Generative AI)
- **Localization**: i18next with `expo-localization`

## Coding Guidelines

### Architecture

- **Layered Structure**: Schema (`database/schema.ts`) -> Models (`database/models/`) -> Services (`database/services/`).
- **Data Persistence**: Use WatermelonDB for local storage. Ensure models are registered in `database/database-instance.ts`.
- **Encryption**: Sensitive metrics (weight, body fat) and nutrition logs must be encrypted/decrypted using helpers in `database/encryptionHelpers.ts`.

### WatermelonDB Usage

- **Transactions**: All writes must be wrapped in `database.write(async () => { ... })`.
- **Avoid Deadlocks**: Never nest `database.write()` calls. Methods decorated with `@writer` should not be called from within another write block.
- **Web Compatibility**: On web, `unsafeResetDatabase()` must also be wrapped in a write block.

### Component Design

- **Theme**: Use components from `components/theme/` and follow `theme.ts` conventions.
- **Charts**:
  - Always provide a `.web.tsx` counterpart for `victory-native` components to avoid Skia errors.
  - Use absolute positioning for axis labels to maintain consistency across platforms.
  - Use `ChartTooltipContext` for coordinated tooltip behavior.
- **Segments**: Use `SegmentedControl` for mode switching (e.g., 7D/30D/90D).

### AI & LLM Integration

- **Structured Output**: Use `makeSchemaStrict` in `utils/coachAI.ts` for OpenAI function calling to ensure `additionalProperties: false` and all fields are `required`.
- **Prompts**: System prompts are managed in `utils/prompts.ts`. Append custom user prompts from the `ai_custom_prompts` table.

### Platform Specifics

- **Android**: Use namespace imports for image manipulation: `import * as ImageManipulator from 'expo-image-manipulator'`.
- **Web**: Target a mobile viewport (390x844) for correct layout rendering.
