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
- Browse a built-in template library, including a five-session cable superset program
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
- Copy a whole previous day into the current one — pick a recent logged day, review its meals, untick anything you didn't repeat, and confirm (meal types, meal groups, and times of day are preserved)
- Configurable carb convention (total carbs vs. net carbs, based on region/label type)
- Intuitive eating mode (hides calorie and macro numbers)
- Fasting days (opt-in): mark an empty day as an intentional fast so it counts as a real 0-calorie day in TDEE, averages, check-ins, and streaks — while unflagged empty days (forgotten logs) are skipped
- View full micronutrient breakdown, ingredient list, and allergen info per food

---

## Nutrition Goals & Planning

- Set personalized calorie and macro targets
- Support for multiple goals with easy switching
- Empirical TDEE calculation derived from actual logged intake and smoothed trend-weight endpoints
- Auto-calculated goal templates based on activity level, weight goal, and experience
- Weekly nutrition check-ins: "On Track / Ahead / Behind" status based on trend weight, with raw seven-day weigh-in bars
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

- Interactive charts: smoothed weight trend with raw scale points, body fat %, FFMI, lifting volume, calorie/macro trends, mood
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

## Notes

- Free-form scratchpad for jotting things down ("70g of broccoli") without committing to a nutrition log
- Optional title plus a required note body
- The two newest notes are highlighted as cards at the top; older notes appear beneath in a paged "Earlier" list with a "Load more" button
- Per-note menu: edit, duplicate, delete (with a confirmation prompt), and — when an AI provider is configured — **Track this**
- **Track this** hands the note's text to the AI Coach with meal tracking pre-armed — the user reviews the text, sends it, then confirms the parsed meal before anything is logged. The option is hidden entirely when no AI provider is set up, since it would otherwise dead-end
- Notes never affect macros, goals, streaks, or any aggregate on their own
- Reachable from the account menu, and assignable to a bottom navigation slot in Visual settings
- Included in backup and restore

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
- Game Boy sound: a UI blip on every selection/confirm/back press across the app, plus a soundtrack that plays on every Game Boy screen after the splash while enabled, mixed live from the four APU channels (pulse lead, wave bass, noise drums). Both .mid assets are reduced to Game Boy sound data at build time (`npm run gb:gen-music`); the soundtrack converter auto-detects a repeating section to loop. A title-screen Options menu toggles SFX and the soundtrack independently, persisted to battery-backed SRAM so the choice survives resets
- Playable in-browser Game Boy Color emulator on the website (`/gameboy`) that auto-loads the ROM, with keyboard controls on desktop and on-screen touch controls on mobile, and persists the cartridge's battery-backed SRAM to IndexedDB (autosaved periodically and when leaving the page) so in-game saves survive reloads; before boot it also seeds today's real date and time into the cartridge SRAM (creating the save if none exists yet) for any not-yet-onboarded player, so first-run onboarding pre-fills the correct date and time. The page also offers direct downloads of the Game Boy ROM (`.gbc`) and a retro-styled PDF instruction manual

## Public Website

- Markdown-powered blog at `/blog`: the index and individual post URLs are statically generated from files under `app/(website)/posts`; YAML frontmatter supplies metadata, while post bodies support headings, links, lists, tables, blockquotes, images, inline code, and syntax-highlighted fenced code blocks

---

## Privacy & Data

- Local-first storage — all data lives on-device via WatermelonDB, no cloud sync required
- Sensitive metrics (weight, body fat) and nutrition logs encrypted at rest with AES
- Fully offline — core features work without internet
- Full data export (encrypted JSON or Excel) and import for portability
- **Optical Transfer** — move everything, or just one saved meal, to another device with nothing
  but the two screens: one displays an animated stream of QR codes, the other reads them with its
  camera. Whole-profile transfers remain optionally passphrase-protected and replace only after
  verification; meal shares preview ingredients/macros and save non-destructively into the existing
  database. Send from a meal's ⋮ menu and receive from My Meals → +, or receive either payload from
  Settings. Point a food barcode scanner at a sending phone by mistake and it recognises the stream
  instead of failing a product lookup, offering to hand you straight to the optical reader. The
  receiving screen shows live percentage, transferred KB, KB/s throughput, and remaining time.
  Available on Android, iOS and web in any combination, with no internet, cable, or account
  (see [docs/OPTICAL_TRANSFER.md](docs/OPTICAL_TRANSFER.md))
- Automatic local backups before any restore, browsable and restorable from settings
- Complete database reset option

---

## Accessibility & UX

- Locale-aware number formatting (e.g., German decimal separators, Portuguese grouping)
- Haptic feedback on buttons and rest timer completion
- Keyboard avoidance in all modals and input screens
- Skeleton loaders and progress indicators throughout
- Helpful empty state messages when no data exists
- Safety confirmation modals for destructive actions
