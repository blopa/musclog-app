# Musclog GB

Musclog GB is a small, playable Game Boy Color edition of Musclog. It brings the
core loop of the main app to a 160x144 cartridge UI: first-run onboarding,
macro tracking, custom foods, body-weight logging, free workouts, rest timers,
and battery-backed history.

The ROM is built with [GBDK-2020](https://github.com/gbdk-2020/gbdk-2020) and
targets Game Boy Color only. It uses an MBC3 cartridge layout with RTC, RAM, and
battery so dates and logs can survive emulator or flash-cart restarts.

## Screenshots

| Home                                                   | Nutrition                                           | Workout                                      |
| ------------------------------------------------------ | --------------------------------------------------- | -------------------------------------------- |
| ![Musclog GB home screen](screenshots/home-screen.png) | ![Nutrition day summary](screenshots/nutrition.png) | ![Workout history](screenshots/workouts.png) |

| Track food                                        | Free session                                             | Rest timer                                        |
| ------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------- |
| ![Food amount screen](screenshots/track-food.png) | ![Workout session plan](screenshots/workout-session.png) | ![Workout rest timer](screenshots/rest-timer.png) |

| Onboarding                                      | Date setup                                       | Settings                                   |
| ----------------------------------------------- | ------------------------------------------------ | ------------------------------------------ |
| ![Onboarding setup](screenshots/onboarding.png) | ![Date and time setup](screenshots/set-date.png) | ![Settings list](screenshots/settings.png) |

## Player Features

- A title screen (full-screen art) shown after the splash, with `NEW GAME` and —
  once a completed save exists — `CONTINUE`. `CONTINUE` resumes the saved profile;
  `NEW GAME` over an existing save asks for confirmation, then erases all data and
  restarts onboarding. A third `OPTIONS` entry opens a panel (floating over the
  title art) to toggle sound effects and the soundtrack independently.
- Sound: a short blip plays on every selection/confirm/back press across the whole
  app, and a soundtrack plays on every screen after the splash while it remains
  enabled. The Game Boy cannot play
  MIDI, so both bundled `.mid` files are reduced at build time to the four hardware
  channels — SFX on pulse 1, and the soundtrack as pulse-lead + wave-bass + noise-
  drums. The SFX/soundtrack on/off choices persist in battery-backed SRAM.
- First-run onboarding for unit system, biological sex, activity level, age,
  height, weight, lifting experience, fitness focus, and weight goal.
- Macro goals are generated from the profile, then can be reviewed and edited
  before saving.
- Home dashboard shows today's calories, protein, digestible carbs, fat, and
  fiber against the saved goals.
- Food logging supports date selection, prefix search, serving amounts in grams
  or ounces, food detail screens, and deleting logged entries.
- 517 bundled foods are compiled into ROM banks: 215 USDA foundation foods plus
  302 common foods.
- Up to 100 custom foods can be created on-cart with name, calories, carbs,
  fiber, fat, and protein per 100 g. Custom foods appear first in search and are
  marked with `*`.
- Body-weight tracking stores dated weigh-ins and renders a compact trend chart.
- A Progress dashboard pages through charts over a rolling 7-day or 30-day window
  (toggled with up/down): a summary (distinct muscle groups hit, workout count,
  days logged, average daily calories/protein/carbs/fat) and per-day bar charts
  for calories, protein, digestible carbs, fat, and the body-weight trend.
  Left/right cycle pages.
- Free workout sessions support muscle-group exercise filtering, suggested
  starting weights, editable sets/weight/reps, set editing, a 60-second rest
  timer, and saved workout history.
- 198 bundled exercises are compiled into ROM, grouped by 9 muscle groups.
- Settings let players update profile fields, macro goals, units, and reset all
  saved data.
- MBC3 RTC calibration powers calendar dates. If no clock has been set, the ROM
  falls back to `2026-01-01`. When a save already carries a calibrated RTC base
  date as onboarding begins — e.g. one pre-seeded into SRAM by the website
  emulator, which hands the ROM today's real date and time — onboarding
  preserves it across its defaults reset and pre-fills the date/time picker with
  it (the time of day rides along in two seed-hint bytes after the profile block).

## Controls

| Button       | Common behavior                                                   |
| ------------ | ----------------------------------------------------------------- |
| D-pad        | Move between rows, scroll lists, or change spinner values         |
| Left / Right | Change selected values quickly, cycle filters, or edit row values |
| A            | Confirm, add a typed character, save a set, or select an item     |
| Start        | Alternate confirm; often shown as `ST` in footers                 |
| B            | Back, cancel, or delete one typed character                       |
| Select       | Open the current screen's menu                                    |

The on-screen footers are the best guide for each screen. `A/ST` means either
`A` or `Start`.

## Build And Run

From the repository root:

```sh
npm run gb:build
```

The build script:

1. Downloads GBDK-2020 into `gameboy/.gbdk/` if `lcc` is missing.
2. Converts `gameboy/assets/logo.png` and `gameboy/assets/gb_background.png` into
   generated GBDK asset sources.
3. Compiles every `gameboy/src/*.c` file.
4. Writes `gameboy/build/musclog.gbc`.
5. Checks `gameboy/build/musclog.map` for ROM bank overflows.

To open the last built ROM with the repo's mGBA Flatpak shortcut:

```sh
npm run gb
```

You can also open `gameboy/build/musclog.gbc` in any Game Boy Color emulator
that supports MBC3 RTC and battery saves, such as SameBoy, BGB, mGBA, or
Emulicious.

To publish a freshly built ROM into the web app's in-browser emulator asset:

```sh
npm run gb:copy-rom
```

That copies `gameboy/build/musclog.gbc` to both `assets/musclog.gbc` and
`public/images/musclog.gbc`. The website Game Boy page fetches the latter through
WasmBoy.

## Tooling Commands

```sh
npm run gb:setup         # Fetch GBDK-2020 only
npm run gb:prepare-logo  # Regenerate gameboy/assets/logo.png from the app icon
npm run gb:prepare-bg    # Regenerate gameboy/assets/gb_background.png (4-color title art)
npm run gb:gen-foods     # Regenerate ROM food tables from data/*.json
npm run gb:gen-exercises # Regenerate the ROM exercise table from data/exercisesData.json
npm run gb:gen-music     # Reduce assets/*.mid to APU data (src/music_data.{c,h})
npm run gb:build         # Build the .gbc ROM
npm run gb:copy-rom      # Copy the ROM into app + website emulator assets
```

The generated food, exercise, and music C files are committed so normal ROM
builds do not depend on the JSON seed data or the `.mid` assets. Regenerate them
only when the source datasets or MIDI files change. `gb:gen-music` prints the
loop it found (or reports that it fell back to looping the whole song). The music
converter is split under `gameboy/tools/music/`; run
`node --test gameboy/tools/music/*.test.mjs` after changing its parser or
arrangement code.

## Asset Credits

- The title-screen soundtrack MIDI comes from the
  [Ultimate MIDI Pack](https://opengameart.org/content/ultimate-midi-pack) on
  OpenGameArt.
- The title background art is based on
  [Mountain at Dusk Background](https://opengameart.org/content/mountain-at-dusk-background)
  on OpenGameArt.
- The icons used on the Game Boy label were acquired from
  [UXWing](https://uxwing.com/).

## Source Layout

```text
gameboy/
  assets/       Source bitmap assets used by the ROM build
  screenshots/  160x144 captures used in this README and website material
  src/          GBDK C source code
  tools/        Node scripts for toolchain setup, data generation, and builds
  tools/music/  MIDI parser, arrangement reducer, C emitter, and node:test coverage
  build/        Generated ROM, map, and capture artifacts (gitignored)
  .gbdk/        Downloaded GBDK-2020 toolchain (gitignored)
```

Important source modules:

- `src/main.c` boots the splash screen, loads save data, runs the start screen,
  owns the New Game / Continue lifecycle decisions (including data erase and
  onboarding), initializes stores, and runs the home loop.
- `src/start_screen.c` draws the title art (`gb_background`) with the New Game /
  Continue / Options menu, the erase confirmation, and the SFX/soundtrack Options
  panel, then returns the selected action to `main.c`. It shares ROM bank 8 with
  its art so the data is read directly.
- `src/audio.c` is the APU driver (SFX blip, global soundtrack sequencer, and the
  persisted enable flags); `src/music_data.c` is the generated APU data. Both live
  in ROM bank 9. `src/audio_vbl.c` (HOME bank) holds the VBL interrupt handler
  that silences stalled music channels during screen transitions and heavy tile
  loading — it watches a stall counter reset by `audio_music_update()` each frame,
  and kills channels 2/3/4 after 2 frames without a sequencer tick.
- `src/ui_text.c` owns the 20x18 text UI renderer, palettes, menus, value
  screens, confirmations, bars, date/datetime pickers, and the explicit UI input
  wrapper that advances the soundtrack and plays the SFX blip after fresh button
  presses.
- `src/profile.c` stores the packed profile and macro targets in SRAM bank 0;
  `src/sram_layout.h` names shared bank-0 subregions so profile, metrics, RTC seed
  hints, and audio settings cannot drift into each other.
- `src/game_data.c` owns the full gameplay-data erase sequence used by both Reset
  Data and title-screen New Game. Audio settings intentionally survive that erase.
- `src/rtc.c` reads and writes the MBC3 RTC and provides calendar helpers.
- `src/home_screen.c` renders the macro dashboard and top-level navigation.
- `src/progress.c` aggregates the food log, workout log, and weight metrics over
  a rolling window and renders the paged progress charts.
- `src/onboarding.c` collects profile details and macro-goal review/editing.
- `src/nutrition.c`, `src/nutrition_search.c`, and `src/nutrition_detail.c`
  implement the food diary, search, serving picker, detail, and delete flows.
- `src/food_db.c` reads bundled ROM food tables and custom foods behind one
  global food index space.
- `src/custom_foods.c` persists user-created foods in SRAM bank 3.
- `src/body_weight.c` and `src/metrics.c` implement dated weigh-ins and the
  body-weight trend chart.
- `src/workouts.c`, `src/workout_session.c`, `src/workoutlog.c`, and
  `src/exercise_db.c` implement free sessions, exercise lookup, recommendations,
  rest timers, saved workouts, and workout details.

## Cartridge Layout

The ROM is linked as a 256 KB CGB-only MBC3 cartridge:

- `-Wm-yC`: Game Boy Color only
- `-Wm-yt0x10`: MBC3 + timer + RAM + battery
- `-Wm-ya4`: four 8 KB SRAM banks
- `-Wm-yo16`: sixteen 16 KB ROM banks
- Header title: `MUSCLOG`
- Header product/manufacturer patch: `MLOG`

ROM banks are used deliberately:

- Bank 0 contains non-banked code and shared helpers.
- Bank 2 contains USDA foundation foods.
- Bank 3 contains common foods.
- Bank 4 contains nutrition and custom-food screens.
- Bank 5 contains onboarding.
- Bank 6 contains the exercise table.
- Bank 7 contains workout UI and session logic.
- Bank 8 contains the start screen and its title art (`gb_background`).
- Bank 9 contains the audio driver (`audio.c`) and the generated APU data
  (`music_data.c`), co-located so the sequencer reads the tables directly.

SRAM stores are separate and checksummed:

- Bank 0 stores the profile at the start of SRAM and body-weight metrics from
  offset `0x40`. The audio SFX/soundtrack on-off flags sit at `0x38-0x39`, in the
  free part of the profile-reserved region, and survive a NEW GAME erase.
- Bank 1 stores food log records: day number, food index, and grams.
- Bank 2 stores workout records with summary data plus every logged set.
- Bank 3 stores custom foods in fixed tombstoned slots.

Custom food slots are never compacted. Deleting a custom food clears its name but
keeps the slot stable, so old food-log records never point at a different food.

## Data Notes

Food macros are stored per 100 g. Bundled and custom foods keep energy as whole
kilocalories and macros as decigrams, then serving screens scale those values to
the chosen amount.

The Game Boy nutrition UI follows Musclog's food convention: food `carbs` are
stored as total carbohydrates including fiber, while the carbs progress bar shows
digestible carbs (`carbs - fiber`) against the user's carbs goal.

Workout weights are always stored metrically as kg tenths. When the player uses
imperial units, display pounds are converted at the UI boundary.

Calendar values are stored as day numbers from `2000-01-01`. The RTC setup
screen stores a base date and resets the MBC3 day counter; current date is
derived by advancing that base date by elapsed RTC days. The RTC base date
(`SRAM_RTC_*` in `src/profile.h`, bank 0) and its `rtc_is_set` flag can also be
written from outside the ROM: `utils/decodeGameBoySave.ts` encodes a valid
profile block (matching `db_checksum`) so the website can hand the ROM today's
date before boot. Today's time of day rides along in two seed-hint bytes
(`SRAM_RTC_HOUR`/`SRAM_RTC_MINUTE`, 0x17/0x18) that sit just after the profile
block and are deliberately excluded from the checksum, so the picker can also
pre-fill the hour and minute without touching the save format.

## Development Notes

- Keep generated tables in sync with their source data by using
  `npm run gb:gen-foods`, `npm run gb:gen-exercises`, and `npm run gb:gen-music`.
- Keep `gameboy/assets/logo.png` and `gameboy/assets/gb_background.png` committed.
  The build converts them into generated `src/logo.c`/`src/logo.h` and
  `src/gb_background.c`/`src/gb_background.h`, which are gitignored. The title art
  is pinned to ROM bank 8 (`png2asset -b 8`), matching `start_screen.c`'s
  `#pragma bank 8` so the code reads the data co-located without `SWITCH_ROM()`.
  The title art must fit within 256 addressable background tile indices after
  png2asset dedupes duplicate and flipped tiles; `npm run gb:build` fails if a
  new `gb_background.png` is too detailed.
- After adding large tables or new screens, run `npm run gb:build` and inspect
  the bank layout output. The build fails if fixed or switchable banks overflow.
- Prefer keeping ROM-bank-sensitive readers non-banked when they call
  `SWITCH_ROM()`. `food_db.c` and `exercise_db.c` show the pattern.
- Use raw `_SRAM[]` access only through the existing store modules and checksum
  helpers. Profile, food log, workout log, metrics, and custom foods each own
  their layout.

## License

This software is licensed under the MIT License.
