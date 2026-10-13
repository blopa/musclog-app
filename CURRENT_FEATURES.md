# Musclog — Current Features

The source of truth for user-facing features that ship today, grouped by area.

---

## Dashboard & Home Screen

- Daily summary card with calorie intake vs. goal and macro breakdown
- Daily stat strip under the summary card: today's step count (tap to open the metric log) plus calories burned so far today (TDEE spread across the day by the circadian model, so it reflects the current hour rather than the whole day), eaten, and the resulting deficit or surplus, tinted by direction
- Weekly streak card showing consecutive days of nutrition logging (current & best streak)
- Time-based personalized greetings (Good Morning / Afternoon / Evening)
- Quick-access action row, configurable in Interface settings: pick two to four of Start Workout, Track Food, Scan Barcode, AI Photo, My Meals and Add Note, and they appear in the order you pick them
- Recent foods and recent workouts previews
- Permanent Weekly Review entry below Home actions, plus a prominent Resume card while a workout is active
- Android home screen widgets: Nutrition Progress + Smart Camera

---

## Workout Tracking

- Log sets, reps, weight, rest times, and RPE for any exercise
- Workout types: Strength, Cardio, Flexibility, Calisthenics
- Create and save custom workout templates (e.g., Push Day or Leg Day)
- Organize workouts into named plans with weekly weekday assignments or ordered rotating cycles; workouts can belong to multiple plans, while standalone routines remain in an Unplanned section
- Browse a built-in template library, including a five-session cable superset program
- Browse 873 built-in exercises with localized names and instructions, muscle-group filters, and two-frame technique photos
- Forgiving exercise search: find an exercise by abbreviation (DB, RDL, OHP), plural or misspelled plural ("flys"), accent-less spelling, compound spelling ("pullups"), its name in any of the app's languages, or your own "Also known as" names added on the exercise screen
- Per-exercise estimated-1RM trend chart with a plain-language read of the change across logged sessions
- Built-in programs and AI-generated routines create complete named workout plans based on your equipment and goals
- Drag-and-drop exercise reordering during or after a session
- Superset / exercise grouping via shared group ID
- Rest timer with a configurable default rest, optional auto-start (or a "Start rest" button), a large countdown that scales with the screen, a distinct "Get ready" state for the last ten seconds that is spoken as well as coloured, a haptic countdown, and the next set's load shown prominently
- Smart warm-up sets: one tap adds a ramp (an empty-bar set on heavy barbell lifts, then 40 / 60 / 80%) before an exercise's first working set, snapped to weights your gym can actually load. Warm-ups are marked "W" in history and are excluded from volume, personal records, estimated 1RM, progression, goals and the figures the AI coach sees (calories and Health Connect still count them)
- Inline and Guided workout views share direct numeric entry, one-tap set completion/reopening, optional effort details, persistent rest timers, superset order, and explicit Finish Workout. Inline is a per-exercise set table (set, last time, weight, reps, ✓) where tapping "Last time" repeats those numbers; Guided is one set at a time over the exercise photo with large −/+ steppers and Complete set pinned above the rest timer, so it never needs a scroll. New installs use Inline; existing users keep Guided until switching. Pending inputs survive switching and restart. On narrow screens or with larger text, Last time stays fully visible below the row.
- A pinned rest timer under the session with progress, −15 s / +30 s, a "get ready" phase, haptic countdown, and a large panel (automatic in Guided)
- Per-exercise Automatic, Double progression, Linear, Top set + back-offs, and Percentage of training max rules, chosen from a sheet that explains each method; tap an exercise in the workout editor (or use the Progression row when adding one). Explicit rules work with automatic suggestions disabled; warm-ups, skipped sets, and missing effort are handled separately. One bad session never deloads: the load drops only after two sessions in a row at the same load ended at failure (or short of the rep range); the first one holds. Reps-first progression climbs from the reps the workout plans, so a 5-rep strength block stays a 5-rep block. Cardio, mobility and stretching are never progressed.
- "Why?" beside every target: the method, the reason in a sentence, the plan / last time / today numbers, and actions (Use the plan's, plate calculator, edit gym, edit workout and rules). Numbers the app calculated are marked until you type over them.
- Read-only upcoming targets in previews, Next time in summaries, and Weekly Review. Targets show their source and reason; Use the plan’s restores unfinished prescriptions and removes pending load/rep overrides while retaining entered effort. Template edits preserve exercise identity and active-session rule snapshots.
- Today in Workouts shows the workout in progress (progress bar, Resume), or today's scheduled workout / the next rotating-plan workout with Preview and start, workouts already trained today as done, and the active gym and starting-target setting. With no schedule and no rotating plan it suggests the recently trained workout rested longest ("last done Thu, Oct 8"), so the card always offers something to start
- Start Workout on a library card opens the session immediately; tapping the card's heading previews its targets first
- Per-exercise preferences in the exercise view: a weight unit for just that exercise (kg or lb, whatever the account uses) and a note that is pinned above the set in every workout. In a session, notes can also be written for this workout only (optionally copied onto the workout template) and a note can be added when you finish a workout
- Log a walk or run in a few taps from the workouts menu or the Home quick action: activity, distance, duration, when it ended, an optional treadmill flag and an optional calorie figure from your watch. It shows pace and estimated calories live, appears in history with distance and pace, and is written to Health Connect / Apple Health as a walk or run with its distance
- Real-time session stats: elapsed time, calories burned, total volume
- Between-set weight/rep re-targeting that states what it changed and why (carried-over load, or a recalculation that holds your target reps in reserve), with the marker on the field it actually moved
- Automatic personal record (PR) detection
- Review the full planned set list in workout history, with unfinished sets and exercises marked skipped and excluded from volume, records, trends, and other performance calculations
- Import workouts by pasting text — AI parses it into a session
- AI errors you can act on say so: a rejected Gemini/OpenAI key names the provider and points to AI settings, a stalled request times out (retried once) instead of spinning forever, and the AI photo scan has a Cancel button. A "Test key" button in AI settings checks a key while you set it up
- Keep screen awake during active workout sessions
- Optional session feedback from the workout summary: difficulty, exhaustion, enjoyment, and notes; a failed save keeps the form open for retry.
- Add, replace, or skip exercises mid-session
- Swap an exercise mid-session and say why (equipment unavailable, pain, too hard or too easy, dislike, machine occupied, or just for today): suggestions are ranked for the same body region, and only the session changes — never the plan. Sets already logged keep their original movement; remaining sets move to a replacement block while retaining their superset rounds and rest boundaries. Swap is disabled once all sets in a block are done. A swap's follow-ups (stop suggesting it for a while, remove the equipment from your gym) are choices you switch on, not defaults applied behind your back
- Exercise restrictions: mark any exercise Dislike, Injury (with an end date) or Never suggest from its screen or when swapping. Injured and never-suggest exercises are hidden from swap suggestions and AI-generated plans; disliked ones are ranked last
- Named gym profiles (bar weight, plates you own, smallest weight step, available equipment, and optionally a weight unit of its own — e.g. pounds for a gym whose plates are in pounds, otherwise it follows your account setting) with one active gym. The active gym drives the plate calculator, the +/- weight steps, the weights the app recomputes between sets, and which exercises can be suggested
- Plate calculator on barbell lifts: the plates to load on each side for the set's weight, exact even with a limited plate inventory (standard plates are used until you set up a gym)
- Recover interrupted workouts
- Archive workout templates to declutter the list
- Share workout routines via clipboard or native share sheet

---

## Nutrition & Food Logging

- Log meals by type: breakfast, lunch, dinner, snack
- Track calories, protein, carbs, fiber, fat, and 40+ vitamins/minerals
- Search food databases: Open Food Facts, USDA, Musclog barcode DB, local-only
- Barcode scanner for instant product lookup
- AI food photo estimation — snap a photo, get macros; when logging an AI-estimated meal (from the camera or the coach) you choose the date and the time of day, not just the day
- Tap any meal photo (diary, meal groups, coach chat and attachments) to open it full screen: pinch to zoom up to 5×, drag to pan, double-tap to zoom, swipe down to close, and save or share it from the viewer
- OCR label scanning to extract nutrition info from packaging (optional local pre-processing)
- Create custom foods manually with full nutrition values
- Flexible serving sizes (grams, ounces, standard portions)
- Save meal templates for quick reuse
- Meal suggestions surface your non-favourite saved meals ordered by how often you have logged them in the last 60 days, newest-first for meals you have not logged yet
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
- Weekly Review is reachable from Home, Workouts, and Food (a review card while a week is waiting; otherwise Food's "Weekly targets · since …" line). A week counts as ready only when it holds a workout, food log or weigh-in. Training acknowledgement and nutrition decisions are independent; workout progression never waits for a review. Personal records show one row per exercise (three, then Show all). The nutrition recommendation states the expenditure and the week's trend-weight change it is based on, and a calorie change of 15% or more asks you to check the week's food log first. A recommendation can be applied once the week has food logged (or a flagged fasting day) on at least 5 of its 7 days and three weigh-ins; until then the review says so and offers buttons that open the food diary or weight entry on the exact day of that week still missing data. Review history retains legacy check-ins and decisions across goal changes.
- Manual, Daily automatic, and Weekly review target modes. Existing daily goals retain their behavior; new guided setup defaults to Weekly review. Approved calories and net-carb macros begin tomorrow and stay stable until replaced, with historical target periods.
- Weekly nutrition decisions show current/recommended targets, trend weight and logged-day coverage, with Apply tomorrow, Keep, and a focused recommendation editor. Missing evidence keeps targets while more data is collected. Optional review weekday and reminder. Legacy comparisons account for gain/loss goals.

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

- What's new: replay the newest release tour from Settings, including choices that save real preferences. The card appears when this app version has a published announcement.
- Help & feedback: report a bug or request a feature (opens the matching GitHub issue form with the app version, platform and language pre-filled) or email support (version and device added to the message). Nothing about you or your data is included
- Set name, email, gender, date of birth, and avatar
- Fitness profile: weight, height, body fat %, goal type, activity level, experience level
- Language selection and full multilingual support for English, Spanish, Dutch, Brazilian Portuguese, and Russian, including the built-in exercise catalogue
- Metric or imperial units applied consistently throughout the app
- Named theme selection: Kinetic Depth, Kinetic Light, Kinetic Shock, Kinetic Volt, or Kinetic Blush,
  plus a System option that follows the device's light/dark appearance
- Theme-matched app icon on Android and iOS: picking a named theme switches the home-screen icon to
  that theme's colors (on Android once you leave the app; iOS shows its own confirmation alert).
  The System option and Kinetic Depth use the default icon
- Home summary card choice: Daily Summary vs. Weekly Streak; the Daily Summary's gradient is chosen
  by the active theme — a flat card surface in Kinetic Light, a contrast-matched colorful sweep in
  the dark themes and in Kinetic Blush
- Configurable AI provider (OpenAI / Google Gemini / local LLM) with model and API key settings
- Food search source configuration
- Toggle: OCR before AI, intuitive eating mode, weight prediction, daily prompts, cycle tracking
- Carb convention setting (include or exclude fiber in carbs display)
- Notification settings
- Advanced: database reset, data encryption options, raw DB access

---

## Onboarding

- Returning users get a short, skippable post-update tour on home, merging missed announcements into at most six pages plus an intro. Fresh installs skip it; restored backups retain their seen version (older backups without one may show the tour again). The first announcement targets 2.13.1, the first production release with the tour: every update from an earlier version (including a 2.13.0 test build) shows it. It introduces Guided/Inline views, progression preferences, rest controls, gyms and plates, Weekly Review, plans, cardio, swaps, restrictions and warm-ups.
- Quick or detailed guided setup flow
- Restore a full profile either from a JSON backup or directly from another device via optical QR transfer on the first screen
- Personalized nutrition goal calculation based on age, weight, height, activity level, and weight goal
- Training branch in both the quick and the personalized setup (one shared screen, skippable for nutrition-only users): where you train (gym / home / minimal), experience (quick setup only), days per week and whether the app suggests loads. It creates your first active gym profile and sets the load-suggestion preference, and the setup ends on a first workout: a matching bundled plan (gym trainers) to start now or add for later, or an empty workout (home/minimal, since every bundled plan needs gym equipment)
- A one-time "how a session works" tip at the top of the first workout (what ✓ logs, the rest timer, warm-ups not counting toward volume), shown only to people who have never finished a workout and gone for good once dismissed
- Optional Health Connect / HealthKit setup is offered once, after the first finished workout, instead of in the middle of the setup (users who skip the training questions get it at the end of the setup)
- AI provider configuration during setup

## Musclog GB Gimmick

- Game Boy Color ROM prototype with first-run onboarding for units, sex, activity, age, height, weight, training level, fitness focus, and weight goal
- Compact battery-backed SRAM profile save with generated calorie and macro goals
- Prototype ROM nutrition and saved workout-history screens with Select-menu shortcuts back to Home
- Game Boy custom foods: create your own foods (name + per-100g calories, carbs, fiber, fat, protein) saved to battery-backed cartridge SRAM, surfaced inline (marked with `*`) in the food search so they can be tracked like bundled foods, plus a "My Foods" screen to delete them
- Game Boy Start Workout prototype for free sessions: pick an exercise, filter by muscle group with left/right arrows, edit suggested sets/weight/reps, run active set screens, adjust set targets, use a 60-second rest timer, save completed workouts to cartridge SRAM, and return to exercise selection for the next movement
- Game Boy exercise catalogue: the 100 exercises marked popular in the app's current free-exercise-db catalogue, stored under compact cartridge-local IDs in a frozen order, so an optically transferred workout maps straight back onto the matching app exercise with its localized name and photos
- Game Boy Progress dashboard: a paged charts screen over a rolling 7-day or 30-day window (toggled with up/down), with a summary page (distinct muscle groups hit, workout count, days logged, average daily calories/protein/carbs/fat) plus per-day bar charts for calories, protein, digestible carbs, fat, and a body-weight trend (left/right cycles pages)
- Game Boy day sharing: on the nutrition screen, SELECT → Share Day sends just the day on screen as a non-destructive share the app merges into its own diary — every entry filed on the same calendar date at midday (the cartridge records no times), each food matched to the app's own catalogue entry by its bundled index rather than by its 16-character truncated name, so a shared day reuses the foods you already have instead of duplicating them, and the receiving phone asks whether to add to that day or replace it
- Game Boy optical export: Settings → Share Data sends the entire cartridge database as an optimized, screen-filling fountain-coded QR stream. The Android, iOS, or web app verifies it, expands its compact versioned JSON schema into a complete app profile (including safe defaults for app-only identity fields), reconnects every logged set to the matching bundled exercise so imported workouts keep their localized names, photos and target muscles, previews it as a database restore, and replaces the receiving database only after confirmation; pressing B asks whether to continue or stop, and the Game Boy remains sender-only with no Game Boy-to-Game Boy transfer
- Home Select menu with a scrollable Settings screen to re-edit every profile field (units, sex, age, height, weight, activity, experience, focus, weight goal) and all macro targets, a whole-database Share Data action, an About screen linking to the full app at https://musclog.app/, and a confirmation-gated Reset Data option
- Game Boy sound: a UI blip on every selection/confirm/back press across the app, plus a soundtrack that plays on every Game Boy screen after the splash while enabled, mixed live from the four APU channels (pulse lead, wave bass, noise drums). Both .mid assets are reduced to Game Boy sound data at build time (`npm run gb:gen-music`); the soundtrack converter auto-detects a repeating section to loop. A title-screen Options menu toggles SFX and the soundtrack independently, persisted to battery-backed SRAM so the choice survives resets
- Game Boy themes: the Settings list opens with a Theme row carrying the same six themes as the phone app (Depth, Light, Shock, Volt, Blush, Varia), each reduced from the app's theme registry to the four background palettes the cartridge's text UI draws from (`npm run gb:gen-themes`). Left/right recolours every screen instantly, and the choice is kept in battery-backed SRAM so it survives resets and a New Game erase
- Playable in-browser Game Boy Color emulator on the website (`/gameboy`) that auto-loads the ROM, with keyboard controls on desktop and on-screen touch controls on mobile, and persists the cartridge's battery-backed SRAM to IndexedDB (autosaved periodically and when leaving the page) so in-game saves survive reloads; before boot it also seeds today's real date and time into the cartridge SRAM (creating the save if none exists yet) for any not-yet-onboarded player, so first-run onboarding pre-fills the correct date and time. The page also offers direct downloads of the Game Boy ROM (`.gbc`) and a retro-styled PDF instruction manual

## Public Website

- One compact preferences button in the desktop and mobile header opens styled Language and Theme tabs with flag rows, palette swatches, and selection checkmarks. Choices apply immediately and the panel stays open so both can be changed together. The landing-page hero shows the home-screen screenshot matching the active theme, including the resolved light or dark palette when following the system.

- Responsive navigation: the full link bar on desktop collapses below 1024px into a burger menu in the header, holding every primary destination (features, blog, calculator, exercises, progress, FAQ, Game Boy, alternatives, GitHub) plus the store download buttons. It closes on Escape, on a tap outside, and on choosing a destination. The footer keeps the secondary and legal links (privacy, terms, contact, license, cookie settings) at every width
- Markdown-powered blog at `/blog`: the index, category-filtered listings, their paginated pages, and individual post URLs are statically generated from files under `app/(website)/posts`; category labels on listings and articles link to localized category pages, each listing shows up to ten newest-first posts per page with previous/next and compact numbered navigation, YAML frontmatter supplies metadata, and post bodies support headings, links, lists, tables, blockquotes, images, inline code, and syntax-highlighted fenced code blocks
- Social sharing at the end of every blog post: one-tap share to X, Bluesky, LinkedIn, Reddit, Telegram, WhatsApp, Pinterest, and VK, each opening the network's own share dialog pre-filled with the post's canonical URL, title, and description. The buttons sit on one row on desktop and as an even grid on phones, and light up in their network's color on hover

---

## Privacy & Data

- Local-first storage — all data lives on-device via WatermelonDB, no cloud sync required
- Sensitive metrics (weight, body fat) and nutrition logs encrypted at rest with AES
- Fully offline — core features work without internet
- Full data export (encrypted JSON or Excel) and import for portability
- **Optical Transfer** — move everything, an individual food, a saved meal, a named meal from the
  nutrition diary, a whole breakfast/lunch/dinner section, or an entire day of eating to another
  device with nothing but the two screens: one displays an animated stream of QR codes, the other
  reads them with its camera.
  Whole-profile transfers remain optionally passphrase-protected and replace only after verification;
  food, meal and day shares preview and save non-destructively into the existing database, matching each
  ingredient and serving size against what the receiving phone already has so a received meal reuses
  your existing foods and portions rather than duplicating them. Send a food or meal from its ⋮ menu,
  a day from the daily summary's ⋮ menu, and receive from My Meals → +, or receive any payload from
  Settings. A received day lands on the same calendar date it was logged on, with each entry's
  amount, meal and time of day intact, and you choose whether to add it to that day or replace what
  is already there. Point a food barcode scanner at a sending phone by mistake and it recognises the stream
  instead of failing a product lookup, offering to hand you straight to the optical reader. The
  receiving screen shows live percentage, transferred KB, KB/s throughput, and remaining time.
  Android, iOS, and web can send or receive in any combination; Musclog GB can send its whole
  cartridge database, or one day of its food log, to any of those receivers. No internet, cable,
  or account is required. Protocol rationale and measurements are in
  [RESEARCH.md](RESEARCH.md#optical-transfer).
- Automatic local backups before any restore or destructive exercise-catalogue cutover, browsable and restorable from settings
- Complete database reset option

---

## Accessibility & UX

- Locale-aware number formatting (e.g., German decimal separators, Portuguese grouping)
- Haptic feedback on buttons and rest timer completion
- Keyboard avoidance in all modals and input screens
- Skeleton loaders and progress indicators throughout
- Helpful empty state messages when no data exists
- Safety confirmation modals for destructive actions
