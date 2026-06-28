# Musclog — Feature List

A comprehensive list of every user-facing feature in the app, grouped by area.

---

## Dashboard & Home Screen

- Daily summary card with calorie intake vs. goal and macro breakdown
- Weekly streak card showing consecutive days of nutrition logging (current & best streak)
- Time-based personalized greetings (Good Morning / Afternoon / Evening)
- Quick-access buttons to start a workout or log food
- Recent foods and recent workouts previews
- Android home screen widgets: Nutrition Progress + Smart Camera

---

## Workout Tracking

- Log sets, reps, weight, rest times, and RPE for any exercise
- Workout types: Strength, Cardio, Flexibility, Calisthenics
- Create and save custom workout templates (e.g., PPL, Upper/Lower splits)
- Browse a built-in template library
- AI-generated workout plans based on your equipment and goals
- Drag-and-drop exercise reordering during or after a session
- Superset / exercise grouping via shared group ID
- Built-in rest timer with customizable duration and haptic alerts
- Real-time session stats: elapsed time, calories burned, total volume
- Automatic personal record (PR) detection
- Import workouts by pasting text — AI parses it into a session
- Keep screen awake during active workout sessions
- End-of-session feedback (difficulty, energy, notes)
- Add, replace, or skip exercises mid-session
- Recover interrupted workouts
- Archive workout templates to declutter the list
- Share workout routines via clipboard or native share sheet

---

## Nutrition & Food Logging

- Log meals by type: breakfast, lunch, dinner, snack
- Track calories, protein, carbs, fiber, fat, and 40+ vitamins/minerals
- Search food databases: Open Food Facts, USDA, Musclog barcode DB, local-only
- Barcode scanner for instant product lookup
- AI food photo estimation — snap a photo, get macros
- OCR label scanning to extract nutrition info from packaging (optional local pre-processing)
- Create custom foods manually with full nutrition values
- Flexible serving sizes (grams, ounces, standard portions)
- Save meal templates for quick reuse
- Scale meal portions up or down while maintaining macro ratios
- Log meals retroactively for past dates
- Move, copy, combine, or group meal entries
- Configurable carb convention (total carbs vs. net carbs, based on region/label type)
- Intuitive eating mode (hides calorie and macro numbers)
- View full micronutrient breakdown, ingredient list, and allergen info per food

---

## Nutrition Goals & Planning

- Set personalized calorie and macro targets
- Support for multiple goals with easy switching
- Empirical TDEE calculation derived from actual logged activity and weight changes
- Auto-calculated goal templates based on activity level, weight goal, and experience
- Weekly nutrition check-ins: "On Track / Ahead / Behind" status with 7-day trend analysis
- Dynamic goal recalculation based on real-world progress trends

---

## AI Coach (Loggy)

- Chat-based AI coach for workout, nutrition, and general fitness questions
- Choose between Google Gemini or OpenAI models (or a local LLM)
- AI retains contextual memory of your preferences and history for relevant advice
- AI food photo and nutrition label analysis
- AI-generated workout plans and full meal plans
- AI insights based on your actual logged data (workouts, nutrition, body metrics)
- AI has access to your goals, workout history, nutrition logs, and cycle phase
- Create and manage custom system prompts (general, nutrition, exercise-specific) and toggle them on/off
- Configurable conversation history length
- Copy or share AI chat messages

---

## Progress & Analytics

- Interactive charts: weight, body fat %, FFMI, lifting volume, calorie/macro trends, mood
- Time range filters: 7-day, 30-day, 90-day, or custom
- Weekly rolling averages toggle
- Correlation charts: volume vs. calories, body composition vs. protein, mood vs. macros/volume, etc.
- Workout performance charted by menstrual cycle phase
- AI-generated progress insights
- Data export: encrypted JSON backup or human-readable Excel spreadsheet

---

## Body Metrics & Measurements

- Track weight, body fat %, BMI, and FFMI
- Custom body measurements: waist, chest, arms, hips, thighs, calves, neck, shoulders, and any custom metric
- Full metric history with trend visualization
- Automatic metric/imperial unit conversion throughout
- AI-powered weight prediction based on logged trends (optional)

---

## Menstrual Cycle Tracking

- Track menstrual, follicular, ovulation, and luteal phases
- Phase wheel visualization showing current position in the cycle
- Next period and fertile window predictions
- Cycle-aware training recommendations (e.g., deload during menstrual phase)
- Log flow intensity and symptoms with custom notes
- Charts showing workout performance correlated to cycle phase
- Support for hormonal and non-hormonal birth control configurations

---

## Health Integrations

- **Android**: Health Connect sync — workouts, weight, nutrition, body composition (bidirectional)
- **iOS**: HealthKit integration — workouts, weight, nutrition, body composition (bidirectional)
- Historical health data import from connected health apps
- Bluetooth device support: wireless scales, heart rate monitors, fitness trackers
- BLE workout data recording and device management

---

## Daily Prompts & Habits

- Daily mood check-in (correlates with workout and nutrition data in progress charts)
- Daily water intake prompt based on TDEE estimate
- Daily supplement reminder for pending doses
- All prompts are individually dismissible

---

## Profile & Settings

- Set name, email, gender, date of birth, and avatar
- Fitness profile: weight, height, body fat %, goal type, activity level, experience level
- Language selection and full multilingual support (English, Portuguese, German, French, Spanish, Russian, and more)
- Metric or imperial units applied consistently throughout the app
- Theme selection (dark mode)
- Home summary card choice: Daily Summary vs. Weekly Streak
- Configurable AI provider (OpenAI / Google Gemini / local LLM) with model and API key settings
- Food search source configuration
- Toggle: OCR before AI, intuitive eating mode, weight prediction, daily prompts, cycle tracking
- Carb convention setting (include or exclude fiber in carbs display)
- Notification settings
- Advanced: database reset, data encryption options, raw DB access

---

## Onboarding

- Quick or detailed guided setup flow
- Personalized nutrition goal calculation based on age, weight, height, activity level, and weight goal
- Optional Health Connect / HealthKit setup during onboarding
- AI provider configuration during setup

## Musclog GB Gimmick

- Game Boy Color ROM prototype with first-run onboarding for units, sex, activity, age, height, weight, training level, fitness focus, and weight goal
- Compact battery-backed SRAM profile save with generated calorie and macro goals
- Prototype ROM nutrition and saved workout-history screens with Select-menu shortcuts back to Home
- Game Boy custom foods: create your own foods (name + per-100g calories, carbs, fiber, fat, protein) saved to battery-backed cartridge SRAM, surfaced inline (marked with `*`) in the food search so they can be tracked like bundled foods, plus a "My Foods" screen to delete them
- Game Boy Start Workout prototype for free sessions: pick an exercise, filter by muscle group with left/right arrows, edit suggested sets/weight/reps, run active set screens, adjust set targets, use a 60-second rest timer, save completed workouts to cartridge SRAM, and return to exercise selection for the next movement
- Game Boy Progress dashboard: a paged charts screen over a rolling 7-day or 30-day window (toggled with up/down), with a summary page (distinct muscle groups hit, workout count, days logged, average daily calories/protein/carbs/fat) plus per-day bar charts for calories, protein, digestible carbs, fat, and a body-weight trend (left/right cycles pages)
- Home Select menu with a scrollable Settings screen to re-edit every profile field (units, sex, age, height, weight, activity, experience, focus, weight goal) and all macro targets, an About screen linking to the full app at https://musclog.app/, and a confirmation-gated Reset Data option
- Game Boy sound: a UI blip on every selection/confirm/back press across the app, plus a title-screen soundtrack that plays only on the New Game / Continue screen, mixed live from the four APU channels (pulse lead, wave bass, noise drums). Both .mid assets are reduced to Game Boy sound data at build time (`npm run gb:gen-music`); the soundtrack converter auto-detects a repeating section to loop. A title-screen Options menu toggles SFX and the soundtrack independently, persisted to battery-backed SRAM so the choice survives resets
- Playable in-browser Game Boy Color emulator on the website (`/gameboy`) that auto-loads the ROM, with keyboard controls on desktop and on-screen touch controls on mobile, and persists the cartridge's battery-backed SRAM to IndexedDB (autosaved periodically and when leaving the page) so in-game saves survive reloads; before boot it also seeds today's real date and time into the cartridge SRAM (creating the save if none exists yet) for any not-yet-onboarded player, so first-run onboarding pre-fills the correct date and time

---

## Privacy & Data

- Local-first storage — all data lives on-device via WatermelonDB, no cloud sync required
- Sensitive metrics (weight, body fat) and nutrition logs encrypted at rest with AES
- Fully offline — core features work without internet
- Full data export (encrypted JSON or Excel) and import for portability
- Complete database reset option

---

## Accessibility & UX

- Locale-aware number formatting (e.g., German decimal separators, Portuguese grouping)
- Haptic feedback on buttons and rest timer completion
- Keyboard avoidance in all modals and input screens
- Skeleton loaders and progress indicators throughout
- Helpful empty state messages when no data exists
- Safety confirmation modals for destructive actions
